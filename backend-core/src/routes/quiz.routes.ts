import { Router } from 'express';
import { createQuiz, addQuestions, getSubmissions, evaluateAttempt, getQuizzes, getQuizById, deleteQuiz, uploadDocxParser, uploadImageHandler } from '../controllers/quiz.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Only FACULTY and ADMIN can manage quizzes
router.use(authenticate, authorize(['FACULTY', 'ADMIN']));

router.get('/', getQuizzes);
router.post('/create', createQuiz);
router.post('/upload-docx', upload.single('file'), uploadDocxParser);
router.post('/upload-image', upload.single('file'), uploadImageHandler);
router.get('/:quizId', getQuizById);
router.delete('/:quizId', deleteQuiz);
router.post('/:quizId/questions', addQuestions);
router.get('/:quizId/submissions', getSubmissions);
router.post('/attempt/:attemptId/evaluate', evaluateAttempt);

export default router;
