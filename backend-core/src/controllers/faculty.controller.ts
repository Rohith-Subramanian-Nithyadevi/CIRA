import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/prisma';
import { z } from 'zod';
import { NotFoundError, ForbiddenError, BadRequestError, UnauthorizedError } from '../utils/errors';
import { parseFacultyPasswordChange } from '../utils/faculty-security';
import { buildFacultyStudentWhere } from '../utils/faculty-student-scope';
import { issuePasswordReset } from '../services/password-reset.service';

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
      },
      include: {
        user: {
          select: { departmentId: true, sectionId: true }
        }
      }
    });

    if (!result) {
      throw new NotFoundError('Result not found for this student and assessment', 'ERR_RESULT_NOT_FOUND');
    }

    const facultyUserId = req.user?.userId;
    const facultyRole = req.user?.role;

    // Authorization verification: ADMINs can grade any student.
    // FACULTY members must be mapped to the student's department or section.
    if (facultyRole !== 'ADMIN' && facultyUserId) {
      const studentDeptId = result.user?.departmentId;
      const studentSectionId = result.user?.sectionId;

      const hasDeptMapping = studentDeptId
        ? await prisma.facultyDepartment.findFirst({
            where: { userId: facultyUserId, departmentId: studentDeptId }
          })
        : null;

      const hasSectionMapping = studentSectionId
        ? await prisma.facultySection.findFirst({
            where: { userId: facultyUserId, sectionId: studentSectionId }
          })
        : null;

      if (!hasDeptMapping && !hasSectionMapping) {
        throw new ForbiddenError(
          'You are not authorized to evaluate students outside your mapped departments or sections.',
          'ERR_FORBIDDEN_FACULTY_EVALUATION'
        );
      }
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
    const page = Math.max(1, Number.parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit || '25'), 10) || 25));
    const filters = getStudentFilters(req);
    const where = buildFacultyStudentWhere(req.facultyScope, filters, req.user?.role === 'ADMIN');
    const [total, records] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy: [{ name: 'asc' }, { rollNumber: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true, name: true, rollNumber: true, departmentId: true, sectionId: true,
          department: { select: { id: true, name: true, batch: { select: { id: true, name: true, startYear: true } } } },
          section: { select: { id: true, name: true } },
        },
      }),
    ]);
    const students = records.map((student) => ({
      id: student.id,
      name: student.name,
      rollNumber: student.rollNumber,
      departmentId: student.departmentId,
      department: student.department?.name || 'Unassigned',
      year: student.department?.batch?.startYear ?? null,
      sectionId: student.sectionId,
      section: student.section?.name || 'Unassigned',
    }));

    res.status(200).json({ status: 'success', data: { students, pagination: { page, limit, total, pages: Math.ceil(total / limit) } } });
  } catch (error) {
    next(error);
  }
};

const getStudentFilters = (req: Request) => {
  const rawYear = req.query.year;
  const year = rawYear === undefined || rawYear === '' ? undefined : Number(rawYear);
  if (year !== undefined && !Number.isInteger(year)) throw new BadRequestError('Year must be a valid integer.', 'ERR_INVALID_YEAR');
  return {
    year,
    departmentId: typeof req.query.departmentId === 'string' ? req.query.departmentId : undefined,
    sectionId: typeof req.query.sectionId === 'string' ? req.query.sectionId : undefined,
    batchId: typeof req.query.batchId === 'string' ? req.query.batchId : undefined,
    search: typeof req.query.search === 'string' ? req.query.search : undefined,
  };
};

export const getStudentFilterOptions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const filters = getStudentFilters(req);
    const isAdmin = req.user?.role === 'ADMIN';
    const scope = req.facultyScope;
    const [yearRecords, departmentRecords, sectionRecords] = await Promise.all([
      prisma.user.findMany({ where: buildFacultyStudentWhere(scope, {}, isAdmin), select: { department: { select: { batch: { select: { startYear: true } } } } } }),
      prisma.user.findMany({ where: buildFacultyStudentWhere(scope, { year: filters.year }, isAdmin), select: { department: { select: { id: true, name: true, batchId: true, batch: { select: { startYear: true } } } } } }),
      prisma.user.findMany({ where: buildFacultyStudentWhere(scope, { year: filters.year, departmentId: filters.departmentId }, isAdmin), select: { section: { select: { id: true, name: true, departmentId: true } } } }),
    ]);
    const years = [...new Set(yearRecords.map((row) => row.department?.batch?.startYear).filter((year): year is number => typeof year === 'number'))].sort((a, b) => b - a);
    const departments = [...new Map(departmentRecords.flatMap((row) => row.department ? [[row.department.id, { ...row.department, startYear: row.department.batch.startYear }] as const] : [])).values()].sort((a, b) => a.name.localeCompare(b.name));
    const sections = [...new Map(sectionRecords.flatMap((row) => row.section ? [[row.section.id, row.section] as const] : [])).values()].sort((a, b) => a.name.localeCompare(b.name));
    res.status(200).json({ status: 'success', data: { years, departments, sections } });
  } catch (error) {
    next(error);
  }
};

export const resetStudentPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.user?.role !== 'FACULTY' || !req.user.userId) {
      throw new ForbiddenError('Only assigned faculty can initiate a student password reset.', 'ERR_FORBIDDEN_STUDENT_RESET');
    }
    const student = await prisma.user.findFirst({
      where: { AND: [buildFacultyStudentWhere(req.facultyScope), { id: req.params.studentId as string }] },
      select: { id: true, role: true, authProvider: true, password: true, personalEmail: true },
    });
    if (!student) throw new NotFoundError('Student was not found in your assigned classes.', 'ERR_STUDENT_OUT_OF_SCOPE');
    await issuePasswordReset(student);
    res.status(200).json({ status: 'success', message: 'Password reset instructions were sent to the student’s registered recovery email.' });
  } catch (error) {
    next(error);
  }
};

export const searchStudent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rollNumber = req.query.rollNumber as string;
    const isAdmin = req.user?.role === 'ADMIN';

    if (!rollNumber || typeof rollNumber !== 'string' || rollNumber.trim().length === 0) {
      throw new BadRequestError('Roll number query parameter is required', 'ERR_INVALID_ROLL');
    }

    const trimmedRoll = rollNumber.trim();

    // Query student by rollNumber (case-insensitive)
    const student = await prisma.user.findFirst({
      where: {
        AND: [
          buildFacultyStudentWhere(req.facultyScope, getStudentFilters(req), isAdmin),
          { rollNumber: { equals: trimmedRoll, mode: 'insensitive' } },
        ],
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
    const isAdmin = req.user?.role === 'ADMIN';

    if (!studentId) {
      throw new BadRequestError('Student ID is required', 'ERR_INVALID_STUDENT_ID');
    }

    const student = await prisma.user.findFirst({
      where: { AND: [buildFacultyStudentWhere(req.facultyScope, {}, isAdmin), { id: studentId }] },
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

export const updateFacultyProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) throw new UnauthorizedError('Unauthorized');

    if ((req as any).user?.role === 'FACULTY') {
      const { currentPassword, newPassword } = parseFacultyPasswordChange(req.body);
      const faculty = await prisma.user.findUnique({
        where: { id: userId },
        select: { password: true, authProvider: true },
      });
      if (!faculty) throw new NotFoundError('Faculty account not found.', 'ERR_USER_NOT_FOUND');
      if (faculty.authProvider === 'GOOGLE') {
        throw new BadRequestError('Use your Google account to change this password.', 'ERR_EXTERNAL_PASSWORD_CHANGE');
      }
      if (!(await bcrypt.compare(currentPassword, faculty.password))) {
        throw new UnauthorizedError('Current password is incorrect.', 'ERR_CURRENT_PASSWORD_INVALID');
      }

      const salt = await bcrypt.genSalt(10);
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { password: await bcrypt.hash(newPassword, salt) },
        select: {
          id: true,
          name: true,
          email: true,
          personalEmail: true,
          role: true,
          phone: true,
          employeeId: true,
          subject: true,
          approvalStatus: true,
          createdAt: true,
        },
      });
      return res.json({ success: true, data: updatedUser });
    }

    const { name, phone, password, employeeId, subject } = req.body;
    const data: any = {};
    if (name !== undefined) data.name = name;
    if (phone !== undefined) data.phone = phone;
    if (employeeId !== undefined) data.employeeId = employeeId;
    if (subject !== undefined) data.subject = subject;

    if (password) {
      const salt = await bcrypt.genSalt(10);
      data.password = await bcrypt.hash(password, salt);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        personalEmail: true,
        role: true,
        phone: true,
        employeeId: true,
        subject: true,
        approvalStatus: true,
        createdAt: true,
      }
    });

    res.json({ success: true, data: updatedUser });
  } catch (error) {
    next(error);
  }
};
