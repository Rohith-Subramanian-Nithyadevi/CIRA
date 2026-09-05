import { Router } from 'express';
import { getDashboardData } from '../controllers/student-dashboard.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Student dashboard requires authentication
router.use(authenticate, authorize(['STUDENT']));

router.get('/dashboard', getDashboardData);

export default router;
