import { Router } from 'express';
import { 
  getTasks, createTask, updateTask, deleteTask,
  getCalendarEvents, createCalendarEvent, deleteCalendarEvent,
  getAnnouncements, createAnnouncement, deleteAnnouncement, getAnnouncementResponses,
  getNotifications, markNotificationRead
} from '../controllers/faculty-dashboard.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { attachFacultyScope } from '../middlewares/faculty-scope.middleware';
import { createPoll, getPollResults, getPollTargets, listPolls } from '../controllers/announcement-poll.controller';

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
router.get('/announcements/polls/targets', authenticate, authorize(['FACULTY', 'ADMIN']), attachFacultyScope, getPollTargets);
router.get('/announcements/polls', authenticate, authorize(['FACULTY', 'ADMIN']), attachFacultyScope, listPolls);
router.post('/announcements/polls', authenticate, authorize(['FACULTY', 'ADMIN']), attachFacultyScope, createPoll);
router.get('/announcements/polls/:id/results', authenticate, authorize(['FACULTY', 'ADMIN']), attachFacultyScope, getPollResults);
router.get('/announcements', authenticate, getAnnouncements);
router.post('/announcements', authenticate, createAnnouncement);
router.delete('/announcements/:id', authenticate, deleteAnnouncement);
router.get('/announcements/:id/responses', authenticate, getAnnouncementResponses);

// Notifications
router.get('/notifications', authenticate, authorize(['FACULTY', 'ADMIN']), getNotifications);
router.patch('/notifications/:id/read', authenticate, authorize(['FACULTY', 'ADMIN']), markNotificationRead);

export default router;
