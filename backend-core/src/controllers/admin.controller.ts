import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/prisma';
import { BadRequestError } from '../utils/errors';
import { NotFoundError } from '../utils/errors';
import bcrypt from 'bcryptjs';
import XLSX from 'xlsx';

const normalize = (value: unknown) => String(value ?? '').trim();

export const importStudents = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = (req as any).file as Express.Multer.File | undefined;
    // We no longer strictly require departmentId from the UI since we extract it from roll number.
    
    if (!file) throw new BadRequestError('Upload a CSV or XLSX student file', 'ERR_FILE_MISSING');

    const workbook = XLSX.read(file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    if (rows.length === 0) throw new BadRequestError('The uploaded file contains no student rows', 'ERR_FILE_EMPTY');

    const created: { row: number; name: string; rollNumber: string; temporaryPassword: string; department: string; section: string; batch: string }[] = [];
    const rejectedRows: { row: number; reason: string }[] = [];
    const seenRollNumbers = new Set<string>();
    const seenEmails = new Set<string>();
    const salt = await bcrypt.genSalt(10);

    // Regex for Amrita Chennai Roll Numbers
    // e.g., CH.SC.U4CSE24142
    // 1: CH, 2: SC, 3: U, 4: 4, 5: CSE, 6: 24, 7: 1, 8: 42
    const rollRegex = /^(CH)\.([A-Z]+)\.([A-Z])([0-9])([A-Z]+)(\d{2})(\d)(\d{2})$/i;

    // Cache to avoid hitting DB for every row
    const batchCache = new Map<string, string>();
    const deptCache = new Map<string, string>();
    const sectionCache = new Map<string, string>();

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2;
      const name = normalize(row.name || row.Name);
      const email = normalize(row.email || row.Email).toLowerCase();
      const rollNumber = normalize(row.rollNumber || row.RollNumber || row['Roll Number']).toUpperCase();
      const phone = normalize(row.phone || row.Phone) || undefined;
      const personalEmail = normalize(row.personalEmail || row.PersonalEmail || row['Personal Email']).toLowerCase() || email;
      const temporaryPassword = normalize(row.password || row.Password) || `Cira@${rollNumber}`;

      if (!name || !email || !rollNumber) {
        rejectedRows.push({ row: rowNumber, reason: 'name, email, and rollNumber are required' });
        continue;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        rejectedRows.push({ row: rowNumber, reason: 'email is invalid' });
        continue;
      }
      if (temporaryPassword.length < 8) {
        rejectedRows.push({ row: rowNumber, reason: 'password must be at least 8 characters' });
        continue;
      }

      // Roll number parsing
      const match = rollNumber.match(rollRegex);
      if (!match) {
        rejectedRows.push({ row: rowNumber, reason: 'Roll number must match Chennai campus format (e.g. CH.SC.U4CSE24142)' });
        continue;
      }

      const [, campus, school, degree, yearsStr, branchStr, startYearStr, sectionIndexStr, specificId] = match;
      
      const startYear = 2000 + parseInt(startYearStr, 10);
      const years = parseInt(yearsStr, 10);
      const endYear = startYear + years;
      const batchName = `${startYear} -${endYear.toString().slice(-2)}`; // e.g. 2024 -28
      
      const sectionLetter = String.fromCharCode(65 + parseInt(sectionIndexStr, 10)); // 0->A, 1->B, 2->C

      if (seenRollNumbers.has(rollNumber) || seenEmails.has(email)) {
        rejectedRows.push({ row: rowNumber, reason: 'duplicate rollNumber or email in this file' });
        continue;
      }

      const existing = await prisma.user.findFirst({
        where: { OR: [{ rollNumber }, { email }, { personalEmail }] },
        select: { rollNumber: true, email: true, personalEmail: true }
      });
      if (existing) {
        rejectedRows.push({ row: rowNumber, reason: 'student already exists with this rollNumber or email' });
        continue;
      }

      // Upsert Batch
      let batchId = batchCache.get(batchName);
      if (!batchId) {
        let batch = await prisma.batch.findUnique({ where: { name: batchName } });
        if (!batch) {
          batch = await prisma.batch.create({ data: { name: batchName, startYear } });
        }
        batchId = batch.id;
        batchCache.set(batchName, batchId);
      }

      // Upsert Department
      const deptKey = `${branchStr}-${batchId}`;
      let departmentId = deptCache.get(deptKey);
      if (!departmentId) {
        let dept = await prisma.department.findUnique({ where: { name_batchId: { name: branchStr, batchId } } });
        if (!dept) {
          dept = await prisma.department.create({ data: { name: branchStr, batchId } });
        }
        departmentId = dept.id;
        deptCache.set(deptKey, departmentId);
      }

      // Upsert Section
      const secKey = `${sectionLetter}-${departmentId}`;
      let sectionId = sectionCache.get(secKey);
      if (!sectionId) {
        let sec = await prisma.section.findUnique({ where: { name_departmentId: { name: sectionLetter, departmentId } } });
        if (!sec) {
          sec = await prisma.section.create({ data: { name: sectionLetter, departmentId } });
        }
        sectionId = sec.id;
        sectionCache.set(secKey, sectionId);
      }

      const passwordHash = await bcrypt.hash(temporaryPassword, salt);
      await prisma.user.create({
        data: {
          role: 'STUDENT',
          name,
          email,
          personalEmail,
          password: passwordHash,
          phone,
          rollNumber,
          departmentId,
          sectionId,
          approvalStatus: 'APPROVED'
        }
      });
      seenRollNumbers.add(rollNumber);
      seenEmails.add(email);
      created.push({ row: rowNumber, name, rollNumber, temporaryPassword, department: branchStr, section: sectionLetter, batch: batchName });
    }

    res.status(200).json({
      status: 'success',
      data: { imported: created.length, rejected: rejectedRows.length, created, rejectedRows }
    });
  } catch (error) {
    next(error);
  }
};

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

export const getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        department: true,
        approvalStatus: true,
        createdAt: true
      }
    });

    res.status(200).json({
      status: 'success',
      data: { users }
    });
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    if (id === req.user?.userId) {
      throw new BadRequestError('Cannot delete yourself');
    }

    await prisma.user.delete({
      where: { id: id as string }
    });

    res.status(200).json({
      status: 'success',
      message: 'User deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};
