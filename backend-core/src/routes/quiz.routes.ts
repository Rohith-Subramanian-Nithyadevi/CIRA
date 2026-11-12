import { Router, Request, Response, NextFunction } from 'express';
import { createQuiz, updateQuiz, addQuestions, getSubmissions, evaluateAttempt, evaluateStudentForQuiz, getQuizzes, getQuizById, deleteQuiz, uploadDocxParser, uploadImageHandler, publishQuizAnswers } from '../controllers/quiz.controller';
import { allowRestart } from '../controllers/student-exam.controller';
import { downloadTemplate } from '../controllers/template.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { archiveBankQuestion, createBankQuestion, listQuestionBank, updateBankQuestion, uploadQuestionImage } from '../controllers/question-bank.controller';
import { BadRequestError } from '../utils/errors';
import { isAllowedQuestionImage, QUESTION_IMAGE_MAX_BYTES } from '../utils/question-bank-policy';
import { attachFacultyScope } from '../middlewares/faculty-scope.middleware';
import { closeQuestionPaper, createQuestionPaper, generateQuestionPaper, getPaperClasses, getQuestionPaper, listQuestionPapers, publishQuestionPaper, updateQuestionPaper } from '../controllers/question-paper.controller';

import multer from 'multer';

const router = Router();
const upload = multer({
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit to prevent ZIP/DOCX memory exhaustion
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Validate file extensions and mimetypes
    const allowedExtensions = /\.(docx|xlsx|png|jpg|jpeg)$/i;
    if (!file.originalname.match(allowedExtensions)) {
      return cb(new Error('Invalid file type. Only DOCX, XLSX, and Image files are permitted.'));
    }
    cb(null, true);
  }
});
const questionImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: QUESTION_IMAGE_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedQuestionImage(file.mimetype, file.originalname)) return cb(new BadRequestError('Only PNG, JPEG and WebP image files are allowed.', 'ERR_INVALID_QUESTION_IMAGE'));
    cb(null, true);
  },
});
const uploadQuestionImageFile = (req: Request, res: Response, next: NextFunction) => questionImageUpload.single('file')(req, res, (error) => {
  if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') return next(new BadRequestError('Images must be 5 MB or smaller.', 'ERR_QUESTION_IMAGE_TOO_LARGE'));
  if (error instanceof multer.MulterError) return next(new BadRequestError('Upload one image file at a time.', 'ERR_INVALID_QUESTION_IMAGE'));
  next(error);
});

// Only FACULTY and ADMIN can manage quizzes
router.use(authenticate, authorize(['FACULTY', 'ADMIN']));

router.get('/template', downloadTemplate);
router.get('/question-bank', listQuestionBank);
router.post('/question-bank', createBankQuestion);
router.post('/question-bank/upload-image', uploadQuestionImageFile, uploadQuestionImage);
router.put('/question-bank/:questionId', updateBankQuestion);
router.delete('/question-bank/:questionId', archiveBankQuestion);
router.get('/question-papers/classes', attachFacultyScope, getPaperClasses);
router.get('/question-papers', attachFacultyScope, listQuestionPapers);
router.post('/question-papers', attachFacultyScope, createQuestionPaper);
router.get('/question-papers/:paperId', attachFacultyScope, getQuestionPaper);
router.put('/question-papers/:paperId', attachFacultyScope, updateQuestionPaper);
router.post('/question-papers/:paperId/generate', attachFacultyScope, generateQuestionPaper);
router.post('/question-papers/:paperId/publish', attachFacultyScope, publishQuestionPaper);
router.post('/question-papers/:paperId/close', attachFacultyScope, closeQuestionPaper);
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
router.post('/:quizId/student/:studentId/evaluate', evaluateStudentForQuiz);
router.post('/attempt/:attemptId/allow-restart', allowRestart);
router.post('/:quizId/publish', publishQuizAnswers);

export default router;
