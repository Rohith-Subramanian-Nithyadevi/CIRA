import { Router } from 'express';
import { getDashboardData, submitAnnouncementResponse } from '../controllers/student-dashboard.controller';
import { updateProfile, getAnnouncements } from '../controllers/student.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Student dashboard requires authentication
router.use(authenticate, authorize(['STUDENT']));

router.get('/dashboard', getDashboardData);
router.post('/announcements/respond', submitAnnouncementResponse);

// Profile and Announcements (called at /api/v1/student/...)
router.put('/profile', updateProfile);
router.get('/announcements', getAnnouncements);

export default router;
