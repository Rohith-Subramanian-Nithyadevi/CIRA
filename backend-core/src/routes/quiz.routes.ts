import { Router } from 'express';
import { createQuiz, updateQuiz, addQuestions, getSubmissions, evaluateAttempt, getQuizzes, getQuizById, deleteQuiz, uploadDocxParser, uploadImageHandler, togglePublishAnswers } from '../controllers/quiz.controller';
import { allowRestart } from '../controllers/student-exam.controller';
import { downloadTemplate } from '../controllers/template.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

import multer from 'multer';

const router = Router();
const upload = multer({ dest: 'uploads/' });

// Only FACULTY and ADMIN can manage quizzes
router.use(authenticate, authorize(['FACULTY', 'ADMIN']));

router.get('/template', downloadTemplate);
router.get('/', getQuizzes);
router.post('/create', createQuiz);
router.post('/upload-docx', upload.single('file'), uploadDocxParser);
router.post('/upload-image', upload.single('file'), uploadImageHandler);
router.get('/:quizId', getQuizById);
router.put('/:quizId', updateQuiz);
router.delete('/:quizId', deleteQuiz);
router.post('/:quizId/questions', addQuestions);
router.get('/:quizId/submissions', getSubmissions);
router.post('/attempt/:attemptId/evaluate', evaluateAttempt);
router.post('/attempt/:attemptId/allow-restart', allowRestart);
router.post('/:quizId/publish', togglePublishAnswers);

export default router;
