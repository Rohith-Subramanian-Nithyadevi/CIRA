import { Router } from 'express';
import { getPerformanceBands } from '../controllers/faculty-reports.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate, authorize(['FACULTY', 'ADMIN']));

router.get('/performance-bands', getPerformanceBands);

export default router;
