import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { BadRequestError } from '../utils/errors';

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

export const createDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name } = z.object({ name: z.string().min(1) }).parse(req.body);
    const existing = await prisma.department.findUnique({ where: { name } });
    if (existing) throw new BadRequestError('Department already exists');

    const department = await prisma.department.create({ data: { name } });
    res.status(201).json({ status: 'success', data: { department } });
  } catch (error) {
    next(error);
  }
};

export const deleteDepartment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.department.delete({ where: { id: id as string } });
    res.status(200).json({ status: 'success', message: 'Department deleted successfully' });
  } catch (error) {
    next(error);
  }
};

export const createSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, departmentId } = z.object({ name: z.string().min(1), departmentId: z.string().min(1) }).parse(req.body);
    const existing = await prisma.section.findUnique({ where: { name_departmentId: { name, departmentId } } });
    if (existing) throw new BadRequestError('Section already exists in this department');

    const section = await prisma.section.create({ data: { name, departmentId } });
    res.status(201).json({ status: 'success', data: { section } });
  } catch (error) {
    next(error);
  }
};

export const deleteSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await prisma.section.delete({ where: { id: id as string } });
    res.status(200).json({ status: 'success', message: 'Section deleted successfully' });
  } catch (error) {
    next(error);
  }
};
