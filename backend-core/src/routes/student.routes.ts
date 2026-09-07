import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import {
  getTasks,
  createTask,
  toggleTask,
  deleteTask,
  getResources,
  getTimeline,
  getStrengthsWeaknesses,
  getHeatmap,
  getRadar
} from '../controllers/student.controller';

const router = Router();

// Protect all routes
router.use(authenticate);

// Tasks
router.get('/tasks', getTasks);
router.post('/tasks', createTask);
router.patch('/tasks/:id', toggleTask);
router.delete('/tasks/:id', deleteTask);

// Resources
router.get('/resources', getResources);

// Analytics
router.get('/analytics/timeline', getTimeline);
router.get('/analytics/strengths-weaknesses', getStrengthsWeaknesses);
router.get('/analytics/heatmap', getHeatmap);
router.get('/analytics/radar', getRadar);

export default router;
