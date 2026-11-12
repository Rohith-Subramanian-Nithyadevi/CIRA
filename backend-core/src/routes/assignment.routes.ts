import { Router } from 'express';
import { 
  createAssignment, getFacultyAssignments, deleteAssignment, getStudentAssignments,
  getAssignmentSubmissions, gradeSubmission, submitStudentAssignment, updateAssignment
} from '../controllers/assignment.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Faculty Routes
router.post('/faculty', authenticate, authorize(['FACULTY', 'ADMIN']), createAssignment);
router.get('/faculty', authenticate, authorize(['FACULTY', 'ADMIN']), getFacultyAssignments);
router.put('/faculty/:id', authenticate, authorize(['FACULTY', 'ADMIN']), updateAssignment);
router.delete('/faculty/:id', authenticate, authorize(['FACULTY', 'ADMIN']), deleteAssignment);
router.get('/faculty/:assignmentId/submissions', authenticate, authorize(['FACULTY', 'ADMIN']), getAssignmentSubmissions);
router.put('/faculty/:assignmentId/submissions/:submissionId/grade', authenticate, authorize(['FACULTY', 'ADMIN']), gradeSubmission);

// Student Routes
router.get('/student', authenticate, getStudentAssignments);
router.post('/student/:assignmentId/submit', authenticate, submitStudentAssignment);

export default router;
