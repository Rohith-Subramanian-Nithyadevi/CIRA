import { Router } from 'express';
import { createQuiz, addQuestions, getSubmissions, evaluateAttempt, getQuizzes, getQuizById, deleteQuiz } from '../controllers/quiz.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Only FACULTY and ADMIN can manage quizzes
router.use(authenticate, authorize(['FACULTY', 'ADMIN']));

router.get('/', getQuizzes);
router.post('/create', createQuiz);
router.get('/:quizId', getQuizById);
router.delete('/:quizId', deleteQuiz);
router.post('/:quizId/questions', addQuestions);
router.get('/:quizId/submissions', getSubmissions);
router.post('/attempt/:attemptId/evaluate', evaluateAttempt);

export default router;
