import { Router } from 'express';
import { getPerformanceBands, getQuizAnalytics } from '../controllers/faculty-reports.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate, authorize(['FACULTY', 'ADMIN']));

router.get('/performance-bands', getPerformanceBands);
router.get('/quiz/:quizId', getQuizAnalytics);

export default router;
