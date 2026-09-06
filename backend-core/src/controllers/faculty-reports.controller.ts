import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { ForbiddenError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

/**
 * Get aggregated performance band statistics for Batch / Department / Section
 * Scoped to the authenticated faculty member's authorized departments.
 */
export const getPerformanceBands = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;

    const batchId = req.query.batchId as string | undefined;
    const departmentId = req.query.departmentId as string | undefined;
    const sectionId = req.query.sectionId as string | undefined;

    const quizTargetScope: any = sectionId
      ? {
          OR: [
            { targetSections: { some: { sectionId } } },
            ...(departmentId ? [{ targetDepartments: { some: { departmentId } } }] : [])
          ]
        }
      : departmentId
        ? { targetDepartments: { some: { departmentId } } }
        : undefined;

    // Faculty authorization scoping
    let mappedDeptIds: string[] = [];
    if (userRole !== 'ADMIN') {
      const mappings = await prisma.facultyDepartment.findMany({
        where: { userId },
        select: { departmentId: true }
      });
      mappedDeptIds = mappings.map(m => m.departmentId);

      // If specific department is requested, verify faculty is assigned
      if (departmentId && mappedDeptIds.length > 0 && !mappedDeptIds.includes(departmentId)) {
        throw new ForbiddenError('You are not authorized to view reports for this department', 'ERR_FORBIDDEN');
      }

      // If specific section is requested, verify its department is assigned
      if (sectionId) {
        const targetSection = await prisma.section.findUnique({
          where: { id: sectionId },
          select: { departmentId: true }
        });
        if (!targetSection) {
          throw new NotFoundError('Section not found', 'ERR_NOT_FOUND');
        }
        if (mappedDeptIds.length > 0 && !mappedDeptIds.includes(targetSection.departmentId)) {
          throw new ForbiddenError('You are not authorized to view reports for this section', 'ERR_FORBIDDEN');
        }
      }

      // If batch requested, verify at least one department in batch belongs to faculty if mappings exist
      if (batchId && !departmentId && mappedDeptIds.length > 0) {
        const batchDepts = await prisma.department.findMany({
          where: { batchId, id: { in: mappedDeptIds } },
          select: { id: true }
        });
        if (batchDepts.length === 0) {
          throw new ForbiddenError('You are not authorized for departments in this batch', 'ERR_FORBIDDEN');
        }
      }
    }

    // Build Student Filter
    const studentWhere: any = { role: 'STUDENT' };

    if (sectionId) {
      studentWhere.sectionId = sectionId;
    } else if (departmentId) {
      studentWhere.departmentId = departmentId;
    } else if (batchId) {
      if (userRole !== 'ADMIN' && mappedDeptIds.length > 0) {
        studentWhere.departmentId = { in: mappedDeptIds };
        studentWhere.department = { batchId };
      } else {
        studentWhere.department = { batchId };
      }
    } else if (userRole !== 'ADMIN' && mappedDeptIds.length > 0) {
      studentWhere.departmentId = { in: mappedDeptIds };
    }

    // Fetch students with their completed quiz attempts
    const students = await prisma.user.findMany({
      where: studentWhere,
      select: {
        id: true,
        name: true,
        rollNumber: true,
        departmentId: true,
        sectionId: true,
        quizAttempts: {
          where: {
            status: { in: ['SUBMITTED', 'EVALUATED'] },
            quiz: quizTargetScope || {
              OR: [
                { targetDepartments: { some: {} } },
                { targetSections: { some: {} } },
                { targetStudents: { some: {} } }
              ]
            }
          },
          include: {
            quiz: {
              select: { id: true, title: true, subject: true, totalMarks: true }
            }
          }
        }
      }
    });

    // Fetch sections if department is specified
    let sections: { id: string; name: string }[] = [];
    if (departmentId) {
      sections = await prisma.section.findMany({
        where: { departmentId },
        select: { id: true, name: true },
        orderBy: { name: 'asc' }
      });
    }

    // Aggregate statistics
    let poorCount = 0;
    let averageCount = 0;
    let excellentCount = 0;
    let totalPercentage = 0;
    const evaluatedStudentIds = new Set<string>();

    const subjectData: Record<string, { Poor: number; Average: number; Excellent: number }> = {};
    const sectionData: Record<string, { Poor: number; Average: number; Excellent: number }> = {};

    for (const student of students) {
      for (const attempt of student.quizAttempts) {
        const totalMarks = attempt.quiz.totalMarks > 0 ? attempt.quiz.totalMarks : 100;
        const score = attempt.totalScore || attempt.score || 0;
        const percentage = (score / totalMarks) * 100;
        totalPercentage += percentage;
        evaluatedStudentIds.add(student.id);
        const subject = attempt.quiz.subject || 'General';

        let band: 'Excellent' | 'Average' | 'Poor';
        if (percentage >= 80) {
          band = 'Excellent';
          excellentCount++;
        } else if (percentage >= 60) {
          band = 'Average';
          averageCount++;
        } else {
          band = 'Poor';
          poorCount++;
        }

        if (!subjectData[subject]) {
          subjectData[subject] = { Poor: 0, Average: 0, Excellent: 0 };
        }
        subjectData[subject][band]++;

        if (student.sectionId) {
          if (!sectionData[student.sectionId]) {
            sectionData[student.sectionId] = { Poor: 0, Average: 0, Excellent: 0 };
          }
          sectionData[student.sectionId][band]++;
        }
      }
    }

    const uniqueSubjects = Object.keys(subjectData);

    const poorObj: Record<string, any> = { band: 'Poor' };
    const avgObj: Record<string, any> = { band: 'Average' };
    const excObj: Record<string, any> = { band: 'Excellent' };

    uniqueSubjects.forEach(subject => {
      poorObj[subject] = subjectData[subject].Poor;
      avgObj[subject] = subjectData[subject].Average;
      excObj[subject] = subjectData[subject].Excellent;
    });

    const yearData = [poorObj, avgObj, excObj];

    const deptData = sections.map(sec => ({
      name: `Section ${sec.name}`,
      sectionId: sec.id,
      Excellent: sectionData[sec.id]?.Excellent || 0,
      Average: sectionData[sec.id]?.Average || 0,
      Poor: sectionData[sec.id]?.Poor || 0
    }));

    const totalAttempts = poorCount + averageCount + excellentCount;
    const percentage = (count: number) => totalAttempts > 0 ? Math.round((count / totalAttempts) * 100) : 0;

    res.status(200).json({
      status: 'success',
      data: {
        summary: {
          poor: poorCount,
          average: averageCount,
          excellent: excellentCount,
          totalStudents: students.length,
          evaluatedStudents: evaluatedStudentIds.size,
          totalAttempts,
          averageScore: totalAttempts > 0 ? Math.round(totalPercentage / totalAttempts) : 0,
          percentages: {
            poor: percentage(poorCount),
            average: percentage(averageCount),
            excellent: percentage(excellentCount)
          }
        },
        yearData,
        deptData,
        subjects: uniqueSubjects
      }
    });
  } catch (error) {
    next(error);
  }
};

export const getQuizAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    const quizId = req.params.quizId as string;

    const quiz = await prisma.quiz.findUnique({
      where: { id: quizId },
      select: {
        id: true,
        title: true,
        totalMarks: true,
        createdBy: true,
        targetDepartments: { select: { departmentId: true } },
        targetSections: { select: { sectionId: true } },
        targetStudents: { select: { userId: true } }
      }
    });

    if (!quiz) {
      throw new NotFoundError('Quiz not found', 'ERR_NOT_FOUND');
    }
    if (userRole !== 'ADMIN' && quiz.createdBy !== userId) {
      throw new ForbiddenError('You are not authorized to view this quiz report', 'ERR_FORBIDDEN');
    }

    const targetDepartmentIds = quiz.targetDepartments.map(target => target.departmentId);
    const targetSectionIds = quiz.targetSections.map(target => target.sectionId);
    const targetStudentIds = quiz.targetStudents.map(target => target.userId);
    const audienceFilters: any[] = [];
    if (targetDepartmentIds.length) audienceFilters.push({ departmentId: { in: targetDepartmentIds } });
    if (targetSectionIds.length) audienceFilters.push({ sectionId: { in: targetSectionIds } });
    if (targetStudentIds.length) audienceFilters.push({ id: { in: targetStudentIds } });

    const attempts = await prisma.quizAttempt.findMany({
      where: {
        quizId,
        status: { in: ['SUBMITTED', 'EVALUATED'] },
        user: {
          role: 'STUDENT',
          ...(audienceFilters.length ? { OR: audienceFilters } : {})
        }
      },
      select: {
        id: true,
        status: true,
        totalScore: true,
        score: true,
        user: { select: { id: true, name: true, rollNumber: true } },
        responses: {
          where: { marksAwarded: { not: null } },
          select: { marksAwarded: true, question: { select: { topic: true, marks: true } } }
        }
      }
    });

    const totalMarks = quiz.totalMarks > 0 ? quiz.totalMarks : 100;
    const leaderboard = attempts.map(attempt => {
      const rawScore = attempt.totalScore || attempt.score || 0;
      const score = Math.round(Math.max(0, Math.min(100, (rawScore / totalMarks) * 100)));
      const band = score >= 80 ? 'Excellent' : score >= 60 ? 'Average' : 'Needs support';
      return {
        id: attempt.user.id,
        roll: attempt.user.rollNumber || 'No roll number',
        name: attempt.user.name,
        score,
        band,
        status: attempt.status
      };
    }).sort((first, second) => second.score - first.score || first.name.localeCompare(second.name));

    const topicTotals: Record<string, { score: number; marks: number }> = {};
    for (const attempt of attempts) {
      for (const response of attempt.responses) {
        const topic = response.question.topic || 'Unclassified';
        if (!topicTotals[topic]) topicTotals[topic] = { score: 0, marks: 0 };
        topicTotals[topic].score += response.marksAwarded || 0;
        topicTotals[topic].marks += response.question.marks || 0;
      }
    }
    const topicAverages = Object.entries(topicTotals).map(([topic, totals]) => ({
      topic,
      avg: totals.marks > 0 ? Math.round((totals.score / totals.marks) * 100) : 0
    })).sort((first, second) => first.avg - second.avg);

    const averageScore = leaderboard.length > 0
      ? Math.round(leaderboard.reduce((sum, student) => sum + student.score, 0) / leaderboard.length)
      : 0;

    res.status(200).json({
      status: 'success',
      data: {
        quiz: { id: quiz.id, title: quiz.title },
        summary: {
          attended: attempts.length,
          evaluated: attempts.filter(attempt => attempt.status === 'EVALUATED').length,
          submitted: attempts.filter(attempt => attempt.status === 'SUBMITTED').length,
          averageScore
        },
        distribution: {
          poor: leaderboard.filter(student => student.band === 'Needs support').length,
          average: leaderboard.filter(student => student.band === 'Average').length,
          excellent: leaderboard.filter(student => student.band === 'Excellent').length
        },
        leaderboard,
        topicAverages
      }
    });
  } catch (error) {
    next(error);
  }
};
