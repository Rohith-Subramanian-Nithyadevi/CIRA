import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { generateToken } from '../utils/jwt';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../utils/errors';

const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  name: z.string().min(1, 'Name is required'),
  role: z.enum(['STUDENT', 'FACULTY', 'ADMIN']).optional(),
  department: z.string().optional(),
  year: z.number().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (existingUser) {
      throw new BadRequestError('User with this email already exists', 'ERR_USER_EXISTS');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedData.password, salt);

    const user = await prisma.user.create({
      data: {
        email: validatedData.email,
        password: hashedPassword,
        name: validatedData.name,
        role: validatedData.role || 'STUDENT',
        department: validatedData.department,
        year: validatedData.year,
      },
    });

    const token = generateToken({ userId: user.id, role: user.role });

    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: validatedData.email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid credentials', 'ERR_INVALID_CREDENTIALS');
    }

    const isMatch = await bcrypt.compare(validatedData.password, user.password);

    if (!isMatch) {
      throw new UnauthorizedError('Invalid credentials', 'ERR_INVALID_CREDENTIALS');
    }

    const token = generateToken({ userId: user.id, role: user.role });

    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        },
        token,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      throw new UnauthorizedError('User not authenticated', 'ERR_NOT_AUTHENTICATED');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        year: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundError('User not found', 'ERR_USER_NOT_FOUND');
    }

    res.status(200).json({
      status: 'success',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};
