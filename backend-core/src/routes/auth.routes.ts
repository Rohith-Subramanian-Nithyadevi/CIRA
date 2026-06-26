import { Router } from 'express';
import { register, login, getMe, verifyEmail } from '../controllers/auth.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);

// Protected routes
router.get('/me', authenticate, authorize(['STUDENT', 'FACULTY', 'ADMIN']), getMe);

export default router;
