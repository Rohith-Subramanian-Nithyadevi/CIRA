import { Router } from 'express';
import { getAllDepartments } from '../controllers/department.controller';

const router = Router();

// Public route so Registration page can load dropdowns
router.get('/', getAllDepartments);

export default router;
