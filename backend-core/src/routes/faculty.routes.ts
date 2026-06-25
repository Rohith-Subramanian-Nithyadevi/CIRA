import { Router } from 'express';
import { evaluateStudent } from '../controllers/faculty.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize(['FACULTY', 'ADMIN']));

router.put('/evaluate', evaluateStudent);

export default router;
