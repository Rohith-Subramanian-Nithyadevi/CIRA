import { Router } from 'express';
import { 
  createAssignment, getFacultyAssignments, deleteAssignment, getStudentAssignments
} from '../controllers/assignment.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Faculty Routes
router.post('/faculty', authenticate, createAssignment);
router.get('/faculty', authenticate, getFacultyAssignments);
router.delete('/faculty/:id', authenticate, deleteAssignment);

// Student Routes
router.get('/student', authenticate, getStudentAssignments);

export default router;
