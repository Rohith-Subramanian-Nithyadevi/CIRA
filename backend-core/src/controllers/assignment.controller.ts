import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Create an assignment and automatically assign to all applicable users
export const createAssignment = async (req: Request, res: Response) => {
  try {
    const facultyId = (req as any).user.userId;
    const { title, description, targetBatches, targetDepartments, targetSections } = req.body;

    const assignment = await prisma.assignment.create({
      data: {
        title,
        description,
        createdBy: facultyId,
        targetBatches: {
          create: targetBatches?.map((b: string) => ({ batchId: b })) || []
        },
        targetDepartments: {
          create: targetDepartments?.map((d: string) => ({ departmentId: d })) || []
        },
        targetSections: {
          create: targetSections?.map((s: string) => ({ sectionId: s })) || []
        }
      }
    });

    // Optionally: assign directly to students matching the hierarchy, 
    // or evaluate on the fly when students fetch assignments.
    // Creating AssignmentStudent records for fast querying:
    let usersQuery: any = { AND: [] };
    
    if (targetBatches?.length > 0 || targetDepartments?.length > 0 || targetSections?.length > 0) {
      if (targetBatches?.length > 0) {
        usersQuery.AND.push({
          department: { batchId: { in: targetBatches } }
        });
      }
      if (targetDepartments?.length > 0) {
        usersQuery.AND.push({
          departmentId: { in: targetDepartments }
        });
      }
      if (targetSections?.length > 0) {
        usersQuery.AND.push({
          sectionId: { in: targetSections }
        });
      }

      const users = await prisma.user.findMany({
        where: { ...usersQuery, role: 'STUDENT' },
        select: { id: true }
      });

      if (users.length > 0) {
        await prisma.assignmentStudent.createMany({
          data: users.map(u => ({ assignmentId: assignment.id, userId: u.id }))
        });
      }
    }

    res.json({ success: true, data: assignment });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Update an assignment
export const updateAssignment = async (req: Request, res: Response) => {
  try {
    const facultyId = (req as any).user.userId;
    const assignmentId = req.params.id as string;
    const { title, description, targetBatches, targetDepartments, targetSections } = req.body;

    const existing = await prisma.assignment.findUnique({
      where: { id: assignmentId },
      include: {
        _count: {
          select: { submissions: true }
        }
      }
    });

    if (!existing) {
      return res.status(404).json({ success: false, message: 'Assignment not found' });
    }

    if (existing.createdBy !== facultyId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (existing._count.submissions > 0) {
      return res.status(409).json({ success: false, message: 'Cannot edit an assignment that already has submissions' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const assignment = await tx.assignment.update({
        where: { id: assignmentId },
        data: { title, description }
      });

      if (targetBatches !== undefined) {
        await tx.assignmentBatch.deleteMany({ where: { assignmentId } });
        if (targetBatches.length > 0) {
          await tx.assignmentBatch.createMany({
            data: targetBatches.map((b: string) => ({ assignmentId, batchId: b }))
          });
        }
      }

      if (targetDepartments !== undefined) {
        await tx.assignmentDepartment.deleteMany({ where: { assignmentId } });
        if (targetDepartments.length > 0) {
          await tx.assignmentDepartment.createMany({
            data: targetDepartments.map((d: string) => ({ assignmentId, departmentId: d }))
          });
        }
      }

      if (targetSections !== undefined) {
        await tx.assignmentSection.deleteMany({ where: { assignmentId } });
        if (targetSections.length > 0) {
          await tx.assignmentSection.createMany({
            data: targetSections.map((s: string) => ({ assignmentId, sectionId: s }))
          });
        }
      }

      // If targeting is provided, rebuild AssignmentStudent
      if (targetBatches !== undefined || targetDepartments !== undefined || targetSections !== undefined) {
        let usersQuery: any = { AND: [] };
        let hasConditions = false;
        
        if (targetBatches?.length > 0) {
          usersQuery.AND.push({ department: { batchId: { in: targetBatches } } });
          hasConditions = true;
        }
        if (targetDepartments?.length > 0) {
          usersQuery.AND.push({ departmentId: { in: targetDepartments } });
          hasConditions = true;
        }
        if (targetSections?.length > 0) {
          usersQuery.AND.push({ sectionId: { in: targetSections } });
          hasConditions = true;
        }

        await tx.assignmentStudent.deleteMany({ where: { assignmentId } });
        
        if (hasConditions) {
          const users = await tx.user.findMany({
            where: { ...usersQuery, role: 'STUDENT' },
            select: { id: true }
          });
          if (users.length > 0) {
            await tx.assignmentStudent.createMany({
              data: users.map(u => ({ assignmentId, userId: u.id }))
            });
          }
        }
      }

      return assignment;
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get assignments for student
export const getStudentAssignments = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    // We check AssignmentStudent and left join with AssignmentSubmission
    const assignments = await prisma.assignmentStudent.findMany({
      where: { userId },
      include: {
        assignment: {
          include: {
            submissions: {
              where: { userId }
            }
          }
        }
      },
      orderBy: { assignment: { createdAt: 'desc' } }
    });

    const mapped = assignments.map(a => ({
      ...a.assignment,
      submitted: a.assignment.submissions.length > 0,
      submission: a.assignment.submissions[0] || null
    }));

    res.json({ success: true, data: mapped });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get faculty's created assignments
export const getFacultyAssignments = async (req: Request, res: Response) => {
  try {
    const facultyId = (req as any).user.userId;
    
    const hasPagination = req.query.page !== undefined || req.query.limit !== undefined;

    if (hasPagination) {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const skip = (page - 1) * limit;

      const [total, assignments] = await prisma.$transaction([
        prisma.assignment.count({ where: { createdBy: facultyId } }),
        prisma.assignment.findMany({
          where: { createdBy: facultyId },
          include: {
            targetBatches: true,
            targetDepartments: true,
            targetSections: true,
            _count: {
              select: { submissions: true, targetStudents: true }
            }
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit
        })
      ]);

      const hasMore = skip + assignments.length < total;
      res.json({ success: true, data: { items: assignments, total, page, hasMore } });
    } else {
      const assignments = await prisma.assignment.findMany({
        where: { createdBy: facultyId },
        include: {
          targetBatches: true,
          targetDepartments: true,
          targetSections: true,
          _count: {
            select: { submissions: true, targetStudents: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      res.json({ success: true, data: assignments });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const deleteAssignment = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const facultyId = (req as any).user.userId;
    
    const existing = await prisma.assignment.findUnique({ where: { id } });
    if (!existing || existing.createdBy !== facultyId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    await prisma.assignment.delete({ where: { id } });
    res.json({ success: true, message: 'Deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Get all submissions for a faculty's assignment
export const getAssignmentSubmissions = async (req: Request, res: Response) => {
  try {
    const facultyId = (req as any).user.userId;
    const assignmentId = req.params.assignmentId as string;

    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment || assignment.createdBy !== facultyId) {
      return res.status(403).json({ success: false, message: 'Unauthorized or not found' });
    }

    // Find all students assigned to this
    const studentsAssigned = await prisma.assignmentStudent.findMany({
      where: { assignmentId },
      include: {
        user: { select: { id: true, name: true, rollNumber: true } }
      }
    });

    // Find all submissions
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { assignmentId }
    });

    const subMap = new Map();
    submissions.forEach(sub => subMap.set(sub.userId, sub));

    const finalSubmissions = studentsAssigned.map(s => {
      const sub = subMap.get(s.userId);
      let status = 'NOT_SUBMITTED';
      if (sub) {
        status = sub.grade !== null ? 'GRADED' : 'SUBMITTED';
      }

      return {
        studentId: (s as any).user.id,
        studentName: (s as any).user.name,
        rollNumber: (s as any).user.rollNumber,
        status,
        submissionId: sub?.id || null,
        submittedAt: sub?.submittedAt || null,
        fileUrl: sub?.fileUrl || null,
        submissionText: sub?.submissionText || null,
        grade: sub?.grade || null,
        feedback: sub?.feedback || null
      };
    });

    const summary = {
      totalAssigned: studentsAssigned.length,
      submitted: submissions.length,
      graded: submissions.filter(s => s.grade !== null).length,
      pending: studentsAssigned.length - submissions.length
    };

    res.json({ success: true, data: { assignment, summary, submissions: finalSubmissions } });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Grade a student's submission
export const gradeSubmission = async (req: Request, res: Response) => {
  try {
    const facultyId = (req as any).user.userId;
    const assignmentId = req.params.assignmentId as string;
    const submissionId = req.params.submissionId as string;
    const { grade, feedback } = req.body;

    const assignment = await prisma.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment || assignment.createdBy !== facultyId) {
      return res.status(403).json({ success: false, message: 'Unauthorized' });
    }

    if (typeof grade !== 'number' || grade < 0 || grade > assignment.maxMarks) {
      return res.status(400).json({ success: false, message: `Grade must be between 0 and ${assignment.maxMarks}` });
    }

    const percentage = (grade / assignment.maxMarks) * 100;
    let rating: any = 'POOR';
    if (percentage >= 90) rating = 'EXCELLENT';
    else if (percentage >= 75) rating = 'GOOD';
    else if (percentage >= 50) rating = 'AVERAGE';

    const updated = await prisma.assignmentSubmission.update({
      where: { id: submissionId },
      data: { grade, feedback, rating }
    });

    res.json({ success: true, data: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// Student submits an assignment
export const submitStudentAssignment = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const assignmentId = req.params.assignmentId as string;
    const { fileUrl, submissionText } = req.body;

    // Ensure student is assigned
    const assigned = await prisma.assignmentStudent.findUnique({
      where: { assignmentId_userId: { assignmentId, userId } }
    });

    if (!assigned) {
      return res.status(403).json({ success: false, message: 'Not assigned to this assignment' });
    }

    // Upsert submission
    const existing = await prisma.assignmentSubmission.findFirst({
      where: { assignmentId, userId }
    });

    let submission;
    if (existing) {
      submission = await prisma.assignmentSubmission.update({
        where: { id: existing.id },
        data: { fileUrl, submissionText, submittedAt: new Date() }
      });
    } else {
      submission = await prisma.assignmentSubmission.create({
        data: {
          assignmentId,
          userId,
          fileUrl,
          submissionText,
          submittedAt: new Date()
        }
      });

      // Fire notification to the faculty member who owns the assignment
      try {
        const assignment = await prisma.assignment.findUnique({
          where: { id: assignmentId },
          select: { title: true, createdBy: true }
        });
        const student = await prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, rollNumber: true }
        });
        if (assignment && student) {
          await prisma.notification.create({
            data: {
              facultyId: assignment.createdBy,
              type: 'ASSIGNMENT_SUBMISSION',
              message: `${student.name} (${student.rollNumber || 'N/A'}) submitted "${assignment.title}"`
            }
          });
        }
      } catch (_notifErr) {
        // Non-critical — do not fail the submission if notification creation fails
        console.error('Notification creation failed:', _notifErr);
      }
    }

    res.json({ success: true, data: submission });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
