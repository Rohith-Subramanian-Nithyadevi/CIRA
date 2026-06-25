import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { generateToken } from '../utils/jwt';
import { BadRequestError, UnauthorizedError, NotFoundError, ForbiddenError } from '../utils/errors';

const prisma = new PrismaClient();

const registerSchema = z.object({
  role: z.enum(['STUDENT', 'FACULTY']),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  phone: z.string().optional(),
  departmentId: z.string().min(1, 'Department is required'),
  
  // Student Specific
  rollNumber: z.string().optional(),
  sectionId: z.string().optional(),
  
  // Faculty Specific
  employeeId: z.string().optional(),
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

    // Role specific validations
    if (validatedData.role === 'STUDENT') {
      if (!validatedData.rollNumber) throw new BadRequestError('Roll number is required for students');
      if (!validatedData.sectionId) throw new BadRequestError('Section is required for students');
      
      const existingRoll = await prisma.user.findUnique({ where: { rollNumber: validatedData.rollNumber }});
      if (existingRoll) throw new BadRequestError('Roll number already registered');
    }

    if (validatedData.role === 'FACULTY') {
      if (!validatedData.employeeId) throw new BadRequestError('Employee ID is required for faculty');
      
      const existingEmp = await prisma.user.findUnique({ where: { employeeId: validatedData.employeeId }});
      if (existingEmp) throw new BadRequestError('Employee ID already registered');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedData.password, salt);

    const approvalStatus = validatedData.role === 'FACULTY' ? 'PENDING' : 'APPROVED';

    const user = await prisma.user.create({
      data: {
        role: validatedData.role,
        name: validatedData.name,
        email: validatedData.email,
        password: hashedPassword,
        phone: validatedData.phone,
        departmentId: validatedData.departmentId,
        rollNumber: validatedData.rollNumber,
        sectionId: validatedData.sectionId,
        employeeId: validatedData.employeeId,
        approvalStatus
      },
    });

    // We do not issue a token for faculty immediately if they are pending approval
    if (user.approvalStatus === 'PENDING') {
      return res.status(201).json({
        status: 'success',
        message: 'Registration successful. Your account is pending administrator approval.',
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: user.role,
            phone: user.phone,
            rollNumber: user.rollNumber,
            employeeId: user.employeeId,
            approvalStatus: user.approvalStatus
          }
        }
      });
    }

    const token = generateToken({ userId: user.id, role: user.role });

    res.status(201).json({
      status: 'success',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          phone: user.phone,
          rollNumber: user.rollNumber,
          employeeId: user.employeeId,
          approvalStatus: user.approvalStatus
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

    // Only look up students, faculty, or admins
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

    // Check approval status
    if (user.approvalStatus === 'PENDING') {
      throw new ForbiddenError('Your account is pending administrator approval.', 'ERR_PENDING_APPROVAL');
    }
    if (user.approvalStatus === 'REJECTED') {
      throw new ForbiddenError('Your account has been rejected by an administrator.', 'ERR_ACCOUNT_REJECTED');
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
          phone: user.phone,
          rollNumber: user.rollNumber,
          employeeId: user.employeeId,
          departmentId: user.departmentId,
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
        phone: true,
        rollNumber: true,
        employeeId: true,
        department: true,
        section: true,
        approvalStatus: true,
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
