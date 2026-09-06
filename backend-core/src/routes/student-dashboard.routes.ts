import { Router } from 'express';
import { getDashboardData, submitAnnouncementResponse } from '../controllers/student-dashboard.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Student dashboard requires authentication
router.use(authenticate, authorize(['STUDENT']));

router.get('/dashboard', getDashboardData);
router.post('/announcements/respond', submitAnnouncementResponse);

export default router;
