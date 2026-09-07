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
    const { id } = req.params;
    const { completed } = req.body;
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
    const { id } = req.params;
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
// ANALYTICS (Mock Data)
// ----------------------------------------------------

export const getTimeline = async (req: Request, res: Response) => {
  res.json([
    { name: 'Sem 3', score: 65 },
    { name: 'Sem 4', score: 72 },
    { name: 'Sem 5', score: 68 },
    { name: 'Sem 6', score: 85 }
  ]);
};

export const getStrengthsWeaknesses = async (req: Request, res: Response) => {
  res.json({
    strengths: [{ topic: 'Data Structures (Trees/Graphs)', score: 89 }, { topic: 'Logical Reasoning', score: 85 }],
    weaknesses: [{ topic: 'System Design', score: 42 }, { topic: 'Verbal Comprehension', score: 55 }]
  });
};

export const getHeatmap = async (req: Request, res: Response) => {
  res.json([
    { topic: 'Aptitude: Quants', s1: 60, s2: 70, s3: 85, s4: 90 },
    { topic: 'DSA: Arrays & Strings', s1: 40, s2: 50, s3: 65, s4: 70 },
    { topic: 'Soft Skills: Leadership', s1: 50, s2: 55, s3: 80, s4: 85 },
    { topic: 'Verbal: Grammar', s1: 45, s2: 60, s3: 65, s4: 80 }
  ]);
};

export const getRadar = async (req: Request, res: Response) => {
  res.json([
    { subject: 'Aptitude', A: 80, fullMark: 100 },
    { subject: 'Soft Skills', A: 85, fullMark: 100 },
    { subject: 'Verbal', A: 70, fullMark: 100 },
    { subject: 'DSA', A: 75, fullMark: 100 },
    { subject: 'Core Subjects', A: 65, fullMark: 100 }
  ]);
};
