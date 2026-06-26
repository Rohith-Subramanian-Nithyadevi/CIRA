import { Router } from 'express';
import { createQuiz, addQuestions, getSubmissions, evaluateAttempt } from '../controllers/quiz.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Only FACULTY and ADMIN can manage quizzes
router.use(authenticate, authorize(['FACULTY', 'ADMIN']));

router.post('/create', createQuiz);
router.post('/:quizId/questions', addQuestions);
router.get('/:quizId/submissions', getSubmissions);
router.post('/attempt/:attemptId/evaluate', evaluateAttempt);

export default router;
