import { Router } from 'express';
import { getEligibleQuizzes, startExam, saveResponse, submitExam } from '../controllers/student-exam.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Only STUDENT can take exams
router.use(authenticate, authorize(['STUDENT']));

router.get('/eligible', getEligibleQuizzes);
router.post('/start/:quizId', startExam);
router.post('/attempt/:attemptId/save-response', saveResponse);
router.post('/attempt/:attemptId/submit', submitExam);

export default router;
