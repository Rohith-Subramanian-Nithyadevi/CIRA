import { Router } from 'express';
import { evaluateStudent, enrollDepartment, unenrollDepartment, unenrollSection, getEnrolledDepartments, getStudents, getStudentFilterOptions, resetStudentPassword, searchStudent, getStudentProfile, updateFacultyProfile } from '../controllers/faculty.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { attachFacultyScope } from '../middlewares/faculty-scope.middleware';

const router = Router();

router.use(authenticate);
router.use(authorize(['FACULTY', 'ADMIN']));
router.use(attachFacultyScope);

router.put('/profile', updateFacultyProfile);
router.put('/evaluate', evaluateStudent);

router.post('/enroll', enrollDepartment);
router.delete('/enroll/:departmentId', unenrollDepartment);
router.delete('/enroll/section/:sectionId', unenrollSection);
router.get('/departments', getEnrolledDepartments);
router.get('/students/filter-options', getStudentFilterOptions);
router.post('/students/:studentId/reset-password', authorize(['FACULTY']), resetStudentPassword);
router.get('/students/search', searchStudent);
router.get('/students', getStudents);
router.get('/students/:studentId/profile', getStudentProfile);

export default router;
