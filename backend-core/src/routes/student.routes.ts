import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import {
  getTasks,
  createTask,
  toggleTask,
  deleteTask,
  getHabits,
  createHabit,
  toggleHabit,
  deleteHabit,
  getCalendarEvents,
  createCalendarEvent,
  deleteCalendarEvent,
  getResources,
  getTimeline,
  getStrengthsWeaknesses,
  getHeatmap,
  getRadar,
  getBenchmark,
  getDistribution,
  updateProfile,
  getAnnouncements
} from '../controllers/student.controller';

const router = Router();

// Protect all routes
router.use(authenticate);

// Profile and Announcements
router.put('/profile', updateProfile);
router.get('/announcements', getAnnouncements);

// Tasks
router.get('/tasks', getTasks);
router.post('/tasks', createTask);
router.patch('/tasks/:id', toggleTask);
router.delete('/tasks/:id', deleteTask);

// Habits
router.get('/habits', getHabits);
router.post('/habits', createHabit);
router.patch('/habits/:id', toggleHabit);
router.delete('/habits/:id', deleteHabit);

// Calendar
router.get('/calendar', getCalendarEvents);
router.post('/calendar', createCalendarEvent);
router.delete('/calendar/:id', deleteCalendarEvent);

// Resources
router.get('/resources', getResources);

// Analytics
router.get('/analytics/timeline', getTimeline);
router.get('/analytics/strengths-weaknesses', getStrengthsWeaknesses);
router.get('/analytics/heatmap', getHeatmap);
router.get('/analytics/radar', getRadar);
router.get('/analytics/benchmark', getBenchmark);
router.get('/analytics/distribution', getDistribution);

export default router;
