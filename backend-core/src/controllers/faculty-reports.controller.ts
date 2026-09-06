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
            status: { in: ['SUBMITTED', 'EVALUATED'] }
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

    const subjectData: Record<string, { Poor: number; Average: number; Excellent: number }> = {};
    const sectionData: Record<string, { Poor: number; Average: number; Excellent: number }> = {};

    for (const student of students) {
      for (const attempt of student.quizAttempts) {
        const totalMarks = attempt.quiz.totalMarks > 0 ? attempt.quiz.totalMarks : 100;
        const score = attempt.totalScore || attempt.score || 0;
        const percentage = (score / totalMarks) * 100;
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

    res.status(200).json({
      status: 'success',
      data: {
        summary: {
          poor: poorCount,
          average: averageCount,
          excellent: excellentCount,
          totalStudents: students.length,
          totalAttempts: poorCount + averageCount + excellentCount
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
