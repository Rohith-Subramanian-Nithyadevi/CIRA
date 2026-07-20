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
  personalEmail: z.string().email('Valid personal email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters long'),
  phone: z.string().optional(),

  // Student Specific
  departmentId: z.string().optional(),

  // Student Specific
  rollNumber: z.string().optional(),
  sectionId: z.string().optional(),

  // Faculty Specific
  employeeId: z.string().optional(),
  subject: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: validatedData.email },
          { personalEmail: validatedData.personalEmail }
        ]
      }
    });

    if (existingUser) {
      throw new BadRequestError('User with this college or personal email already exists', 'ERR_USER_EXISTS');
    }

    // Role specific validations
    if (validatedData.role === 'STUDENT') {
      if (!validatedData.departmentId) throw new BadRequestError('Department is required for students');
      if (!validatedData.rollNumber) throw new BadRequestError('Roll number is required for students');
      if (!validatedData.sectionId) throw new BadRequestError('Section is required for students');

      const existingRoll = await prisma.user.findUnique({ where: { rollNumber: validatedData.rollNumber } });
      if (existingRoll) throw new BadRequestError('Roll number already registered');
    }

    if (validatedData.role === 'FACULTY') {
      if (!validatedData.email.toLowerCase().endsWith('@ch.amrita.edu')) {
        throw new BadRequestError('Faculty email must end with @ch.amrita.edu');
      }
      if (!validatedData.employeeId) throw new BadRequestError('Employee ID is required for faculty');
      if (!validatedData.subject) throw new BadRequestError('Subject is required for faculty');

      const existingEmp = await prisma.user.findUnique({ where: { employeeId: validatedData.employeeId } });
      if (existingEmp) throw new BadRequestError('Employee ID already registered');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(validatedData.password, salt);

    const approvalStatus = validatedData.role === 'FACULTY' ? 'PENDING' : 'APPROVED';
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

    const user = await prisma.user.create({
      data: {
        role: validatedData.role,
        name: validatedData.name,
        email: validatedData.email,
        personalEmail: validatedData.personalEmail,
        password: hashedPassword,
        phone: validatedData.phone,
        departmentId: validatedData.departmentId,
        rollNumber: validatedData.rollNumber,
        sectionId: validatedData.sectionId,
        employeeId: validatedData.employeeId,
        subject: validatedData.subject,
        approvalStatus,
        isEmailVerified: false,
        verificationCode,
      },
    });

    // Send verification email
    await sendVerificationEmail(validatedData.personalEmail, verificationCode);

    // Since email verification is required, we don't issue the token immediately
    res.status(201).json({
      status: 'success',
      message: 'Registration successful. Please verify your email.',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

export const verifyEmail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) throw new BadRequestError('Email and verification code are required');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundError('User not found');

    if (user.isEmailVerified) throw new BadRequestError('Email already verified');

    if (user.verificationCode !== code) throw new BadRequestError('Invalid verification code');

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        isEmailVerified: true,
        verificationCode: null,
      },
    });

    if (updatedUser.approvalStatus === 'PENDING') {
      // Notify admin(s)
      try {
        const admins = await prisma.user.findMany({ where: { role: 'ADMIN' } });
        const adminEmails = admins.map(a => a.email);
        if (adminEmails.length === 0) {
          adminEmails.push('admin@amrita.edu');
        }

        for (const adminEmail of adminEmails) {
          await sendAdminApprovalRequestEmail(adminEmail, {
            name: updatedUser.name,
            email: updatedUser.email,
            employeeId: updatedUser.employeeId || 'N/A',
            subject: updatedUser.subject || 'N/A',
          });
        }
      } catch (err) {
        console.error('Failed to notify admin about pending approval:', err);
      }

      return res.status(200).json({
        status: 'success',
        message: 'Email verified! Your account is pending administrator approval.',
        data: { user: { role: updatedUser.role } }
      });
    }

    const token = generateToken({ userId: updatedUser.id, role: updatedUser.role });
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
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

    if (!user.isEmailVerified && user.role !== 'ADMIN') {
      throw new ForbiddenError('Please verify your personal email first.', 'ERR_EMAIL_NOT_VERIFIED');
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
          subject: user.subject,
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



export const forgotPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) throw new BadRequestError('Email is required');

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(200).json({
        status: 'success',
        message: 'If the email matches a registered account, a reset code has been sent to your personal email.'
      });
    }

    if (!user.personalEmail) {
      throw new BadRequestError('No personal email configured for this account. Please contact an administrator.');
    }

    const resetCode = Math.floor(100000 + Math.random() * 900000).toString();

    await prisma.user.update({
      where: { id: user.id },
      data: { verificationCode: resetCode }
    });

    await sendPasswordResetEmail(user.personalEmail, resetCode);

    res.status(200).json({
      status: 'success',
      message: 'If the email matches a registered account, a reset code has been sent to your personal email.'
    });
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      throw new BadRequestError('Email, verification code, and new password are required');
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new NotFoundError('User not found');

    if (!user.verificationCode || user.verificationCode !== code) {
      throw new BadRequestError('Invalid or expired verification code');
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        verificationCode: null
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Password reset successful. You can now login with your new password.'
    });
  } catch (error) {
    next(error);
  }
};

