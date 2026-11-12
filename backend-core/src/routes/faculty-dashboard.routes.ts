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
router.get('/tasks', authenticate, authorize(['FACULTY', 'ADMIN']), getTasks);
router.post('/tasks', authenticate, authorize(['FACULTY', 'ADMIN']), createTask);
router.put('/tasks/:id', authenticate, authorize(['FACULTY', 'ADMIN']), updateTask);
router.delete('/tasks/:id', authenticate, authorize(['FACULTY', 'ADMIN']), deleteTask);

// Calendar Events
router.get('/calendar', authenticate, authorize(['FACULTY', 'ADMIN']), getCalendarEvents);
router.post('/calendar', authenticate, authorize(['FACULTY', 'ADMIN']), createCalendarEvent);
router.delete('/calendar/:id', authenticate, authorize(['FACULTY', 'ADMIN']), deleteCalendarEvent);

// Announcements
router.get('/announcements/polls/targets', authenticate, authorize(['FACULTY', 'ADMIN']), attachFacultyScope, getPollTargets);
router.get('/announcements/polls', authenticate, authorize(['FACULTY', 'ADMIN']), attachFacultyScope, listPolls);
router.post('/announcements/polls', authenticate, authorize(['FACULTY', 'ADMIN']), attachFacultyScope, createPoll);
router.get('/announcements/polls/:id/results', authenticate, authorize(['FACULTY', 'ADMIN']), attachFacultyScope, getPollResults);
router.get('/announcements', authenticate, authorize(['FACULTY', 'ADMIN']), getAnnouncements);
router.post('/announcements', authenticate, authorize(['FACULTY', 'ADMIN']), createAnnouncement);
router.delete('/announcements/:id', authenticate, authorize(['FACULTY', 'ADMIN']), deleteAnnouncement);
router.get('/announcements/:id/responses', authenticate, authorize(['FACULTY', 'ADMIN']), getAnnouncementResponses);

// Notifications
router.get('/notifications', authenticate, authorize(['FACULTY', 'ADMIN']), getNotifications);
router.patch('/notifications/:id/read', authenticate, authorize(['FACULTY', 'ADMIN']), markNotificationRead);

export default router;
