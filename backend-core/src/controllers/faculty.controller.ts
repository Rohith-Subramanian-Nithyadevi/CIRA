import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { NotFoundError, ForbiddenError, BadRequestError } from '../utils/errors';

const prisma = new PrismaClient();

const evaluateSchema = z.object({
  student_id: z.string(),
  assessment_id: z.string(),
  subjective_score: z.number().min(0).max(100),
  comments: z.string().optional()
});

export const evaluateStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = evaluateSchema.parse(req.body);

    const result = await prisma.result.findUnique({
      where: {
        user_id_assessment_id: {
          user_id: validatedData.student_id,
          assessment_id: validatedData.assessment_id
        }
      }
    });

    if (!result) {
      throw new NotFoundError('Result not found for this student and assessment', 'ERR_RESULT_NOT_FOUND');
    }

    const updatedMetrics = {
      ...(typeof result.metrics_json === 'object' && result.metrics_json !== null ? result.metrics_json : {}),
      subjective_score: validatedData.subjective_score,
      faculty_comments: validatedData.comments,
      evaluated_by: req.user?.userId
    };

    const updatedResult = await prisma.result.update({
      where: { id: result.id },
      data: {
        metrics_json: updatedMetrics,
      }
    });

    res.status(200).json({
      status: 'success',
      data: { result: updatedResult }
    });
  } catch (error) {
    next(error);
  }
};

export const enrollDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { departmentId, sectionId } = req.body;
    const userId = req.user!.userId;

    if (sectionId) {
      const mapping = await prisma.facultySection.create({
        data: { userId, sectionId }
      });
      return res.status(201).json({ status: 'success', data: { mapping } });
    } else if (departmentId) {
      const mapping = await prisma.facultyDepartment.create({
        data: { userId, departmentId }
      });
      return res.status(201).json({ status: 'success', data: { mapping } });
    }

    res.status(400).json({ status: 'error', message: 'departmentId or sectionId is required' });
  } catch (error) {
    next(error);
  }
};

export const unenrollDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { departmentId } = req.params;
    const userId = req.user!.userId;

    await prisma.facultyDepartment.delete({
      where: { userId_departmentId: { userId, departmentId: departmentId as string } }
    });

    res.status(200).json({ status: 'success', message: 'Unenrolled successfully' });
  } catch (error) {
    next(error);
  }
};

export const unenrollSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { sectionId } = req.params;
    const userId = req.user!.userId;

    await prisma.facultySection.delete({
      where: { userId_sectionId: { userId, sectionId: sectionId as string } }
    });

    res.status(200).json({ status: 'success', message: 'Unenrolled from section successfully' });
  } catch (error) {
    next(error);
  }
};

export const getEnrolledDepartments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const departments = await prisma.facultyDepartment.findMany({
      where: { userId },
      include: { department: { include: { batch: true } } }
    });

    const sections = await prisma.facultySection.findMany({
      where: { userId },
      include: { section: { include: { department: { include: { batch: true } } } } }
    });

    res.status(200).json({ 
      status: 'success', 
      data: { 
        departments: departments.map(d => ({ ...d.department, type: 'department' })),
        sections: sections.map(s => ({ ...s.section, type: 'section' }))
      } 
    });
  } catch (error) {
    next(error);
  }
};

export const getStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    // Get departments mapped to this faculty
    const mappedDepts = await prisma.facultyDepartment.findMany({
      where: { userId },
      select: { departmentId: true }
    });
    const mappedSecs = await prisma.facultySection.findMany({
      where: { userId },
      select: { sectionId: true }
    });
    
    const deptIds = mappedDepts.map(d => d.departmentId);
    const secIds = mappedSecs.map(s => s.sectionId);

    // Fetch students belonging to those departments or sections
    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        OR: [
          { departmentId: { in: deptIds } },
          { sectionId: { in: secIds } }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        rollNumber: true,
        department: { select: { name: true } },
        section: { select: { name: true } }
      }
    });

    res.status(200).json({ status: 'success', data: { students } });
  } catch (error) {
    next(error);
  }
};

export const searchStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rollNumber = req.query.rollNumber as string;
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!rollNumber || typeof rollNumber !== 'string' || rollNumber.trim().length === 0) {
      throw new BadRequestError('Roll number query parameter is required', 'ERR_INVALID_ROLL');
    }

    const trimmedRoll = rollNumber.trim();

    // Query student by rollNumber (case-insensitive)
    const student = await prisma.user.findFirst({
      where: {
        role: 'STUDENT',
        rollNumber: {
          equals: trimmedRoll,
          mode: 'insensitive'
        }
      },
      include: {
        department: {
          include: {
            batch: true
          }
        },
        section: true,
        quizAttempts: {
          where: {
            status: { in: ['SUBMITTED', 'EVALUATED'] }
          },
          include: {
            quiz: {
              select: {
                id: true,
                title: true,
                subject: true,
                totalMarks: true,
                createdAt: true
              }
            },
            responses: {
              include: {
                question: {
                  select: {
                    topic: true,
                    marks: true
                  }
                }
              }
            }
          },
          orderBy: {
            createdAt: 'asc'
          }
        }
      }
    });

    if (!student) {
      throw new NotFoundError(`No student found with roll number "${trimmedRoll}"`, 'ERR_STUDENT_NOT_FOUND');
    }

    // Faculty scoping authorization
    if (userRole !== 'ADMIN') {
      const deptMappings = await prisma.facultyDepartment.findMany({
        where: { userId },
        select: { departmentId: true }
      });
      const secMappings = await prisma.facultySection.findMany({
        where: { userId },
        select: { sectionId: true }
      });
      const mappedDeptIds = deptMappings.map(m => m.departmentId);
      const mappedSecIds = secMappings.map(m => m.sectionId);

      const hasMappings = mappedDeptIds.length > 0 || mappedSecIds.length > 0;
      const inMappedDept = student.departmentId && mappedDeptIds.includes(student.departmentId);
      const inMappedSec = student.sectionId && mappedSecIds.includes(student.sectionId);

      if (hasMappings && !inMappedDept && !inMappedSec) {
        throw new ForbiddenError('You are not authorized to view this student', 'ERR_FORBIDDEN');
      }
    }

    // Format quiz history with real scores and topic breakdowns
    const quizHistory = student.quizAttempts.map(attempt => {
      const maxScore = attempt.quiz.totalMarks > 0 ? attempt.quiz.totalMarks : 100;
      const totalScore = attempt.totalScore || attempt.score || 0;
      const percentage = Math.round((totalScore / maxScore) * 100);

      let band = 'Poor';
      if (percentage >= 80) band = 'Excellent';
      else if (percentage >= 60) band = 'Average';

      // Compute topic scores from question responses
      const topicMap: Record<string, { awarded: number; total: number }> = {};
      attempt.responses.forEach(r => {
        const topicName = r.question.topic || attempt.quiz.subject || 'General';
        if (!topicMap[topicName]) {
          topicMap[topicName] = { awarded: 0, total: 0 };
        }
        topicMap[topicName].awarded += r.marksAwarded || 0;
        topicMap[topicName].total += r.question.marks || 1;
      });

      const topicScores = Object.entries(topicMap).map(([topic, stats]) => ({
        topic,
        score: stats.total > 0 ? Math.round((stats.awarded / stats.total) * 100) : percentage
      }));

      // If no specific topic responses were found, provide subject topic
      if (topicScores.length === 0) {
        topicScores.push({
          topic: attempt.quiz.subject || 'Overall Assessment',
          score: percentage
        });
      }

      return {
        quizId: attempt.quizId,
        title: attempt.quiz.title,
        score: percentage,
        totalScore,
        maxScore,
        band,
        date: attempt.createdAt.toISOString(),
        topicScores
      };
    });

    res.status(200).json({
      status: 'success',
      data: {
        student: {
          id: student.id,
          name: student.name,
          rollNumber: student.rollNumber || trimmedRoll,
          departmentId: student.department?.name || student.departmentId || 'Unassigned',
          departmentName: student.department?.name || 'Unassigned',
          sectionId: student.section?.name || student.sectionId || 'Unassigned',
          sectionName: student.section?.name || 'Unassigned',
          batchName: student.department?.batch?.name || 'General'
        },
        quizzes: quizHistory
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getStudentProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const studentId = req.params.studentId as string;
    const facultyId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    if (!studentId) {
      throw new BadRequestError('Student ID is required', 'ERR_INVALID_STUDENT_ID');
    }

    const student = await prisma.user.findUnique({
      where: { id: studentId, role: 'STUDENT' },
      include: {
        department: { include: { batch: true } },
        section: true,
        quizAttempts: {
          where: { status: { in: ['SUBMITTED', 'EVALUATED'] } },
          include: {
            quiz: { select: { id: true, title: true, subject: true, totalMarks: true, createdAt: true } },
            responses: { include: { question: { select: { topic: true, marks: true } } } }
          },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!student) {
      throw new NotFoundError(`No student found with ID "${studentId}"`, 'ERR_STUDENT_NOT_FOUND');
    }

    // Faculty scoping authorization
    if (userRole !== 'ADMIN') {
      const deptMappings = await prisma.facultyDepartment.findMany({
        where: { userId: facultyId },
        select: { departmentId: true }
      });
      const secMappings = await prisma.facultySection.findMany({
        where: { userId: facultyId },
        select: { sectionId: true }
      });
      const mappedDeptIds = deptMappings.map(m => m.departmentId);
      const mappedSecIds = secMappings.map(m => m.sectionId);

      const hasMappings = mappedDeptIds.length > 0 || mappedSecIds.length > 0;
      const inMappedDept = student.departmentId && mappedDeptIds.includes(student.departmentId);
      const inMappedSec = student.sectionId && mappedSecIds.includes(student.sectionId);

      if (hasMappings && !inMappedDept && !inMappedSec) {
        throw new ForbiddenError('You are not authorized to view this student', 'ERR_FORBIDDEN');
      }
    }

    // Format quiz history
    const quizHistory = student.quizAttempts.map(attempt => {
      const maxScore = attempt.quiz.totalMarks > 0 ? attempt.quiz.totalMarks : 100;
      const totalScore = attempt.totalScore || attempt.score || 0;
      const percentage = Math.round((totalScore / maxScore) * 100);

      let band = 'Poor';
      if (percentage >= 80) band = 'Excellent';
      else if (percentage >= 60) band = 'Average';

      const topicMap: Record<string, { awarded: number; total: number }> = {};
      attempt.responses.forEach(r => {
        const topicName = r.question.topic || attempt.quiz.subject || 'General';
        if (!topicMap[topicName]) {
          topicMap[topicName] = { awarded: 0, total: 0 };
        }
        topicMap[topicName].awarded += r.marksAwarded || 0;
        topicMap[topicName].total += r.question.marks || 1;
      });

      const topicScores = Object.entries(topicMap).map(([topic, stats]) => ({
        topic,
        score: stats.total > 0 ? Math.round((stats.awarded / stats.total) * 100) : percentage
      }));

      if (topicScores.length === 0) {
        topicScores.push({ topic: attempt.quiz.subject || 'Overall Assessment', score: percentage });
      }

      return {
        quizId: attempt.quizId,
        title: attempt.quiz.title,
        score: percentage,
        band,
        date: attempt.createdAt.toISOString(),
        topicScores
      };
    });

    // Format assignments
    const assigned = await prisma.assignmentStudent.findMany({
      where: { userId: student.id },
      include: {
        assignment: { select: { id: true, title: true, maxMarks: true, createdAt: true } }
      }
    });

    const submissions = await prisma.assignmentSubmission.findMany({
      where: { userId: student.id }
    });

    const subMap = new Map();
    submissions.forEach(sub => subMap.set(sub.assignmentId, sub));

    let completedAssignments = 0;
    const assignmentCompletionItems = assigned.map(a => {
      const sub = subMap.get(a.assignmentId);
      let status = 'NOT_SUBMITTED';
      if (sub) {
        status = sub.grade !== null ? 'GRADED' : 'SUBMITTED';
        completedAssignments++;
      }
      return {
        assignmentId: a.assignmentId,
        title: a.assignment.title,
        maxMarks: a.assignment.maxMarks,
        assignedDate: a.assignment.createdAt.toISOString(),
        status,
        grade: sub?.grade || null,
        feedback: sub?.feedback || null,
        submittedAt: sub?.submittedAt?.toISOString() || null
      };
    });

    res.status(200).json({
      status: 'success',
      success: true,
      data: {
        student: {
          id: student.id,
          name: student.name,
          rollNumber: student.rollNumber,
          departmentName: student.department?.name || 'Unassigned',
          sectionName: student.section?.name || 'Unassigned',
          batchName: student.department?.batch?.name || 'General'
        },
        quizHistory,
        attendance: {
          available: false,
          percentage: 0,
          presentDays: 0,
          totalDays: 0
        },
        assignmentCompletion: {
          completed: completedAssignments,
          total: assigned.length,
          items: assignmentCompletionItems
        }
      }
    });
  } catch (error) {
    next(error);
  }
};
