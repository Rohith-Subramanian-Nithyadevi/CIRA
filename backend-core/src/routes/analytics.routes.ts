import { Router } from 'express';
import { getDepartmentAnalytics } from '../controllers/analytics.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize(['ADMIN', 'FACULTY']));

router.get('/department', getDepartmentAnalytics);

export default router;
