import { Router } from 'express';
import { 
  createAssignment, getFacultyAssignments, deleteAssignment, getStudentAssignments,
  getAssignmentSubmissions, gradeSubmission, submitStudentAssignment, updateAssignment
} from '../controllers/assignment.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Faculty Routes
router.post('/faculty', authenticate, createAssignment);
router.get('/faculty', authenticate, getFacultyAssignments);
router.put('/faculty/:id', authenticate, updateAssignment);
router.delete('/faculty/:id', authenticate, deleteAssignment);
router.get('/faculty/:assignmentId/submissions', authenticate, getAssignmentSubmissions);
router.put('/faculty/:assignmentId/submissions/:submissionId/grade', authenticate, gradeSubmission);

// Student Routes
router.get('/student', authenticate, getStudentAssignments);
router.post('/student/:assignmentId/submit', authenticate, submitStudentAssignment);

export default router;
