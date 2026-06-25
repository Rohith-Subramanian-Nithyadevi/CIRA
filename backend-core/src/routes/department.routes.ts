import { Router } from 'express';
import { getAllDepartments, createDepartment, deleteDepartment, createSection, deleteSection } from '../controllers/department.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Public route so Registration page can load dropdowns
router.get('/', getAllDepartments);

// Admin protected routes
router.use(authenticate);
router.use(authorize(['ADMIN']));

router.post('/', createDepartment);
router.delete('/:id', deleteDepartment);
router.post('/sections', createSection);
router.delete('/sections/:id', deleteSection);

export default router;
