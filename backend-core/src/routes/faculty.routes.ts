import { Router } from 'express';
import { evaluateStudent } from '../controllers/faculty.controller';
import { protect, restrictTo } from '../middlewares/auth.middleware';

const router = Router();

router.use(protect);
router.use(restrictTo('FACULTY', 'ADMIN'));

router.put('/evaluate', evaluateStudent);

export default router;
