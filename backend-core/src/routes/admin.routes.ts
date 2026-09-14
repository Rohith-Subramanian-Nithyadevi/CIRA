import { Router } from 'express';
import { getAllFaculty, approveFaculty, getAllUsers, deleteUser, importStudents } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Protect all admin routes
router.use(authenticate);
router.use(authorize(['ADMIN']));

router.get('/faculty/all', getAllFaculty);
router.put('/faculty/:facultyId/approve', approveFaculty);

router.get('/users', getAllUsers);
router.delete('/users/:id', deleteUser);
router.post('/students/import', upload.single('file'), importStudents);

export default router;
