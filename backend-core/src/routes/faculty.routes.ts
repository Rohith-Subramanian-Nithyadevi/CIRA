import { Router } from 'express';
import { evaluateStudent, enrollDepartment, unenrollDepartment, getEnrolledDepartments, getStudents } from '../controllers/faculty.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize(['FACULTY', 'ADMIN']));

router.put('/evaluate', evaluateStudent);

router.post('/enroll', enrollDepartment);
router.delete('/enroll/:departmentId', unenrollDepartment);
router.get('/departments', getEnrolledDepartments);
router.get('/students', getStudents);

export default router;
