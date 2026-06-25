import { Router } from 'express';
import { upload } from '../middlewares/upload.middleware';
import { importQuestions } from '../controllers/exam.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Endpoint locked exclusively to Faculty and Admin roles
router.post(
  '/questions/import',
  authenticate,
  authorize(['FACULTY', 'ADMIN']),
  upload.single('file'),
  importQuestions
);

export default router;
