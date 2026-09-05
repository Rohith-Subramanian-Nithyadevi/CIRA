import { Router } from 'express';
import { 
  getTasks, createTask, updateTask, deleteTask,
  getCalendarEvents, createCalendarEvent, deleteCalendarEvent,
  getAnnouncements, createAnnouncement, deleteAnnouncement, getAnnouncementResponses
} from '../controllers/faculty-dashboard.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Tasks
router.get('/tasks', authenticate, getTasks);
router.post('/tasks', authenticate, createTask);
router.put('/tasks/:id', authenticate, updateTask);
router.delete('/tasks/:id', authenticate, deleteTask);

// Calendar Events
router.get('/calendar', authenticate, getCalendarEvents);
router.post('/calendar', authenticate, createCalendarEvent);
router.delete('/calendar/:id', authenticate, deleteCalendarEvent);

// Announcements
router.get('/announcements', authenticate, getAnnouncements);
router.post('/announcements', authenticate, createAnnouncement);
router.delete('/announcements/:id', authenticate, deleteAnnouncement);
router.get('/announcements/:id/responses', authenticate, getAnnouncementResponses);

export default router;
