import { Router } from 'express';
import { getAllFaculty, approveFaculty, getAllUsers, deleteUser } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Protect all admin routes
router.use(authenticate);
router.use(authorize(['ADMIN']));

router.get('/faculty/all', getAllFaculty);
router.put('/faculty/:facultyId/approve', approveFaculty);

router.get('/users', getAllUsers);
router.delete('/users/:id', deleteUser);

export default router;
