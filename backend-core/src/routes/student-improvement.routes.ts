import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware';
import {
  getSIS,
  getTopics,
  getStrengthsWeaknesses,
  getPriority,
  getBenchmark,
  getBands,
  getSemesters,
  getQuizInsights,
  getMistakes,
  markMistakeReviewed,
  getGoals,
  createGoal,
  updateGoal,
  getAchievements,
  getNotifications,
  markNotifRead,
  getResources,
} from '../controllers/student-improvement.controller';

const router = Router();

router.use(authenticate);

// Analytics
router.get('/sis',                 getSIS);
router.get('/topics',              getTopics);
router.get('/strengths-weaknesses', getStrengthsWeaknesses);
router.get('/priority',            getPriority);
router.get('/benchmark',           getBenchmark);
router.get('/bands',               getBands);
router.get('/semesters',           getSemesters);
router.get('/quiz-insights/:attemptId', getQuizInsights);

// Mistakes notebook
router.get('/mistakes',            getMistakes);
router.patch('/mistakes/:id/review', markMistakeReviewed);

// Goals
router.get('/goals',               getGoals);
router.post('/goals',              createGoal);
router.patch('/goals/:id',         updateGoal);

// Achievements
router.get('/achievements',        getAchievements);

// Notifications
router.get('/notifications',       getNotifications);
router.patch('/notifications/:id/read', markNotifRead);

// Learning resources
router.get('/resources',           getResources);

export default router;
