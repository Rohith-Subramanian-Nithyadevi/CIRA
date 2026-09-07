import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Task Management
export const getTasks = async (req: Request, res: Response) => {
  try {
    const facultyId = (req as any).user.userId;
    const tasks = await prisma.task.findMany({
      where: { facultyId },
      orderBy: { date: 'asc' }
    });
    res.json({ success: true, data: tasks });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createTask = async (req: Request, res: Response) => {
  try {
    const facultyId = (req as any).user.userId;
    const { task, date } = req.body;
    const newTask = await prisma.task.create({
      data: {
        task,
        date: new Date(date),
        facultyId
      }
    });
    res.json({ success: true, data: newTask });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const updateTask = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const facultyId = (req as any).user.userId;
    const { completed } = req.body;
    
    // verify ownership
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing || existing.facultyId !== facultyId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const updatedTask = await prisma.task.update({
      where: { id },
      data: { completed }
    });
    res.json({ success: true, data: updatedTask });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteTask = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const facultyId = (req as any).user.userId;
    
    const existing = await prisma.task.findUnique({ where: { id } });
    if (!existing || existing.facultyId !== facultyId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await prisma.task.delete({ where: { id } });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// Calendar Management
export const getCalendarEvents = async (req: Request, res: Response) => {
  try {
    const facultyId = (req as any).user.userId;
    const events = await prisma.calendarEvent.findMany({
      where: { facultyId },
      orderBy: { date: 'asc' }
    });
    res.json({ success: true, data: events });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createCalendarEvent = async (req: Request, res: Response) => {
  try {
    const facultyId = (req as any).user.userId;
    const { title, date } = req.body;
    const newEvent = await prisma.calendarEvent.create({
      data: {
        title,
        date: new Date(date),
        facultyId
      }
    });
    res.json({ success: true, data: newEvent });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteCalendarEvent = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const facultyId = (req as any).user.userId;
    
    const existing = await prisma.calendarEvent.findUnique({ where: { id } });
    if (!existing || existing.facultyId !== facultyId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await prisma.calendarEvent.delete({ where: { id } });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};


// Announcement Management
export const getAnnouncements = async (req: Request, res: Response) => {
  try {
    const facultyId = (req as any).user.userId;
    
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;

    if (hasPagination) {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const [total, announcements] = await prisma.$transaction([
        prisma.announcement.count({ where: { facultyId } }),
        prisma.announcement.findMany({
          where: { facultyId },
          orderBy: { date: 'desc' },
          include: {
            _count: {
              select: { responses: true }
            }
          },
          skip,
          take: limit
        })
      ]);

      const hasMore = skip + announcements.length < total;
      res.json({ success: true, data: { items: announcements, total, page, hasMore } });
    } else {
      const announcements = await prisma.announcement.findMany({
        where: { facultyId },
        orderBy: { date: 'desc' },
        include: {
          _count: {
            select: { responses: true }
          }
        }
      });
      res.json({ success: true, data: announcements });
    }
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const createAnnouncement = async (req: Request, res: Response) => {
  try {
    const facultyId = (req as any).user.userId;
    const { title, content, isSurvey, audience, date } = req.body;
    const newAnn = await prisma.announcement.create({
      data: {
        title,
        content,
        isSurvey: isSurvey || false,
        audience: audience || 'ALL',
        date: date ? new Date(date) : new Date(),
        facultyId
      }
    });
    res.json({ success: true, data: newAnn });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteAnnouncement = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const facultyId = (req as any).user.userId;
    
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing || existing.facultyId !== facultyId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await prisma.announcement.delete({ where: { id } });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getAnnouncementResponses = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const facultyId = (req as any).user.userId;
    
    const existing = await prisma.announcement.findUnique({ where: { id } });
    if (!existing || existing.facultyId !== facultyId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    const responses = await prisma.announcementResponse.findMany({
      where: { announcementId: id },
      include: {
        user: { select: { id: true, name: true, rollNumber: true } }
      }
    });
    res.json({ success: true, data: responses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Notifications
export const getNotifications = async (req: Request, res: Response) => {
  try {
    const facultyId = (req as any).user.userId;
    const notifications = await prisma.notification.findMany({
      where: { facultyId },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
    res.json({ success: true, data: notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const markNotificationRead = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const facultyId = (req as any).user.userId;

    const existing = await prisma.notification.findUnique({ where: { id } });
    if (!existing || existing.facultyId !== facultyId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await prisma.notification.update({ where: { id }, data: { read: true } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
