import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

export const getAllFaculty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const faculty = await prisma.user.findMany({
      where: { 
        role: 'FACULTY'
      },
      select: {
        id: true,
        name: true,
        email: true,
        employeeId: true,
        department: true,
        approvalStatus: true,
        createdAt: true
      }
    });

    res.status(200).json({
      status: 'success',
      data: { faculty }
    });
  } catch (error) {
    next(error);
  }
};

export const approveFaculty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { facultyId } = req.params;
    const { status } = req.body; // 'APPROVED' or 'REJECTED'

    if (!['APPROVED', 'REJECTED'].includes(status)) {
      return res.status(400).json({ status: 'error', message: 'Invalid status. Must be APPROVED or REJECTED.' });
    }

    const faculty = await prisma.user.findUnique({ where: { id: facultyId as string } });
    if (!faculty || faculty.role !== 'FACULTY') {
      throw new NotFoundError('Faculty member not found');
    }

    const updated = await prisma.user.update({
      where: { id: facultyId as string },
      data: { approvalStatus: status as any }
    });

    res.status(200).json({
      status: 'success',
      data: { user: updated }
    });
  } catch (error) {
    next(error);
  }
};
