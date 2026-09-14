# CIRA — Student Improvement System
## Technical Documentation
**Date:** 7 September 2026  
**Session:** Full-stack implementation  
**Status:** ✅ Deployed — all TypeScript checks pass, schema pushed to production DB

---

## Table of Contents

1. [Overview](#1-overview)
2. [Architecture Summary](#2-architecture-summary)
3. [Database Schema Changes](#3-database-schema-changes)
4. [Mathematics — Student Improvement Score (SIS)](#4-mathematics--student-improvement-score-sis)
5. [Mathematics — Supporting Algorithms](#5-mathematics--supporting-algorithms)
6. [API Endpoints](#6-api-endpoints)
7. [Frontend Components](#7-frontend-components)
8. [Bug Fixes](#8-bug-fixes)
9. [What Was Not Changed](#9-what-was-not-changed)
10. [File Index](#10-file-index)

---

## 1. Overview

CIRA's Student Improvement System (SIS) is a **rule-based, non-AI analytics layer** that helps a student answer:

> *Where am I? What changed? What am I weak at? What should I do next?*

It computes metrics deterministically from quiz attempt data already stored in the database. No machine learning, no LLM — only aggregations, weighted formulas, and threshold rules.

---

## 2. Architecture Summary

```
Frontend (React/TSX)
│
├── Overview Tab        ← StudentSpace.tsx       (SIS ring, strengths, priority)
├── My Improvement Tab  ← StudentImprovement.tsx  (SIS detail, semesters, bands)
├── Topic Skills Tab    ← TopicPerformance.tsx    (per-topic mastery, trends)
├── Mistake Notebook    ← MistakeNotebook.tsx     (wrong answers, mark reviewed)
└── My Goals Tab        ← GoalTracker.tsx         (CRUD goals with progress)
          │
          │ REST API calls
          ▼
Backend (Node.js / Express / TypeScript)
│
├── student-improvement.routes.ts     ← route definitions
├── student-improvement.controller.ts ← request handlers
└── analytics.service.ts              ← core math engine
          │
          │ Prisma queries
          ▼
PostgreSQL (Neon DB)
├── QuizAttempt, QuizResponse, Question   ← existing (read-only by SIS)
├── Topic, Subject, Subtopic              ← NEW
├── StudentGoal, StudentMistake           ← NEW
├── Achievement, StudentAchievement       ← NEW
└── StudentNotification, LearningResource ← NEW
```

---

## 3. Database Schema Changes

> All changes are **purely additive** — no existing columns or tables were deleted or modified.

### 3.1 Modified Models

#### `Question` — field added (backward compatible)
```prisma
model Question {
  // ... all existing fields unchanged ...
  topic     String?   // EXISTING free-text tag still works
  topicId   String?   // NEW: optional FK to Topic model
  topicRef  Topic?    @relation("QuestionTopic", fields: [topicId], references: [id])
}
```

#### `User` — relations added
Four new relations:
- `studentGoals`          → `StudentGoal[]`
- `studentMistakes`       → `StudentMistake[]`
- `studentAchievements`   → `StudentAchievement[]`
- `studentNotifications`  → `StudentNotification[]`

---

### 3.2 New Models

#### `Subject`
Represents an academic subject (e.g., "Data Structures").

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | String | e.g., "Data Structures" |
| `code` | String? | e.g., "CS301" (unique) |
| `description` | String? | Optional |

---

#### `Topic`
A specific topic within a subject (e.g., "Binary Trees").

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | String | e.g., "Binary Trees" |
| `subjectId` | String? | FK → Subject (optional) |

Unique constraint: `(name, subjectId)` — topic names are unique per subject.

---

#### `Subtopic`
Optional third-level granularity (e.g., "AVL Trees").

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | String | e.g., "AVL Trees" |
| `topicId` | String | FK → Topic (required) |

---

#### `LearningResource`
Richer resource records with structured metadata.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `title` | String | Resource title |
| `type` | Enum | PDF, ARTICLE, VIDEO, PRACTICE, REFERENCE, LINK |
| `topicId` | String? | FK → Topic |
| `difficulty` | String? | BEGINNER / INTERMEDIATE / ADVANCED |
| `estimatedMinutes` | Int? | Estimated reading/watch time |
| `status` | Enum | DRAFT / PUBLISHED / ARCHIVED |

---

#### `StudentGoal`
A student-created improvement target.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | String | FK → User |
| `goalType` | Enum | TOPIC_SCORE, SUBJECT_SCORE, SIS_SCORE, PERFORMANCE_BAND |
| `topicId` | String? | FK → Topic (optional) |
| `currentValue` | Float | Current measured value |
| `targetValue` | Float | Set by student |
| `targetDate` | DateTime? | Optional deadline |
| `status` | Enum | ACTIVE, COMPLETED, EXPIRED, PAUSED |

---

#### `StudentMistake`
Records a question where the student scored < 50% of available marks.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `userId` | String | FK → User |
| `questionId` | String | The question that was answered wrongly |
| `attemptId` | String | The specific quiz attempt |
| `quizId` | String | The quiz |
| `topicId` | String? | FK → Topic |
| `reviewed` | Boolean | Whether student has reviewed it |
| `reviewedAt` | DateTime? | Timestamp of review |

---

#### `Achievement` + `StudentAchievement`
Badge definitions and per-student awards.

| Field | Notes |
|---|---|
| `name` | Unique badge name |
| `description` | Human-readable description |
| `criteria` | Rule description (for display) |
| `icon` | Emoji representation |

`StudentAchievement` has unique constraint on `(userId, achievementId)` — no duplicate awards.

---

#### `StudentNotification`
In-app notifications for students.

| Field | Type | Notes |
|---|---|---|
| `type` | Enum | ASSESSMENT, PERFORMANCE, STUDY, ACHIEVEMENT, SYSTEM |
| `priority` | Int | Higher = shown first |
| `read` | Boolean | Read/unread state |

---

## 4. Mathematics — Student Improvement Score (SIS)

The SIS is a **single composite number (0–100)** representing a student's holistic improvement trajectory. It is **not** a snapshot of the latest score — it rewards growth, consistency, and recovery from weak results.

### 4.1 Master Formula

```
SIS = clamp( C_p × 0.35  +  C_i × 0.30  +  C_m × 0.20  +  C_c × 0.10  +  C_r × 0.05,  0,  100 )
```

| Component | Symbol | Weight | Description |
|---|---|---|---|
| Current Performance | C_p | **35%** | Recency-weighted average of recent scores |
| Improvement | C_i | **30%** | Directional change in score over time |
| Topic Mastery | C_m | **20%** | Average mastery across all attempted topics |
| Consistency | C_c | **10%** | Low score variance = high consistency |
| Recovery | C_r | **5%** | Rewarded for improving after low bands |

---

### 4.2 C_p — Current Performance (35%)

Takes the most recent 30% of attempts and averages their percentage scores:

```
n_recent = max(1, ceil(N × 0.30))

C_p = clamp(
    (1 / n_recent) × Σ pct_i   for i in last n_recent attempts
, 0, 100)

where pct_i = (totalScore_i / totalMarks_i) × 100
```

**Why 30%:** Using a recency window prevents a student's early poor scores from permanently dragging down their SIS after they've improved.

---

### 4.3 C_i — Improvement (30%)

Compares the average of early attempts vs recent attempts:

```
first_half  = attempts[0 .. ceil(N/2) - 1]
second_half = attempts[ceil(N/2) .. N-1]

avg_early  = (1/|first_half|)  × Σ pct in first_half
avg_recent = (1/|second_half|) × Σ pct in second_half

delta = avg_recent - avg_early       ∈ [-100, +100]

C_i = clamp(50 + delta × 2.5, 0, 100)
```

**Mapping table:**

| delta (improvement %) | C_i |
|---|---|
| +20 | 100 (max) |
| +10 | 75 |
| 0 | 50 (neutral) |
| −10 | 25 |
| −20 | 0 (min) |

**Edge case:** N < 2 attempts → C_i = 50 (neutral; insufficient history).

---

### 4.4 C_m — Topic Mastery (20%)

Builds an aggregate score map across **all** attempts:

```
For each attempt a, for each response r in a:
    topic_key = r.question.topic  (or "General" if null)
    topicMap[topic_key].earned += r.marksAwarded
    topicMap[topic_key].total  += r.question.marks

topic_pct[t] = (topicMap[t].earned / topicMap[t].total) × 100

C_m = clamp( mean( topic_pct[t] for all t in topicMap ), 0, 100 )
```

**Why aggregate (not just latest):** A student is "mastering" a topic only if they've demonstrated it repeatedly — a single quiz can be a fluke.

---

### 4.5 C_c — Consistency (10%)

Uses population variance of all attempt percentage scores:

```
μ = (1/N) × Σ pct_i

σ² = (1/N) × Σ (pct_i - μ)²

C_c = clamp(100 - σ²/4, 0, 100)
```

**Calibration:**

| σ² (variance) | C_c | Interpretation |
|---|---|---|
| 0 | 100 | Perfectly consistent |
| 100 | 75 | Low variance |
| 200 | 50 | Moderate variance |
| 400 | 0 | Extreme variance (e.g., 20%, 80% alternating) |

The divisor **4** calibrates so that the maximum realistic variance (~400) maps to C_c = 0.

**Edge case:** N < 2 → C_c = 70 (slightly positive neutral).

---

### 4.6 C_r — Recovery (5%)

Rewards the student for improving their performance band after a poor result:

```
bandRank = { POOR: 0, AVERAGE: 1, GOOD: 2, EXCELLENT: 3 }

score = 50   // start at neutral

for i = 1 to N-1:
    rise = bandRank[band(pct_i)] − bandRank[band(pct_{i−1})]
    
    if rise > 0:   score = min(100, score + rise × 15)   // recovery reward
    if rise < 0:   score = max(0,   score + rise × 5)    // small decline penalty

C_r = clamp(score, 0, 100)
```

**Asymmetry design:** Reward multiplier (×15) > penalty multiplier (×5).  
Rationale: Recovery is harder than declining — a student who bounces from POOR → EXCELLENT deserves a large boost.

---

### 4.7 SIS Interpretation

| SIS | Label | Meaning |
|---|---|---|
| 75–100 | **Strong** | Improving, consistent, mastering topics |
| 55–74 | **Developing** | Good foundation but growth needed |
| 0–54 | **Needs Focus** | Inconsistent, declining, or sparse data |

---

## 5. Mathematics — Supporting Algorithms

### 5.1 Topic Trend Detection

For each topic, ordered percentage scores are tracked across assessments:

```
scores[t] = [p₁, p₂, ..., pₖ]   (chronological)

current_score  = pₖ
previous_score = pₖ₋₁   (if k ≥ 2)

improvement = current_score − previous_score

trend = "up"     if improvement > +2
        "down"   if improvement < −2
        "stable" otherwise
```

The ±2% threshold avoids marking noise as a trend.

---

### 5.2 Mastery Classification (Thresholds)

```
masteryLabel(score) =
    "Strong"             if score ≥ 80
    "Developing"         if score ≥ 65
    "Needs Improvement"  otherwise
```

---

### 5.3 Priority Topic — Urgency Scoring

All topics with score < 65% are evaluated:

```
urgencyScore(t) = 0

if t.score < 50:               urgencyScore += 3   // critically low
elif t.score < 65:             urgencyScore += 2   // below proficiency

if t.trend == "down":          urgencyScore += 2   // declining

if t.assessmentCount ≥ 3
   AND t.score < 65:           urgencyScore += 1   // persistently weak

urgencyLevel =
    HIGH   if urgencyScore ≥ 4
    MEDIUM if urgencyScore ≥ 2
    LOW    otherwise

priority_topic = argmax(urgencyScore)  over all weak topics
```

Pure rule-based prioritisation — no ML.

---

### 5.4 Benchmark (Anonymous Peer Comparison)

```
For each topic t in student's top 6 topics:

    you(t) = student's current topic percentage

    classScores(t) = { pct_t(s) : s ≠ student, s sat same quiz set }

    classAvg(t) = mean(classScores(t))   or 0 if empty
    topper(t)   = max(classScores(t))    or 0 if empty
```

Only aggregates are computed. No individual peer scores are exposed.

---

### 5.5 Performance Band Distribution

```
band(pct) =
    EXCELLENT  if pct ≥ 85
    GOOD       if pct ≥ 65
    AVERAGE    if pct ≥ 45
    POOR       otherwise

counts = {
    excellent: |{a : band(pct_a) = EXCELLENT}|,
    good:      |{a : band(pct_a) = GOOD}|,
    average:   |{a : band(pct_a) = AVERAGE}|,
    poor:      |{a : band(pct_a) = POOR}|
}
```

**Trend sentence (N ≥ 4):**
```
earlyGoodPlus_rate  = |{a in first half  : band ∈ {GOOD, EXCELLENT}}| / |first half|
recentGoodPlus_rate = |{a in second half : band ∈ {GOOD, EXCELLENT}}| / |second half|

if recentGoodPlus_rate > earlyGoodPlus_rate + 0.20:
    → "You have moved from mostly AVERAGE/POOR to GOOD/EXCELLENT. Great improvement!"
elif recentGoodPlus_rate < earlyGoodPlus_rate − 0.20:
    → "Your recent results have declined. Focus on weak topics now."
else:
    → "Your performance band is consistent across assessments."
```

---

### 5.6 Semester Grouping (No Schema Field Required)

```
semester(a) =
    "{year(a.startTime)}-S1"   if month(a.startTime) ∈ {1, 2, 3, 4, 5, 6}
    "{year(a.startTime)}-S2"   if month(a.startTime) ∈ {7, 8, 9, 10, 11, 12}

For each semester s (sorted chronologically):
    averageScore(s)  = mean(pct_a : a ∈ s)
    assessmentCount(s) = |{a : a ∈ s}|
    improvement(s)   = averageScore(s) − averageScore(prev semester)
                       (null for the first semester)
```

---

### 5.7 Mistake Detection

```
isMistake(response r) ⟺ r.marksAwarded < 0.50 × r.question.marks
```

The 50% threshold captures partial-credit mistakes, not just zero-scored ones.

**Answer visibility rule:**
```
showCorrectAnswer(r) ⟺ r.quiz.answersPublished = true
```
Respects faculty control — answer key is never shown before faculty publishes it.

---

### 5.8 Achievement Rules

| Achievement | Formal Condition |
|---|---|
| First Assessment | `|topics| > 0` (at least 1 graded attempt exists) |
| Mastery | `∃ t : topic_pct[t] ≥ 80` |
| Consistency | `Σ t.assessmentCount ≥ 5` |
| Skill Builder | `|{t : trend(t) = "up"}| ≥ 3` |
| Comeback | `∃ t : improvement(t) ≥ 15` |

Checked on every `/achievements` call; fully idempotent (upsert pattern).

---

## 6. API Endpoints

All under `/api/v1/student/improvement/` — JWT required.

| Method | Path | Response |
|---|---|---|
| GET | `/sis` | `{ sis, components, insufficientData, trend, latestScore, attemptCount }` |
| GET | `/topics` | `TopicPerf[]` sorted by score desc |
| GET | `/strengths-weaknesses` | `{ strengths, weaknesses }` |
| GET | `/priority` | `{ topic, score, reasons[], urgency }` or null |
| GET | `/benchmark` | `{ topic, you, classAvg, topper }[]` |
| GET | `/bands` | `{ total, excellent, good, average, poor, trend }` |
| GET | `/semesters` | `SemesterSummary[]` |
| GET | `/quiz-insights/:attemptId` | `{ topicBreakdown, classAvg, strengths, weaknesses, mistakes }` |
| GET | `/mistakes` | `{ mistakes[], grouped{}, total }` |
| PATCH | `/mistakes/:id/review` | `{ success: true }` |
| GET | `/goals` | `Goal[]` |
| POST | `/goals` | Created goal |
| PATCH | `/goals/:id` | Updated goal |
| GET | `/achievements` | `StudentAchievement[]` (also triggers check) |
| GET | `/notifications` | `StudentNotification[]` (priority-sorted) |
| PATCH | `/notifications/:id/read` | `{ success: true }` |
| GET | `/resources?topic=` | `LearningResource[]` |

---

## 7. Frontend Components

### 7.1 StudentSpace.tsx — Overview Tab

| Section | Source endpoint | What it renders |
|---|---|---|
| SIS Ring | `/sis` | SVG ring animation, score, trend badge |
| SIS Breakdown | `/sis` | 5 mini progress bars (one per component) |
| Stats row | `/sis` | Latest %, attempt count, improvement Δ |
| Strengths | `/topics` | Top topics ≥ 80%, ranked with bars |
| Weaknesses | `/topics` | Topics < 65%, colour-coded by severity |
| Priority card | `/priority` | Next focus topic + urgency + reasons |
| Achievements | `/achievements` | Last 3 badges earned |
| Empty state | `/sis` | Shown when < 3 attempts |

---

### 7.2 StudentImprovement.tsx — My Improvement Tab

| Section | Chart type |
|---|---|
| SIS large number + breakdown | 5 labelled bars |
| Semester journey | Recharts AreaChart with gradient |
| Performance bands | Recharts horizontal BarChart |
| Peer benchmark | Grouped horizontal bars |
| Next priority action | Rule-based recommendation cards |

---

### 7.3 TopicPerformance.tsx — Topic Skills Tab

- Topics grouped into: **Strong (≥80%)**, **Developing (65–79%)**, **Needs Improvement (<65%)**
- Each card: score, trend icon (▲/▼/—), mastery badge, progress bar
- Expanded: previous score, assessment count, last date, recommendation if weak

---

### 7.4 MistakeNotebook.tsx — Mistake Notebook Tab

- Mistakes grouped by topic with per-topic review progress bar
- Each mistake: quiz name, date, question text
- Correct answer: shown **only** if `quiz.answersPublished = true`
- "Mark Reviewed" → PATCH request → optimistic re-fetch

---

### 7.5 GoalTracker.tsx — My Goals Tab

- Create form: type, description, target %, deadline
- Cards show: progress bar, days left, Pause / Mark Complete buttons
- Active and Past sections

---

## 8. Bug Fixes

### TypeScript TS2322 — student.controller.ts

**Location:** Lines 53 (toggleTask) and 94 (deleteTask)

**Error:**
```
Type 'string | string[]' is not assignable to type 'string | undefined'
```

**Fix:**
```typescript
// Before
const { id } = req.params;
const { completed } = req.body;

// After
const id = req.params.id as string;
const completed = Boolean(req.body.completed);
```

---

## 9. What Was Not Changed

| System | Status |
|---|---|
| Auth (login, JWT, roles) | ✅ Intact |
| Admin dashboard | ✅ Intact |
| Faculty dashboard, reports | ✅ Intact |
| Quiz creation / management | ✅ Intact |
| Quiz taking (ExamInterface) | ✅ Intact |
| Quiz grading (objective + written) | ✅ Intact |
| Assignment submission / grading | ✅ Intact |
| Exam portal routes | ✅ Intact |
| StudyPlanner (Pomodoro, habits, tasks) | ✅ Intact |
| StudentAnalytics (9-chart dashboard) | ✅ Intact |
| ResourceHub | ✅ Intact |

---

## 10. File Index

### New Files

| Path | Purpose |
|---|---|
| `backend-core/src/services/analytics.service.ts` | Core math engine |
| `backend-core/src/controllers/student-improvement.controller.ts` | 18 route handlers |
| `backend-core/src/routes/student-improvement.routes.ts` | Route definitions |
| `frontend-web/src/components/student/StudentImprovement.tsx` | My Improvement tab |
| `frontend-web/src/components/student/TopicPerformance.tsx` | Topic Skills tab |
| `frontend-web/src/components/student/MistakeNotebook.tsx` | Mistake Notebook tab |
| `frontend-web/src/components/student/GoalTracker.tsx` | My Goals tab |

### Modified Files

| Path | What changed |
|---|---|
| `backend-core/prisma/schema.prisma` | +8 new models, +topicId on Question, +4 User relations |
| `backend-core/src/app.ts` | +import + route registration |
| `backend-core/src/controllers/student.controller.ts` | Fixed 2 TypeScript errors |
| `frontend-web/src/components/DashboardLayout.tsx` | +4 new student nav items |
| `frontend-web/src/components/dashboard/StudentSpace.tsx` | Full rewrite |
| `frontend-web/src/pages/StudentDashboard.tsx` | +4 new tab imports and renders |

---

## Validation

| Check | Result |
|---|---|
| Frontend TypeScript (`npx tsc --noEmit`) | ✅ Exit 0 — 0 errors |
| Backend TypeScript (`npx tsc --noEmit`) | ✅ Exit 0 — 0 errors |
| Schema push (`npx prisma db push`) | ✅ Exit 0 — synced in 6.29 s |

---

*CIRA — Continuous Improvement and Results Analysis*  
*Documentation generated: 2026-09-07 21:14 IST*
