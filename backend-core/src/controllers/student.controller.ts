import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

// ----------------------------------------------------
// TASK PLANNER
// ----------------------------------------------------

export const getTasks = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await (prisma.user as any).findUnique({ where: { id: userId } });
    const tasks = await prisma.studentTask.findMany({
      where: { userId },
      orderBy: { date: 'asc' }
    });
    res.json({ tasks, streak: user?.streak || 0 });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

export const createTask = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { title, description, date, estimatedTime } = req.body;
    
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const newTask = await (prisma.studentTask as any).create({
      data: {
        title,
        description: description || null,
        estimatedTime: estimatedTime || null,
        date: new Date(date),
        userId
      }
    });
    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create task' });
  }
};

export const toggleTask = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const completed = Boolean(req.body.completed);
    const userId = (req as any).user?.userId;

    const task = await prisma.studentTask.update({
      where: { id },
      data: { completed }
    });

    if (completed && userId) {
      const user = await (prisma.user as any).findUnique({ where: { id: userId } });
      if (user) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        let newStreak = user.streak || 0;
        let lastCompleted = user.lastCompletedDate ? new Date(user.lastCompletedDate) : null;
        if (lastCompleted) lastCompleted.setHours(0, 0, 0, 0);

        if (!lastCompleted || lastCompleted.getTime() < today.getTime()) {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          
          if (lastCompleted && lastCompleted.getTime() === yesterday.getTime()) {
            newStreak += 1;
          } else {
            newStreak = 1;
          }
          
          await (prisma.user as any).update({
            where: { id: userId },
            data: { streak: newStreak, lastCompletedDate: new Date() }
          });
        }
      }
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update task' });
  }
};

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    await prisma.studentTask.delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete task' });
  }
};

// ----------------------------------------------------
// DAILY CORE HABITS
// ----------------------------------------------------

export const getHabits = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const habits = await (prisma.studentHabit as any).findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' }
    });
    res.json(habits);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch habits' });
  }
};

export const createHabit = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { title } = req.body;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const habit = await (prisma.studentHabit as any).create({
      data: { title, userId, completedDates: [] }
    });
    res.status(201).json(habit);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create habit' });
  }
};

export const toggleHabit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { date } = req.body; // format 'YYYY-MM-DD'
    const habit = await (prisma.studentHabit as any).findUnique({ where: { id } });
    if (!habit) return res.status(404).json({ error: 'Not found' });
    
    let dates: string[] = Array.isArray(habit.completedDates) ? habit.completedDates : [];
    if (dates.includes(date)) {
      dates = dates.filter(d => d !== date);
    } else {
      dates.push(date);
    }
    const updated = await (prisma.studentHabit as any).update({
      where: { id },
      data: { completedDates: dates }
    });
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to toggle habit' });
  }
};

export const deleteHabit = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await (prisma.studentHabit as any).delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete habit' });
  }
};

// ----------------------------------------------------
// CALENDAR EVENTS
// ----------------------------------------------------

export const getCalendarEvents = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const events = await (prisma.studentCalendarEvent as any).findMany({
      where: { userId },
      orderBy: { date: 'asc' }
    });
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch calendar events' });
  }
};

export const createCalendarEvent = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { title, date } = req.body;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const newEvent = await (prisma.studentCalendarEvent as any).create({
      data: {
        title,
        date: new Date(date),
        userId
      }
    });
    res.status(201).json({ success: true, data: newEvent });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create calendar event' });
  }
};

export const deleteCalendarEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await (prisma.studentCalendarEvent as any).delete({ where: { id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete calendar event' });
  }
};

// ----------------------------------------------------
// RESOURCE HUB
// ----------------------------------------------------

export const getResources = async (req: Request, res: Response) => {
  try {
    const resources = await prisma.resource.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch resources' });
  }
};

// ----------------------------------------------------
// ANALYTICS (Real Data from Quiz Attempts)
// ----------------------------------------------------

export const getTimeline = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Get all submitted attempts ordered by date, group by quiz
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId, status: 'SUBMITTED' },
      include: { quiz: { select: { title: true, totalMarks: true } } },
      orderBy: { startTime: 'asc' }
    });

    if (attempts.length === 0) {
      // Return empty but valid shape
      return res.json([]);
    }

    // Group by month (or quiz) and compute average score %
    const grouped: Record<string, { total: number; count: number }> = {};
    attempts.forEach(a => {
      const d = new Date(a.startTime);
      const key = `${d.toLocaleString('default', { month: 'short' })} '${String(d.getFullYear()).slice(2)}`;
      if (!grouped[key]) grouped[key] = { total: 0, count: 0 };
      const maxMarks = a.quiz?.totalMarks || 100;
      const pct = maxMarks > 0 ? Math.round((a.totalScore / maxMarks) * 100) : 0;
      grouped[key].total += pct;
      grouped[key].count += 1;
    });

    const result = Object.entries(grouped).map(([name, { total, count }]) => ({
      name,
      score: Math.round(total / count)
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch timeline' });
  }
};

export const getStrengthsWeaknesses = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Get all responses the student has answered, join with question topic + marks
    const responses = await prisma.quizResponse.findMany({
      where: { attempt: { userId }, marksAwarded: { not: null } },
      include: {
        question: { select: { topic: true, marks: true } }
      }
    });

    if (responses.length === 0) {
      return res.json({ strengths: [], weaknesses: [] });
    }

    // Aggregate by topic: sum marks awarded / sum max marks → percentage
    const topicMap: Record<string, { earned: number; max: number }> = {};
    responses.forEach(r => {
      const topic = r.question.topic || 'General';
      if (!topicMap[topic]) topicMap[topic] = { earned: 0, max: 0 };
      topicMap[topic].earned += r.marksAwarded || 0;
      topicMap[topic].max += r.question.marks || 1;
    });

    const topics = Object.entries(topicMap)
      .filter(([_, v]) => v.max > 0)
      .map(([topic, { earned, max }]) => ({
        topic,
        score: Math.round((earned / max) * 100)
      }))
      .sort((a, b) => b.score - a.score);

    const strengths = topics.filter(t => t.score >= 70).slice(0, 3);
    const weaknesses = topics.filter(t => t.score < 70).slice(-3).reverse();

    res.json({ strengths, weaknesses });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch strengths/weaknesses' });
  }
};

export const getHeatmap = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Group attempts by quarter (3-month window) as a proxy for "semester"
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId, status: 'SUBMITTED' },
      include: {
        responses: {
          where: { marksAwarded: { not: null } },
          include: { question: { select: { topic: true, marks: true } } }
        }
      },
      orderBy: { startTime: 'asc' }
    });

    if (attempts.length === 0) {
      return res.json([]);
    }

    // Build map: topic → [{ period, score }]
    const topicPeriods: Record<string, Record<string, { earned: number; max: number }>> = {};
    attempts.forEach(a => {
      const d = new Date(a.startTime);
      const q = `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
      a.responses.forEach(r => {
        const topic = r.question.topic || 'General';
        if (!topicPeriods[topic]) topicPeriods[topic] = {};
        if (!topicPeriods[topic][q]) topicPeriods[topic][q] = { earned: 0, max: 0 };
        topicPeriods[topic][q].earned += r.marksAwarded || 0;
        topicPeriods[topic][q].max += r.question.marks || 1;
      });
    });

    // Get up to 4 most recent periods
    const allPeriods = [...new Set(
      attempts.map(a => {
        const d = new Date(a.startTime);
        return `Q${Math.ceil((d.getMonth() + 1) / 3)} ${d.getFullYear()}`;
      })
    )].slice(-4);

    const result = Object.entries(topicPeriods).slice(0, 6).map(([topic, periods]) => {
      const row: any = { topic };
      const keys = ['s1', 's2', 's3', 's4'];
      allPeriods.forEach((p, i) => {
        const data = periods[p];
        row[keys[i]] = data ? Math.round((data.earned / data.max) * 100) : 0;
      });
      // Fill missing periods with 0
      keys.forEach(k => { if (row[k] === undefined) row[k] = 0; });
      return row;
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch heatmap' });
  }
};

export const getRadar = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const responses = await prisma.quizResponse.findMany({
      where: { attempt: { userId }, marksAwarded: { not: null } },
      include: { question: { select: { topic: true, marks: true } } }
    });

    if (responses.length === 0) {
      return res.json([]);
    }

    const topicMap: Record<string, { earned: number; max: number }> = {};
    responses.forEach(r => {
      const raw = r.question.topic || 'General';
      // Normalize topic to high-level category
      let subject = 'General';
      if (/dsa|algorithm|data struct|tree|graph|array|string|dp|linked/i.test(raw)) subject = 'DSA';
      else if (/aptitude|quant|math|logical|reasoning/i.test(raw)) subject = 'Aptitude';
      else if (/verbal|grammar|english|comprehension|vocab/i.test(raw)) subject = 'Verbal';
      else if (/soft skill|leadership|communication|teamwork|group/i.test(raw)) subject = 'Soft Skills';
      else subject = 'Core Subjects';

      if (!topicMap[subject]) topicMap[subject] = { earned: 0, max: 0 };
      topicMap[subject].earned += r.marksAwarded || 0;
      topicMap[subject].max += r.question.marks || 1;
    });

    const result = Object.entries(topicMap).map(([subject, { earned, max }]) => ({
      subject,
      A: Math.round((earned / max) * 100),
      fullMark: 100
    }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch radar' });
  }
};

export const getBenchmark = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    // Get all responses grouped by topic for this student AND all students
    const allResponses = await prisma.quizResponse.findMany({
      where: { marksAwarded: { not: null } },
      include: {
        question: { select: { topic: true, marks: true } },
        attempt: { select: { userId: true } }
      }
    });

    if (allResponses.length === 0) return res.json([]);

    const topicMap: Record<string, { myEarned: number; myMax: number; allEarned: number; allMax: number; maxScores: number[] }> = {};
    
    allResponses.forEach(r => {
      const topic = r.question.topic || 'General';
      if (!topicMap[topic]) topicMap[topic] = { myEarned: 0, myMax: 0, allEarned: 0, allMax: 0, maxScores: [] };
      const marks = r.question.marks || 1;
      const pct = ((r.marksAwarded || 0) / marks) * 100;
      topicMap[topic].allEarned += r.marksAwarded || 0;
      topicMap[topic].allMax += marks;
      topicMap[topic].maxScores.push(pct);
      if (r.attempt.userId === userId) {
        topicMap[topic].myEarned += r.marksAwarded || 0;
        topicMap[topic].myMax += marks;
      }
    });

    const result = Object.entries(topicMap)
      .filter(([_, v]) => v.myMax > 0)
      .slice(0, 5)
      .map(([topic, v]) => ({
        topic,
        you: Math.round((v.myEarned / v.myMax) * 100),
        classAvg: Math.round((v.allEarned / v.allMax) * 100),
        topper: Math.min(100, Math.round(Math.max(...v.maxScores)))
      }));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch benchmark' });
  }
};

export const getDistribution = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const attempts = await prisma.quizAttempt.findMany({
      where: { userId, status: 'SUBMITTED' },
      include: { quiz: { select: { totalMarks: true } } }
    });

    const buckets: Record<string, number> = {
      '0-20': 0, '21-40': 0, '41-60': 0, '61-70': 0,
      '71-80': 0, '81-90': 0, '91-100': 0
    };

    attempts.forEach(a => {
      const max = a.quiz?.totalMarks || 100;
      const pct = max > 0 ? (a.totalScore / max) * 100 : 0;
      if (pct <= 20) buckets['0-20']++;
      else if (pct <= 40) buckets['21-40']++;
      else if (pct <= 60) buckets['41-60']++;
      else if (pct <= 70) buckets['61-70']++;
      else if (pct <= 80) buckets['71-80']++;
      else if (pct <= 90) buckets['81-90']++;
      else buckets['91-100']++;
    });

    res.json(Object.entries(buckets).map(([range, count]) => ({ range, count })));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch distribution' });
  }
};

// ---------------------------------------------------------
// Profile and Announcements (Added)
// ---------------------------------------------------------
export const updateProfile = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    
    const { name, phone, rollNumber, departmentId, sectionId } = req.body;
    
    // Only update fields that are provided
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (rollNumber !== undefined) data.rollNumber = rollNumber;
    if (departmentId !== undefined) data.departmentId = departmentId;
    if (sectionId !== undefined) data.sectionId = sectionId === 'all' ? null : sectionId;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data
    });
    
    res.json({ success: true, data: updatedUser });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
};

export const getAnnouncements = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        department: true,
        section: true
      }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Build audiences the student belongs to
    const audiences = ['ALL'];
    if (user.department?.name) audiences.push(user.department.name);
    if (user.section?.name) audiences.push(user.section.name);
    // Some announcements might just target the department ID or section ID instead of name. Let's add them too just in case.
    if (user.departmentId) audiences.push(user.departmentId);
    if (user.sectionId) audiences.push(user.sectionId);

    const announcements = await prisma.announcement.findMany({
      where: {
        audience: { in: audiences }
      },
      include: {
        faculty: {
          select: { name: true }
        }
      },
      orderBy: { date: 'desc' },
      take: 20
    });

    res.json({ success: true, data: announcements });
  } catch (error) {
    console.error('Error fetching announcements:', error);
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
};
