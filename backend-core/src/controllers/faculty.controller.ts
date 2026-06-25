import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { NotFoundError } from '../utils/errors';

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
    const { departmentId } = z.object({ departmentId: z.string() }).parse(req.body);
    const userId = req.user!.userId;

    const mapping = await prisma.facultyDepartment.create({
      data: { userId, departmentId }
    });

    res.status(201).json({ status: 'success', data: { mapping } });
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

export const getEnrolledDepartments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.userId;

    const departments = await prisma.facultyDepartment.findMany({
      where: { userId },
      include: { department: true }
    });

    res.status(200).json({ status: 'success', data: { departments: departments.map(d => d.department) } });
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
    
    const deptIds = mappedDepts.map(d => d.departmentId);

    // Fetch students belonging to those departments
    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        departmentId: { in: deptIds }
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
