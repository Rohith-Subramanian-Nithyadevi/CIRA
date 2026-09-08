import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import {
  calculateSIS,
  calculateTopicPerformance,
  calculateStrengthsWeaknesses,
  calculatePriority,
  calculateBenchmark,
  calculateBandHistory,
  calculateSemesterProgression,
  calculateQuizInsights,
  getBand,
} from '../services/analytics.service';

const uid = (req: Request) => (req as any).user?.userId as string;

// GET /api/v1/student/improvement/sis
export const getSIS = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const result = await calculateSIS(userId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    console.error('getSIS error', e);
    res.status(500).json({ error: 'Failed to calculate SIS' });
  }
};

// GET /api/v1/student/improvement/topics
export const getTopics = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await calculateTopicPerformance(userId);
    res.json({ success: true, data });
  } catch (e: any) {
    console.error('getTopics error', e);
    res.status(500).json({ error: 'Failed to fetch topic performance' });
  }
};

// GET /api/v1/student/improvement/strengths-weaknesses
export const getStrengthsWeaknesses = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await calculateStrengthsWeaknesses(userId);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to calculate strengths/weaknesses' });
  }
};

// GET /api/v1/student/improvement/priority
export const getPriority = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await calculatePriority(userId);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to calculate priority' });
  }
};

// GET /api/v1/student/improvement/benchmark
export const getBenchmark = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await calculateBenchmark(userId);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to calculate benchmark' });
  }
};

// GET /api/v1/student/improvement/bands
export const getBands = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await calculateBandHistory(userId);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to calculate band history' });
  }
};

// GET /api/v1/student/improvement/semesters
export const getSemesters = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await calculateSemesterProgression(userId);
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to calculate semester progression' });
  }
};

// GET /api/v1/student/improvement/quiz-insights/:attemptId
export const getQuizInsights = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    const { attemptId } = req.params;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await calculateQuizInsights(attemptId as string, userId);
    if (!data) return res.status(404).json({ error: 'Attempt not found or unauthorized' });
    res.json({ success: true, data });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to load quiz insights' });
  }
};

// ── MISTAKES ─────────────────────────────────────────────────────────────────

// GET /api/v1/student/improvement/mistakes
export const getMistakes = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Get all quiz responses where marks awarded < 50% of question marks
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId, status: { in: ['SUBMITTED', 'EVALUATED'] } },
      include: {
        quiz: { select: { id: true, title: true, answersPublished: true } },
        responses: {
          include: {
            question: { select: { id: true, text: true, topic: true, marks: true, options: true, answerKey: true } },
          },
        },
      },
      orderBy: { startTime: 'desc' },
    });

    const mistakes: any[] = [];
    for (const attempt of attempts) {
      for (const r of attempt.responses) {
        const awarded = r.marksAwarded ?? 0;
        if (awarded < r.question.marks * 0.5) {
          // Check if we already have a StudentMistake record
          const existing = await (prisma as any).studentMistake?.findFirst?.({
            where: { userId, questionId: r.question.id, attemptId: attempt.id },
          });

          mistakes.push({
            id: existing?.id || `${attempt.id}_${r.question.id}`,
            questionId: r.question.id,
            questionText: r.question.text,
            topic: r.question.topic || 'General',
            quizTitle: attempt.quiz.title,
            quizId: attempt.quiz.id,
            attemptId: attempt.id,
            answersPublished: attempt.quiz.answersPublished,
            // Only expose answer key if answers are published
            correctAnswer: attempt.quiz.answersPublished ? r.question.answerKey : null,
            reviewed: existing?.reviewed ?? false,
            reviewedAt: existing?.reviewedAt ?? null,
            date: attempt.startTime,
          });
        }
      }
    }

    // Group by topic
    const grouped: Record<string, any[]> = {};
    for (const m of mistakes) {
      if (!grouped[m.topic]) grouped[m.topic] = [];
      grouped[m.topic].push(m);
    }

    res.json({ success: true, data: { mistakes, grouped, total: mistakes.length } });
  } catch (e: any) {
    console.error('getMistakes error', e);
    res.status(500).json({ error: 'Failed to fetch mistakes' });
  }
};

// PATCH /api/v1/student/improvement/mistakes/:id/review
export const markMistakeReviewed = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    const { questionId, attemptId } = req.body;
    if (!userId || !questionId || !attemptId) return res.status(400).json({ error: 'Missing fields' });

    const existing = await (prisma as any).studentMistake.findFirst({
      where: { userId, questionId, attemptId },
    });

    if (existing) {
      await (prisma as any).studentMistake.update({
        where: { id: existing.id },
        data: { reviewed: true, reviewedAt: new Date() },
      });
    } else {
      await (prisma as any).studentMistake.create({
        data: { userId, questionId, attemptId, quizId: req.body.quizId || '', reviewed: true, reviewedAt: new Date() },
      });
    }

    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to mark as reviewed' });
  }
};

// ── GOALS ─────────────────────────────────────────────────────────────────────

// GET /api/v1/student/improvement/goals
export const getGoals = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const goals = await (prisma as any).studentGoal.findMany({
      where: { userId },
      include: { topic: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: goals });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch goals' });
  }
};

// POST /api/v1/student/improvement/goals
export const createGoal = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { goalType, topicId, description, targetValue, targetDate } = req.body;
    if (!targetValue) return res.status(400).json({ error: 'targetValue is required' });

    const goal = await (prisma as any).studentGoal.create({
      data: {
        userId,
        goalType: goalType || 'TOPIC_SCORE',
        topicId: topicId || null,
        description: description || null,
        targetValue: parseFloat(targetValue),
        targetDate: targetDate ? new Date(targetDate) : null,
      },
    });
    res.status(201).json({ success: true, data: goal });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to create goal' });
  }
};

// PATCH /api/v1/student/improvement/goals/:id
export const updateGoal = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const { status, targetValue, targetDate } = req.body;
    const goal = await (prisma as any).studentGoal.updateMany({
      where: { id, userId },
      data: {
        ...(status && { status }),
        ...(targetValue !== undefined && { targetValue: parseFloat(targetValue) }),
        ...(targetDate && { targetDate: new Date(targetDate) }),
      },
    });
    res.json({ success: true, data: goal });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to update goal' });
  }
};

// ── ACHIEVEMENTS ─────────────────────────────────────────────────────────────

// GET /api/v1/student/improvement/achievements
export const getAchievements = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const earned = await (prisma as any).studentAchievement.findMany({
      where: { userId },
      include: { achievement: true },
      orderBy: { earnedAt: 'desc' },
    });

    // Check for new achievements
    await checkAndAwardAchievements(userId);

    res.json({ success: true, data: earned });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
};

// ── NOTIFICATIONS ─────────────────────────────────────────────────────────────

// GET /api/v1/student/improvement/notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const notifs = await (prisma as any).studentNotification.findMany({
      where: { userId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });
    res.json({ success: true, data: notifs });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
};

// PATCH /api/v1/student/improvement/notifications/:id/read
export const markNotifRead = async (req: Request, res: Response) => {
  try {
    const userId = uid(req);
    const id = req.params.id as string;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    await (prisma as any).studentNotification.updateMany({ where: { id, userId }, data: { read: true } });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
};

// ── LEARNING RESOURCES ───────────────────────────────────────────────────────

// GET /api/v1/student/improvement/resources
export const getResources = async (req: Request, res: Response) => {
  try {
    const { topic } = req.query;
    const where: any = { status: 'PUBLISHED' };
    if (topic) {
      where.topic = { name: { contains: String(topic), mode: 'insensitive' } };
    }
    const resources = await (prisma as any).learningResource.findMany({
      where,
      include: { topic: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ success: true, data: resources });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
};

// ── ACHIEVEMENT ENGINE (rule-based, no AI) ───────────────────────────────────

async function checkAndAwardAchievements(userId: string) {
  try {
    const topics = await calculateTopicPerformance(userId);
    const sw = await calculateStrengthsWeaknesses(userId);

    const RULES = [
      {
        name: 'First Assessment',
        description: 'Completed your first assessment',
        criteria: 'attemptCount >= 1',
        icon: '🎯',
        check: () => topics.length > 0,
      },
      {
        name: 'Mastery',
        description: 'Reached 80%+ in a topic',
        criteria: 'Any topic score >= 80',
        icon: '🏆',
        check: () => sw.strengths.length > 0,
      },
      {
        name: 'Consistency',
        description: 'Completed 5 or more assessments',
        criteria: 'Total assessments >= 5',
        icon: '🔥',
        check: () => topics.reduce((s, t) => s + t.assessmentCount, 0) >= 5,
      },
      {
        name: 'Skill Builder',
        description: 'Showed improvement in 3 different topics',
        criteria: '3+ topics with positive trend',
        icon: '📈',
        check: () => topics.filter(t => t.trend === 'up').length >= 3,
      },
      {
        name: 'Comeback',
        description: 'Improved a weak topic by 15%+',
        criteria: 'Any topic with improvement >= 15',
        icon: '💪',
        check: () => topics.some(t => (t.improvement ?? 0) >= 15),
      },
    ];

    for (const rule of RULES) {
      if (!rule.check()) continue;

      // Ensure achievement record exists
      const ach = await (prisma as any).achievement.upsert({
        where: { name: rule.name },
        update: {},
        create: { name: rule.name, description: rule.description, criteria: rule.criteria, icon: rule.icon },
      });

      // Award if not already earned
      await (prisma as any).studentAchievement.upsert({
        where: { userId_achievementId: { userId, achievementId: ach.id } },
        update: {},
        create: { userId, achievementId: ach.id },
      });
    }
  } catch (e) {
    // Non-critical — don't crash request if achievement check fails
    console.error('Achievement check failed:', e);
  }
}
