import { Router } from 'express';
import { getEligibleQuizzes, getQuizInstructions, startExam, saveResponse, submitExam, recordViolation, getQuizResult, verifyQuizAccessOtp } from '../controllers/student-exam.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Only STUDENT can take exams
router.use(authenticate, authorize(['STUDENT']));

router.get('/eligible', getEligibleQuizzes);
router.get('/instructions/:quizId', getQuizInstructions);
router.post('/verify-otp/:quizId', verifyQuizAccessOtp);
router.post('/start/:quizId', startExam);
router.post('/attempt/:attemptId/save-response', saveResponse);
router.post('/attempt/:attemptId/violation', recordViolation);
router.post('/attempt/:attemptId/submit', submitExam);
router.get('/result/:quizId', getQuizResult);

export default router;
