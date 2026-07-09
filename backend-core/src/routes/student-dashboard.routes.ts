import { Router } from 'express';
import { getDashboardData } from '../controllers/student-dashboard.controller';
// In a real app we would use authenticate and authorize
// import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// For testing purposes, we're making this public so we can easily fetch it from the frontend
// without dealing with auth tokens in this quick setup.
router.get('/dashboard', getDashboardData);

export default router;
