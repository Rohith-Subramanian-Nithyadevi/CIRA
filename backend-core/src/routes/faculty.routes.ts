import { Router } from 'express';
import { evaluateStudent, enrollDepartment, unenrollDepartment, unenrollSection, getEnrolledDepartments, getStudents, searchStudent, getStudentProfile } from '../controllers/faculty.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize(['FACULTY', 'ADMIN']));

router.put('/evaluate', evaluateStudent);

router.post('/enroll', enrollDepartment);
router.delete('/enroll/:departmentId', unenrollDepartment);
router.delete('/enroll/section/:sectionId', unenrollSection);
router.get('/departments', getEnrolledDepartments);
router.get('/students/search', searchStudent);
router.get('/students', getStudents);
router.get('/students/:studentId/profile', getStudentProfile);

export default router;
