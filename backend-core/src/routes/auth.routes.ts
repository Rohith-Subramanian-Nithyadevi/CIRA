import { Router } from 'express';
import { register, login, getMe, verifyEmail, forgotPassword, resetPassword, firebaseAuthLogin, firebaseAuthRegister } from '../controllers/auth.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/verify-email', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/firebase-login', firebaseAuthLogin);
router.post('/firebase-register', firebaseAuthRegister);



// Protected routes
router.get('/me', authenticate, authorize(['STUDENT', 'FACULTY', 'ADMIN']), getMe);

export default router;
