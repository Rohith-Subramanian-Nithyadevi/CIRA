/**
 * analytics.service.ts
 * Centralised calculation service for all CIRA student analytics.
 * No AI. All logic is rule-based and deterministic.
 */

import { PrismaClient, PerformanceRating } from '@prisma/client';

const prisma = new PrismaClient();

// ─── BAND THRESHOLDS ─────────────────────────────────────────────────────────
const BAND_THRESHOLDS = {
  EXCELLENT: 85,
  GOOD: 65,
  AVERAGE: 45,
  POOR: 0,
};

// ─── MASTERY THRESHOLDS ───────────────────────────────────────────────────────
const MASTERY = {
  STRONG: 80,
  DEVELOPING: 65,
  WEAK: 0,
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

export function getBand(pct: number): PerformanceRating {
  if (pct >= BAND_THRESHOLDS.EXCELLENT) return 'EXCELLENT';
  if (pct >= BAND_THRESHOLDS.GOOD) return 'GOOD';
  if (pct >= BAND_THRESHOLDS.AVERAGE) return 'AVERAGE';
  return 'POOR';
}

export function getMasteryLabel(score: number): string {
  if (score >= MASTERY.STRONG) return 'Strong';
  if (score >= MASTERY.DEVELOPING) return 'Developing';
  return 'Needs Improvement';
}

/** Clamp value between 0 and 100 */
function clamp(v: number) {
  return Math.min(100, Math.max(0, Math.round(v)));
}

/** Variance of an array */
function variance(arr: number[]) {
  if (arr.length < 2) return 0;
  const mean = arr.reduce((s, x) => s + x, 0) / arr.length;
  return arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
}

// ─── RESOLVED ATTEMPT DATA ────────────────────────────────────────────────────

interface AttemptSummary {
  id: string;
  quizId: string;
  quizTitle: string;
  startTime: Date;
  totalScore: number;
  totalMarks: number;
  pct: number;
  band: PerformanceRating;
  subject: string | null;
  topicScores: Record<string, { earned: number; total: number }>;
}

async function getAttemptSummaries(userId: string): Promise<AttemptSummary[]> {
  const attempts = await prisma.quizAttempt.findMany({
    where: {
      userId,
      status: { in: ['SUBMITTED', 'EVALUATED'] },
    },
    orderBy: { startTime: 'asc' },
    include: {
      quiz: { select: { id: true, title: true, totalMarks: true, subject: true } },
      responses: {
        include: {
          question: {
            select: { topic: true, topicId: true, marks: true },
          },
        },
      },
    },
  });

  return attempts.map(a => {
    const max = a.quiz.totalMarks || 100;
    const pct = max > 0 ? (a.totalScore / max) * 100 : 0;

    // Build topic score map
    const topicScores: Record<string, { earned: number; total: number }> = {};
    for (const r of a.responses) {
      const topicKey = r.question.topic || 'General';
      if (!topicScores[topicKey]) topicScores[topicKey] = { earned: 0, total: 0 };
      topicScores[topicKey].total += r.question.marks;
      topicScores[topicKey].earned += r.marksAwarded ?? 0;
    }

    return {
      id: a.id,
      quizId: a.quiz.id,
      quizTitle: a.quiz.title,
      startTime: a.startTime,
      totalScore: a.totalScore,
      totalMarks: max,
      pct: Math.round(pct),
      band: getBand(pct),
      subject: a.quiz.subject ?? null,
      topicScores,
    };
  });
}

// ─── SIS COMPONENTS ──────────────────────────────────────────────────────────

/**
 * Current Performance (35%)
 * Average of the most recent 30% of attempts, weighted toward recency.
 */
function calcCurrentPerformance(summaries: AttemptSummary[]): number {
  if (!summaries.length) return 0;
  const recent = summaries.slice(-Math.max(1, Math.ceil(summaries.length * 0.3)));
  const avg = recent.reduce((s, a) => s + a.pct, 0) / recent.length;
  return clamp(avg);
}

/**
 * Improvement (30%)
 * Compare average of first half vs second half of attempts.
 */
function calcImprovement(summaries: AttemptSummary[]): number {
  if (summaries.length < 2) return 50; // neutral if not enough data
  const half = Math.ceil(summaries.length / 2);
  const early = summaries.slice(0, half);
  const recent = summaries.slice(half);
  const avgEarly = early.reduce((s, a) => s + a.pct, 0) / early.length;
  const avgRecent = recent.reduce((s, a) => s + a.pct, 0) / recent.length;
  const delta = avgRecent - avgEarly; // -100 to +100
  // Map delta to 0-100: delta 0 = 50, delta +20 = 100, delta -20 = 0
  return clamp(50 + delta * 2.5);
}

/**
 * Topic Mastery (20%)
 * Average score across all topics, penalised if many topics are weak.
 */
function calcTopicMastery(topicMap: Map<string, { earned: number; total: number }>): number {
  if (!topicMap.size) return 0;
  const scores = Array.from(topicMap.values()).map(v => (v.total > 0 ? (v.earned / v.total) * 100 : 0));
  const avg = scores.reduce((s, x) => s + x, 0) / scores.length;
  return clamp(avg);
}

/**
 * Consistency (10%)
 * Low variance → high score. Max variance possible ≈ 2500 (0-100 range).
 */
function calcConsistency(summaries: AttemptSummary[]): number {
  if (summaries.length < 2) return 70; // neutral
  const scores = summaries.map(s => s.pct);
  const v = variance(scores);
  // Map variance 0 → 100, variance ≥ 400 → 0
  return clamp(100 - (v / 4));
}

/**
 * Recovery (5%)
 * Reward meaningful improvement from a low band.
 */
function calcRecovery(summaries: AttemptSummary[]): number {
  if (summaries.length < 2) return 50;
  let score = 50;
  for (let i = 1; i < summaries.length; i++) {
    const prev = summaries[i - 1];
    const curr = summaries[i];
    const bandOrder: Record<PerformanceRating, number> = { POOR: 0, AVERAGE: 1, GOOD: 2, EXCELLENT: 3 };
    const rise = bandOrder[curr.band] - bandOrder[prev.band];
    if (rise > 0) score = Math.min(100, score + rise * 15);
    if (rise < 0) score = Math.max(0, score + rise * 5); // smaller penalty for decline
  }
  return clamp(score);
}

// ─── PUBLIC API ──────────────────────────────────────────────────────────────

export interface SISResult {
  sis: number;
  components: {
    currentPerformance: number;
    improvement: number;
    topicMastery: number;
    consistency: number;
    recovery: number;
  };
  insufficientData: boolean;
  attemptCount: number;
  trend: number; // positive = improving
  latestScore: number;
}

export async function calculateSIS(userId: string): Promise<SISResult> {
  const summaries = await getAttemptSummaries(userId);

  if (summaries.length === 0) {
    return {
      sis: 0, insufficientData: true, attemptCount: 0, trend: 0, latestScore: 0,
      components: { currentPerformance: 0, improvement: 0, topicMastery: 0, consistency: 0, recovery: 0 },
    };
  }

  // Build aggregate topic map
  const topicMap = new Map<string, { earned: number; total: number }>();
  for (const s of summaries) {
    for (const [topic, vals] of Object.entries(s.topicScores)) {
      if (!topicMap.has(topic)) topicMap.set(topic, { earned: 0, total: 0 });
      const existing = topicMap.get(topic)!;
      existing.earned += vals.earned;
      existing.total += vals.total;
    }
  }

  const cp = calcCurrentPerformance(summaries);
  const imp = calcImprovement(summaries);
  const tm = calcTopicMastery(topicMap);
  const con = calcConsistency(summaries);
  const rec = calcRecovery(summaries);

  const sis = clamp(cp * 0.35 + imp * 0.30 + tm * 0.20 + con * 0.10 + rec * 0.05);

  const trend = summaries.length >= 2
    ? summaries[summaries.length - 1].pct - summaries[summaries.length - 2].pct
    : 0;

  return {
    sis,
    insufficientData: summaries.length < 3,
    attemptCount: summaries.length,
    trend,
    latestScore: summaries[summaries.length - 1].pct,
    components: {
      currentPerformance: cp,
      improvement: imp,
      topicMastery: tm,
      consistency: con,
      recovery: rec,
    },
  };
}

export interface TopicPerf {
  topic: string;
  currentScore: number;
  previousScore: number | null;
  improvement: number | null;
  questionsAttempted: number;
  questionsCorrect: number;
  assessmentCount: number;
  masteryLabel: string;
  lastAttemptAt: Date | null;
  trend: 'up' | 'down' | 'stable';
}

export async function calculateTopicPerformance(userId: string): Promise<TopicPerf[]> {
  const summaries = await getAttemptSummaries(userId);
  if (!summaries.length) return [];

  // Build per-topic timeline: array of pct scores in order
  const topicTimeline = new Map<string, number[]>();
  const topicLastDate = new Map<string, Date>();
  const topicQuestionsAttempted = new Map<string, number>();
  const topicQuestionsCorrect = new Map<string, number>();

  for (const s of summaries) {
    for (const [topic, vals] of Object.entries(s.topicScores)) {
      const pct = vals.total > 0 ? (vals.earned / vals.total) * 100 : 0;
      if (!topicTimeline.has(topic)) topicTimeline.set(topic, []);
      topicTimeline.get(topic)!.push(Math.round(pct));
      topicLastDate.set(topic, s.startTime);

      // Count questions (approximate from marks)
      const attempted = topicQuestionsAttempted.get(topic) || 0;
      const correct = topicQuestionsCorrect.get(topic) || 0;
      topicQuestionsAttempted.set(topic, attempted + 1); // 1 per quiz
      if (vals.earned > 0) topicQuestionsCorrect.set(topic, correct + 1);
    }
  }

  const result: TopicPerf[] = [];
  for (const [topic, scores] of topicTimeline.entries()) {
    const current = scores[scores.length - 1];
    const previous = scores.length >= 2 ? scores[scores.length - 2] : null;
    const improvement = previous !== null ? current - previous : null;
    const trend = improvement === null ? 'stable' : improvement > 2 ? 'up' : improvement < -2 ? 'down' : 'stable';

    result.push({
      topic,
      currentScore: current,
      previousScore: previous,
      improvement,
      questionsAttempted: topicQuestionsAttempted.get(topic) || 0,
      questionsCorrect: topicQuestionsCorrect.get(topic) || 0,
      assessmentCount: scores.length,
      masteryLabel: getMasteryLabel(current),
      lastAttemptAt: topicLastDate.get(topic) || null,
      trend,
    });
  }

  return result.sort((a, b) => b.currentScore - a.currentScore);
}

export interface StrengthsWeaknessesResult {
  strengths: { topic: string; score: number }[];
  weaknesses: { topic: string; score: number }[];
}

export async function calculateStrengthsWeaknesses(userId: string): Promise<StrengthsWeaknessesResult> {
  const topics = await calculateTopicPerformance(userId);
  return {
    strengths: topics.filter(t => t.currentScore >= MASTERY.STRONG).map(t => ({ topic: t.topic, score: t.currentScore })),
    weaknesses: topics.filter(t => t.currentScore < MASTERY.DEVELOPING).map(t => ({ topic: t.topic, score: t.currentScore })),
  };
}

export interface PriorityTopic {
  topic: string;
  score: number;
  reasons: string[];
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
}

export async function calculatePriority(userId: string): Promise<PriorityTopic | null> {
  const topics = await calculateTopicPerformance(userId);
  const weak = topics.filter(t => t.currentScore < MASTERY.DEVELOPING);
  if (!weak.length) return null;

  // Score each weak topic by urgency
  const scored = weak.map(t => {
    let urgencyScore = 0;
    const reasons: string[] = [];

    if (t.currentScore < 50) { urgencyScore += 3; reasons.push(`Score is critically low at ${t.currentScore}%`); }
    else if (t.currentScore < 65) { urgencyScore += 2; reasons.push(`Below proficiency at ${t.currentScore}%`); }

    if (t.trend === 'down') { urgencyScore += 2; reasons.push(`Declining trend — down ${Math.abs(t.improvement ?? 0)}%`); }
    if (t.assessmentCount >= 3 && t.currentScore < 65) { urgencyScore += 1; reasons.push(`Weak across ${t.assessmentCount} assessments`); }

    return { topic: t.topic, score: t.currentScore, reasons, urgencyScore };
  });

  scored.sort((a, b) => b.urgencyScore - a.urgencyScore);
  const top = scored[0];
  return {
    topic: top.topic,
    score: top.score,
    reasons: top.reasons,
    urgency: top.urgencyScore >= 4 ? 'HIGH' : top.urgencyScore >= 2 ? 'MEDIUM' : 'LOW',
  };
}

export interface BenchmarkEntry {
  topic: string;
  you: number;
  classAvg: number;
  topper: number;
}

export async function calculateBenchmark(userId: string): Promise<BenchmarkEntry[]> {
  // Get this user's topic scores
  const myTopics = await calculateTopicPerformance(userId);
  if (!myTopics.length) return [];

  // Get all other students' quiz responses for the same quizzes
  const myAttempts = await prisma.quizAttempt.findMany({
    where: { userId, status: { in: ['SUBMITTED', 'EVALUATED'] } },
    select: { quizId: true },
  });
  const quizIds = myAttempts.map(a => a.quizId);
  if (!quizIds.length) return [];

  // Get all attempts from all students for those quizzes (anonymised)
  const allAttempts = await prisma.quizAttempt.findMany({
    where: { quizId: { in: quizIds }, userId: { not: userId }, status: { in: ['SUBMITTED', 'EVALUATED'] } },
    include: {
      responses: { include: { question: { select: { topic: true, marks: true } } } },
    },
  });

  // Build class topic averages
  const classTopicMap = new Map<string, number[]>();
  for (const a of allAttempts) {
    const topicScores: Record<string, { earned: number; total: number }> = {};
    for (const r of a.responses) {
      const key = r.question.topic || 'General';
      if (!topicScores[key]) topicScores[key] = { earned: 0, total: 0 };
      topicScores[key].total += r.question.marks;
      topicScores[key].earned += r.marksAwarded ?? 0;
    }
    for (const [topic, vals] of Object.entries(topicScores)) {
      const pct = vals.total > 0 ? (vals.earned / vals.total) * 100 : 0;
      if (!classTopicMap.has(topic)) classTopicMap.set(topic, []);
      classTopicMap.get(topic)!.push(pct);
    }
  }

  return myTopics.slice(0, 6).map(t => {
    const classScores = classTopicMap.get(t.topic) || [];
    const classAvg = classScores.length
      ? Math.round(classScores.reduce((s, x) => s + x, 0) / classScores.length)
      : 0;
    const topper = classScores.length ? Math.round(Math.max(...classScores)) : 0;
    return { topic: t.topic, you: t.currentScore, classAvg, topper };
  });
}

export interface BandHistory {
  total: number;
  excellent: number;
  good: number;
  average: number;
  poor: number;
  trend: string; // human-readable message
}

export async function calculateBandHistory(userId: string): Promise<BandHistory> {
  const summaries = await getAttemptSummaries(userId);
  const counts = { excellent: 0, good: 0, average: 0, poor: 0 };
  for (const s of summaries) {
    if (s.band === 'EXCELLENT') counts.excellent++;
    else if (s.band === 'GOOD') counts.good++;
    else if (s.band === 'AVERAGE') counts.average++;
    else counts.poor++;
  }

  const total = summaries.length;
  let trend = 'No assessments yet.';
  if (total >= 4) {
    const half = Math.ceil(total / 2);
    const early = summaries.slice(0, half);
    const recent = summaries.slice(half);
    const earlyGoodPlus = early.filter(s => s.band === 'GOOD' || s.band === 'EXCELLENT').length;
    const recentGoodPlus = recent.filter(s => s.band === 'GOOD' || s.band === 'EXCELLENT').length;
    const earlyPct = (earlyGoodPlus / early.length) * 100;
    const recentPct = (recentGoodPlus / recent.length) * 100;
    if (recentPct > earlyPct + 20) trend = 'You have moved from mostly AVERAGE/POOR to GOOD/EXCELLENT results. Great improvement!';
    else if (recentPct < earlyPct - 20) trend = 'Your recent results have declined. Focus on weak topics now.';
    else trend = 'Your performance band is consistent across assessments.';
  }

  return { total, ...counts, trend };
}

export interface SemesterSummary {
  label: string;
  averageScore: number;
  assessmentCount: number;
  excellent: number;
  good: number;
  average: number;
  poor: number;
  improvement: number | null; // vs previous semester
}

export async function calculateSemesterProgression(userId: string): Promise<SemesterSummary[]> {
  const summaries = await getAttemptSummaries(userId);
  if (!summaries.length) return [];

  // Group by academic year quarter → "Sem" proxy
  const semMap = new Map<string, AttemptSummary[]>();
  for (const s of summaries) {
    const d = new Date(s.startTime);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12
    // Map to semester: Jan-Jun → S1, Jul-Dec → S2
    const sem = month <= 6 ? `${year}-S1` : `${year}-S2`;
    if (!semMap.has(sem)) semMap.set(sem, []);
    semMap.get(sem)!.push(s);
  }

  const sortedKeys = Array.from(semMap.keys()).sort();
  let prevAvg: number | null = null;
  const result: SemesterSummary[] = [];

  for (const key of sortedKeys) {
    const items = semMap.get(key)!;
    const avg = Math.round(items.reduce((s, i) => s + i.pct, 0) / items.length);
    const bands = { excellent: 0, good: 0, average: 0, poor: 0 };
    for (const i of items) {
      if (i.band === 'EXCELLENT') bands.excellent++;
      else if (i.band === 'GOOD') bands.good++;
      else if (i.band === 'AVERAGE') bands.average++;
      else bands.poor++;
    }
    result.push({
      label: key.replace('-S1', ' (Jan–Jun)').replace('-S2', ' (Jul–Dec)'),
      averageScore: avg,
      assessmentCount: items.length,
      ...bands,
      improvement: prevAvg !== null ? avg - prevAvg : null,
    });
    prevAvg = avg;
  }

  return result;
}

export interface QuizInsights {
  attemptId: string;
  quizTitle: string;
  yourScore: number;
  totalMarks: number;
  pct: number;
  band: PerformanceRating;
  classAvg: number;
  topicBreakdown: { topic: string; pct: number }[];
  strengths: string[];
  weaknesses: string[];
  mistakes: { questionId: string; questionText: string; topic: string; answersPublished: boolean }[];
}

export async function calculateQuizInsights(attemptId: string, userId: string): Promise<QuizInsights | null> {
  const attempt = await prisma.quizAttempt.findUnique({
    where: { id: attemptId },
    include: {
      quiz: { select: { id: true, title: true, totalMarks: true, answersPublished: true } },
      responses: {
        include: {
          question: { select: { id: true, text: true, topic: true, marks: true } },
        },
      },
    },
  });

  if (!attempt || attempt.userId !== userId) return null;

  const max = attempt.quiz.totalMarks || 100;
  const pct = Math.round((attempt.totalScore / max) * 100);

  // Topic breakdown
  const topicMap: Record<string, { earned: number; total: number }> = {};
  const wrongQuestions: any[] = [];

  for (const r of attempt.responses) {
    const topic = r.question.topic || 'General';
    if (!topicMap[topic]) topicMap[topic] = { earned: 0, total: 0 };
    topicMap[topic].total += r.question.marks;
    topicMap[topic].earned += r.marksAwarded ?? 0;

    // Track mistakes
    const awarded = r.marksAwarded ?? 0;
    if (awarded < r.question.marks * 0.5) {
      wrongQuestions.push({
        questionId: r.question.id,
        questionText: r.question.text,
        topic,
        answersPublished: attempt.quiz.answersPublished,
      });
    }
  }

  const topicBreakdown = Object.entries(topicMap).map(([topic, vals]) => ({
    topic,
    pct: vals.total > 0 ? Math.round((vals.earned / vals.total) * 100) : 0,
  })).sort((a, b) => b.pct - a.pct);

  const strengths = topicBreakdown.filter(t => t.pct >= 80).map(t => t.topic);
  const weaknesses = topicBreakdown.filter(t => t.pct < 65).map(t => t.topic);

  // Class avg for this quiz
  const classAttempts = await prisma.quizAttempt.findMany({
    where: { quizId: attempt.quizId, userId: { not: userId }, status: { in: ['SUBMITTED', 'EVALUATED'] } },
    select: { totalScore: true },
  });
  const classAvg = classAttempts.length
    ? Math.round(classAttempts.reduce((s, a) => s + (a.totalScore / max) * 100, 0) / classAttempts.length)
    : 0;

  return {
    attemptId,
    quizTitle: attempt.quiz.title,
    yourScore: attempt.totalScore,
    totalMarks: max,
    pct,
    band: getBand(pct),
    classAvg,
    topicBreakdown,
    strengths,
    weaknesses,
    mistakes: wrongQuestions,
  };
}
