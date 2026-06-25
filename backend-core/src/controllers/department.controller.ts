import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getAllDepartments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const departments = await prisma.department.findMany({
      include: {
        sections: true
      }
    });

    res.status(200).json({
      status: 'success',
      data: { departments }
    });
  } catch (error) {
    next(error);
  }
};
