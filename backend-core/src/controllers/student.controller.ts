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
    const { title, description, date } = req.body;
    
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const newTask = await (prisma.studentTask as any).create({
      data: {
        title,
        description: description || null,
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
