import { Router } from 'express';
import { getAllFaculty, approveFaculty, assignFacultyClasses, getAllUsers, deleteUser, importStudents } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Protect all admin/management routes (accessible to ADMIN and FACULTY)
router.use(authenticate);
router.use(authorize(['ADMIN', 'FACULTY']));

router.get('/faculty/all', getAllFaculty);
router.put('/faculty/:facultyId/approve', approveFaculty);
router.put('/faculty/:facultyId/assign-classes', authorize(['ADMIN']), assignFacultyClasses);
router.post('/faculty/:facultyId/assign-classes', authorize(['ADMIN']), assignFacultyClasses);

router.get('/users', getAllUsers);
router.delete('/users/:id', deleteUser);
router.post('/students/import', upload.single('file'), importStudents);

export default router;
