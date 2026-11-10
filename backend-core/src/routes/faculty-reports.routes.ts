import { Router } from 'express';
import { getPerformanceBands, getQuizAnalytics } from '../controllers/faculty-reports.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { attachFacultyScope } from '../middlewares/faculty-scope.middleware';

const router = Router();

router.use(authenticate, authorize(['FACULTY']), attachFacultyScope);

router.get('/performance-bands', getPerformanceBands);
router.get('/quiz/:quizId', getQuizAnalytics);

export default router;
