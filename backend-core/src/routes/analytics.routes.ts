import { Router } from 'express';
import { getDepartmentAnalytics } from '../controllers/analytics.controller';
import { protect, restrictTo } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect);
router.use(restrictTo('ADMIN', 'FACULTY'));

router.get('/department', getDepartmentAnalytics);

export default router;
