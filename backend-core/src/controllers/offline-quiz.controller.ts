import { Request, Response, NextFunction } from 'express';
import xlsx from 'xlsx';
import { prisma } from '../config/prisma';
import { BadRequestError, NotFoundError } from '../utils/errors';
import { buildFacultyStudentWhere } from '../utils/faculty-student-scope';

export interface QuestionDefinition {
  questionNumber: number;
  topic: string;
  maxMarks: number;
  questionText?: string;
}

export interface MarksheetRowInput {
  identifier: string; // Roll number or email
  studentName?: string;
  questionScores?: Record<string, number>;
  totalScore?: number;
}

export interface ValidatedRowResult {
  rowNumber: number;
  identifier: string;
  matched: boolean;
  student?: {
    id: string;
    name: string;
    rollNumber: string | null;
    email: string;
    departmentName?: string;
    sectionName?: string;
  };
  questionScores?: Record<string, number>;
  totalScore: number;
  percentage: number;
  band: 'EXCELLENT' | 'AVERAGE' | 'POOR';
  errors: string[];
}

/**
 * Normalizes headers and extracts roll/email and scores from raw sheet JSON
 */
export const extractRowData = (
  rawRow: Record<string, any>,
  mode: 'QUESTION_WISE' | 'TOTAL_ONLY',
  questions?: QuestionDefinition[]
): { identifier: string; studentName?: string; questionScores: Record<string, number>; totalScore?: number } => {
  const keys = Object.keys(rawRow);
  const getVal = (regex: RegExp) => {
    const k = keys.find(key => regex.test(key.trim().toLowerCase()));
    return k !== undefined ? rawRow[k] : undefined;
  };

  // Find identifier (roll or email)
  const identifierVal = getVal(/^(roll|roll\s*no|roll_no|rollnumber|registration|reg\s*no|reg_no|email|student\s*email|student_id|identifier)$/i)
    ?? getVal(/roll|reg|email/i);
  const identifier = identifierVal !== undefined ? String(identifierVal).trim() : '';

  // Optional student name
  const nameVal = getVal(/^(name|student\s*name|student_name|full\s*name)$/i);
  const studentName = nameVal !== undefined ? String(nameVal).trim() : undefined;

  const questionScores: Record<string, number> = {};
  let totalScore: number | undefined;

  if (mode === 'QUESTION_WISE' && questions && questions.length > 0) {
    questions.forEach(q => {
      const qNum = q.questionNumber;
      // Match column such as "Q1", "Q 1", "Question 1", "Q1 (Topic - 5)"
      const regex = new RegExp(`^(q\\s*${qNum}|question\\s*${qNum})([\\s(_:-].*)?$`, 'i');
      const val = getVal(regex);
      if (val !== undefined && val !== '') {
        const num = Number(val);
        questionScores[String(qNum)] = isNaN(num) ? 0 : num;
      } else {
        questionScores[String(qNum)] = 0;
      }
    });
  } else {
    // Mode B: Total only
    const scoreVal = getVal(/^(total|total\s*marks|total\s*score|obtained\s*marks|obtained|score|marks)$/i);
    if (scoreVal !== undefined && scoreVal !== '') {
      const num = Number(scoreVal);
      totalScore = isNaN(num) ? 0 : num;
    }
  }

  return { identifier, studentName, questionScores, totalScore };
};

/**
 * Validate offline marksheet rows before committing
 */
export const validateOfflineMarksheet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = (req as any).user?.role;
    const {
      mode,
      totalMarks: rawTotalMarks,
      questions = [],
      overallTopics = [],
      rows = []
    } = req.body;

    if (mode !== 'QUESTION_WISE' && mode !== 'TOTAL_ONLY') {
      throw new BadRequestError('Mode must be either QUESTION_WISE or TOTAL_ONLY', 'ERR_INVALID_MODE');
    }

    let calculatedTotalMarks = Number(rawTotalMarks) || 0;
    const sanitizedQuestions: QuestionDefinition[] = [];

    if (mode === 'QUESTION_WISE') {
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new BadRequestError('At least one question definition is required for QUESTION_WISE mode.', 'ERR_EMPTY_QUESTIONS');
      }

      let qMarksSum = 0;
      questions.forEach((q: any, idx: number) => {
        const qNum = Number(q.questionNumber) || (idx + 1);
        const maxMarks = Number(q.maxMarks) || 0;
        const topic = typeof q.topic === 'string' && q.topic.trim() ? q.topic.trim() : 'General';
        const questionText = typeof q.questionText === 'string' ? q.questionText.trim() : undefined;

        if (maxMarks <= 0) {
          throw new BadRequestError(`Question ${qNum} must have maxMarks > 0`, 'ERR_INVALID_MARKS');
        }
        qMarksSum += maxMarks;
        sanitizedQuestions.push({ questionNumber: qNum, topic, maxMarks, questionText });
      });

      if (calculatedTotalMarks <= 0 || Math.abs(calculatedTotalMarks - qMarksSum) > 0.01) {
        calculatedTotalMarks = qMarksSum;
      }
    } else {
      if (calculatedTotalMarks <= 0) {
        throw new BadRequestError('Total marks must be greater than 0 for TOTAL_ONLY mode.', 'ERR_INVALID_TOTAL_MARKS');
      }
    }

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestError('Marksheet rows cannot be empty.', 'ERR_EMPTY_ROWS');
    }

    // Extract all identifiers
    const identifiers = rows
      .map((r: any) => String(r.identifier || '').trim())
      .filter((id: string) => id.length > 0);

    const studentWhere = buildFacultyStudentWhere(req.facultyScope, {}, userRole === 'ADMIN');

    // Query students
    const registeredStudents = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        AND: [
          studentWhere,
          {
            OR: [
              { rollNumber: { in: identifiers, mode: 'insensitive' } },
              { email: { in: identifiers.map(id => id.toLowerCase()) } }
            ]
          }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        rollNumber: true,
        departmentId: true,
        sectionId: true,
        department: { select: { id: true, name: true } },
        section: { select: { id: true, name: true } }
      }
    });

    const studentByRoll = new Map<string, typeof registeredStudents[0]>();
    const studentByEmail = new Map<string, typeof registeredStudents[0]>();

    registeredStudents.forEach(s => {
      if (s.rollNumber) studentByRoll.set(s.rollNumber.trim().toLowerCase(), s);
      if (s.email) studentByEmail.set(s.email.trim().toLowerCase(), s);
    });

    const validatedRows: ValidatedRowResult[] = [];
    const seenIdentifiers = new Set<string>();

    rows.forEach((row: any, index: number) => {
      const rowNum = index + 1;
      const rawId = String(row.identifier || '').trim();
      const lowerId = rawId.toLowerCase();
      const errors: string[] = [];

      if (!rawId) {
        errors.push('Student identifier (Roll Number or Email) is required.');
      } else if (seenIdentifiers.has(lowerId)) {
        errors.push(`Duplicate entry for student "${rawId}" in this marksheet.`);
      } else {
        seenIdentifiers.add(lowerId);
      }

      const matchedStudent = studentByRoll.get(lowerId) || studentByEmail.get(lowerId);
      if (rawId && !matchedStudent) {
        errors.push(`No registered student found matching "${rawId}" within your assigned scope.`);
      }

      let rowTotalScore = 0;
      const parsedScores: Record<string, number> = {};

      if (mode === 'QUESTION_WISE') {
        sanitizedQuestions.forEach(q => {
          const key = String(q.questionNumber);
          const rawScore = row.questionScores?.[key] ?? row.questionScores?.[`Q${q.questionNumber}`] ?? 0;
          const score = Number(rawScore);
          if (isNaN(score) || score < 0) {
            errors.push(`Q${q.questionNumber}: Score must be a positive number.`);
          } else if (score > q.maxMarks) {
            errors.push(`Q${q.questionNumber}: Score (${score}) exceeds question maximum (${q.maxMarks}).`);
          }
          const validScore = isNaN(score) ? 0 : Math.max(0, score);
          parsedScores[key] = validScore;
          rowTotalScore += validScore;
        });
      } else {
        const score = Number(row.totalScore);
        if (isNaN(score) || score < 0) {
          errors.push('Total score must be a non-negative number.');
        } else if (score > calculatedTotalMarks) {
          errors.push(`Total score (${score}) exceeds quiz maximum marks (${calculatedTotalMarks}).`);
        }
        rowTotalScore = isNaN(score) ? 0 : Math.max(0, score);
      }

      const percentage = calculatedTotalMarks > 0 ? Math.round((rowTotalScore / calculatedTotalMarks) * 100) : 0;
      const band: 'EXCELLENT' | 'AVERAGE' | 'POOR' = percentage >= 80 ? 'EXCELLENT' : percentage >= 60 ? 'AVERAGE' : 'POOR';

      validatedRows.push({
        rowNumber: rowNum,
        identifier: rawId,
        matched: Boolean(matchedStudent),
        student: matchedStudent ? {
          id: matchedStudent.id,
          name: matchedStudent.name,
          rollNumber: matchedStudent.rollNumber,
          email: matchedStudent.email,
          departmentName: matchedStudent.department?.name,
          sectionName: matchedStudent.section?.name
        } : undefined,
        questionScores: mode === 'QUESTION_WISE' ? parsedScores : undefined,
        totalScore: rowTotalScore,
        percentage,
        band,
        errors
      });
    });

    const validRowsCount = validatedRows.filter(r => r.matched && r.errors.length === 0).length;
    const invalidRowsCount = validatedRows.length - validRowsCount;

    res.status(200).json({
      status: 'success',
      data: {
        mode,
        totalMarks: calculatedTotalMarks,
        questions: sanitizedQuestions,
        overallTopics,
        summary: {
          totalRows: validatedRows.length,
          validRowsCount,
          invalidRowsCount,
          readyToImport: validRowsCount > 0 && invalidRowsCount === 0
        },
        rows: validatedRows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Import offline marksheet and persist Quiz, Question stubs, and QuizAttempts
 */
export const importOfflineMarksheet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const facultyId = (req as any).user?.userId;
    const userRole = (req as any).user?.role;
    if (!facultyId) throw new BadRequestError('Faculty not authenticated', 'UNAUTHORIZED');

    const {
      title,
      subject,
      mode,
      totalMarks: rawTotalMarks,
      passingMarks: rawPassingMarks,
      answersPublished = true,
      targetDepartmentIds = [],
      targetSectionIds = [],
      questions = [],
      overallTopics = [],
      rows = []
    } = req.body;

    if (!title || typeof title !== 'string' || !title.trim()) {
      throw new BadRequestError('Quiz title is required.', 'ERR_MISSING_TITLE');
    }

    if (mode !== 'QUESTION_WISE' && mode !== 'TOTAL_ONLY') {
      throw new BadRequestError('Mode must be either QUESTION_WISE or TOTAL_ONLY', 'ERR_INVALID_MODE');
    }

    let calculatedTotalMarks = Number(rawTotalMarks) || 0;
    const sanitizedQuestions: QuestionDefinition[] = [];

    if (mode === 'QUESTION_WISE') {
      if (!Array.isArray(questions) || questions.length === 0) {
        throw new BadRequestError('Questions breakdown is required for QUESTION_WISE mode.', 'ERR_EMPTY_QUESTIONS');
      }

      let qMarksSum = 0;
      questions.forEach((q: any, idx: number) => {
        const qNum = Number(q.questionNumber) || (idx + 1);
        const maxMarks = Number(q.maxMarks) || 0;
        const topic = typeof q.topic === 'string' && q.topic.trim() ? q.topic.trim() : 'General';
        const questionText = typeof q.questionText === 'string' ? q.questionText.trim() : undefined;

        if (maxMarks <= 0) {
          throw new BadRequestError(`Question ${qNum} must have maxMarks > 0`, 'ERR_INVALID_MARKS');
        }
        qMarksSum += maxMarks;
        sanitizedQuestions.push({ questionNumber: qNum, topic, maxMarks, questionText });
      });

      calculatedTotalMarks = qMarksSum;
    } else {
      if (calculatedTotalMarks <= 0) {
        throw new BadRequestError('Total marks must be greater than 0.', 'ERR_INVALID_TOTAL_MARKS');
      }
    }

    const passingMarks = Number(rawPassingMarks) > 0 ? Number(rawPassingMarks) : Math.round(calculatedTotalMarks * 0.4);

    if (!Array.isArray(rows) || rows.length === 0) {
      throw new BadRequestError('Marksheet rows cannot be empty.', 'ERR_EMPTY_ROWS');
    }

    // Match students server-side
    const identifiers = rows
      .map((r: any) => String(r.identifier || '').trim())
      .filter((id: string) => id.length > 0);

    const studentWhere = buildFacultyStudentWhere(req.facultyScope, {}, userRole === 'ADMIN');

    const registeredStudents = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        AND: [
          studentWhere,
          {
            OR: [
              { rollNumber: { in: identifiers, mode: 'insensitive' } },
              { email: { in: identifiers.map(id => id.toLowerCase()) } }
            ]
          }
        ]
      },
      select: {
        id: true,
        name: true,
        email: true,
        rollNumber: true,
        departmentId: true,
        sectionId: true
      }
    });

    const studentByRoll = new Map<string, typeof registeredStudents[0]>();
    const studentByEmail = new Map<string, typeof registeredStudents[0]>();

    registeredStudents.forEach(s => {
      if (s.rollNumber) studentByRoll.set(s.rollNumber.trim().toLowerCase(), s);
      if (s.email) studentByEmail.set(s.email.trim().toLowerCase(), s);
    });

    const validRowsToCreate: Array<{
      studentId: string;
      totalScore: number;
      percentage: number;
      band: 'EXCELLENT' | 'AVERAGE' | 'POOR';
      questionScores?: Record<string, number>;
    }> = [];

    const seenStudentIds = new Set<string>();

    rows.forEach((row: any) => {
      const rawId = String(row.identifier || '').trim().toLowerCase();
      const student = studentByRoll.get(rawId) || studentByEmail.get(rawId);
      if (!student || seenStudentIds.has(student.id)) return;

      seenStudentIds.add(student.id);

      let rowTotalScore = 0;
      const parsedScores: Record<string, number> = {};

      if (mode === 'QUESTION_WISE') {
        sanitizedQuestions.forEach(q => {
          const key = String(q.questionNumber);
          const rawScore = Number(row.questionScores?.[key] ?? row.questionScores?.[`Q${q.questionNumber}`] ?? 0);
          const validScore = isNaN(rawScore) ? 0 : Math.min(q.maxMarks, Math.max(0, rawScore));
          parsedScores[key] = validScore;
          rowTotalScore += validScore;
        });
      } else {
        const rawScore = Number(row.totalScore ?? 0);
        rowTotalScore = isNaN(rawScore) ? 0 : Math.min(calculatedTotalMarks, Math.max(0, rawScore));
      }

      const percentage = calculatedTotalMarks > 0 ? Math.round((rowTotalScore / calculatedTotalMarks) * 100) : 0;
      const band: 'EXCELLENT' | 'AVERAGE' | 'POOR' = percentage >= 80 ? 'EXCELLENT' : percentage >= 60 ? 'AVERAGE' : 'POOR';

      validRowsToCreate.push({
        studentId: student.id,
        totalScore: rowTotalScore,
        percentage,
        band,
        questionScores: mode === 'QUESTION_WISE' ? parsedScores : undefined
      });
    });

    if (validRowsToCreate.length === 0) {
      throw new BadRequestError('No valid matched students could be imported.', 'ERR_NO_VALID_STUDENTS');
    }

    // Auto-detect targets if none specified
    const targetDeptSet = new Set<string>(targetDepartmentIds);
    const targetSecSet = new Set<string>(targetSectionIds);

    registeredStudents.forEach(s => {
      if (seenStudentIds.has(s.id)) {
        if (s.departmentId) targetDeptSet.add(s.departmentId);
        if (s.sectionId) targetSecSet.add(s.sectionId);
      }
    });

    // Run creation inside transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Quiz record
      const quiz = await tx.quiz.create({
        data: {
          title: title.trim(),
          subject: subject ? subject.trim() : null,
          totalMarks: calculatedTotalMarks,
          passingMarks,
          durationMinutes: 0,
          allowLateJoin: true,
          autoSubmit: false,
          answersPublished: Boolean(answersPublished),
          paperStatus: 'PUBLISHED',
          sourceType: 'OFFLINE',
          hasQuestionBreakdown: mode === 'QUESTION_WISE',
          createdBy: facultyId,
          performanceBands: {
            overallTopics: Array.isArray(overallTopics) ? overallTopics : [],
            offlineImport: true,
            importedAt: new Date().toISOString()
          },
          targetDepartments: targetDeptSet.size > 0 ? {
            create: Array.from(targetDeptSet).map(dId => ({ departmentId: dId }))
          } : undefined,
          targetSections: targetSecSet.size > 0 ? {
            create: Array.from(targetSecSet).map(sId => ({ sectionId: sId }))
          } : undefined,
          targetStudents: {
            create: Array.from(seenStudentIds).map(userId => ({ userId }))
          }
        }
      });

      // 2. For Mode A, create question stubs
      const questionStubs: Array<{ id: string; questionNumber: number; marks: number }> = [];
      if (mode === 'QUESTION_WISE') {
        for (const q of sanitizedQuestions) {
          const createdQ = await tx.question.create({
            data: {
              quizId: quiz.id,
              ownerId: facultyId,
              category: 'TEST_QUIZ',
              subject: subject ? subject.trim() : null,
              type: 'NUMERICAL',
              text: q.questionText || `Question ${q.questionNumber} (${q.topic})`,
              topic: q.topic,
              marks: q.maxMarks,
              negativeMarks: 0
            }
          });
          questionStubs.push({ id: createdQ.id, questionNumber: q.questionNumber, marks: q.maxMarks });
        }
      }

      // 3. Create QuizAttempt and QuizResponse records for each student
      let createdAttemptsCount = 0;
      for (const rowData of validRowsToCreate) {
        const attempt = await tx.quizAttempt.create({
          data: {
            userId: rowData.studentId,
            quizId: quiz.id,
            status: 'EVALUATED',
            sourceType: 'OFFLINE',
            score: rowData.totalScore,
            totalScore: rowData.totalScore,
            objectiveScore: rowData.totalScore,
            writtenScore: 0,
            performanceCategory: rowData.band,
            resultUpdatedAt: new Date(),
            metrics: {
              sourceType: 'OFFLINE',
              offlineImport: true,
              mode,
              totalMarks: calculatedTotalMarks,
              percentage: rowData.percentage,
              perQuestionScores: rowData.questionScores || {}
            }
          }
        });

        if (mode === 'QUESTION_WISE' && questionStubs.length > 0) {
          for (const qStub of questionStubs) {
            const score = rowData.questionScores?.[String(qStub.questionNumber)] ?? 0;
            await tx.quizResponse.create({
              data: {
                attemptId: attempt.id,
                questionId: qStub.id,
                status: 'ANSWERED',
                marksAwarded: score,
                answerData: {
                  score,
                  maxMarks: qStub.marks,
                  source: 'OFFLINE_MARKSHEET'
                }
              }
            });
          }
        }
        createdAttemptsCount++;
      }

      return { quizId: quiz.id, title: quiz.title, totalImported: createdAttemptsCount };
    });

    res.status(201).json({
      status: 'success',
      message: `Successfully imported ${result.totalImported} student marks for offline quiz "${result.title}".`,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Parse uploaded file (XLSX or CSV) and return structured rows for preview
 */
export const parseUploadedMarksheet = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = req.file;
    if (!file) {
      throw new BadRequestError('No marksheet file uploaded.', 'ERR_NO_FILE');
    }

    const mode = (req.body.mode as 'QUESTION_WISE' | 'TOTAL_ONLY') || 'TOTAL_ONLY';
    let questions: QuestionDefinition[] | undefined;
    if (req.body.questions) {
      try {
        questions = typeof req.body.questions === 'string' ? JSON.parse(req.body.questions) : req.body.questions;
      } catch {
        questions = undefined;
      }
    }

    const workbook = xlsx.read(file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) throw new BadRequestError('The uploaded spreadsheet contains no sheets.', 'ERR_EMPTY_FILE');

    const worksheet = workbook.Sheets[sheetName];
    const rawRows = xlsx.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '', raw: false });

    if (!rawRows || rawRows.length === 0) {
      throw new BadRequestError('No data rows found in the uploaded file.', 'ERR_NO_DATA');
    }

    const extractedRows = rawRows.map(r => extractRowData(r, mode, questions)).filter(r => r.identifier.length > 0);

    res.status(200).json({
      status: 'success',
      data: {
        totalRowsFound: rawRows.length,
        parsedRowsCount: extractedRows.length,
        rows: extractedRows
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Generate and download sample CSV/Excel template
 */
export const downloadMarksheetTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userRole = (req as any).user?.role;
    const mode = (req.query.mode as string) || 'QUESTION_WISE';
    const departmentId = req.query.departmentId as string | undefined;
    const sectionId = req.query.sectionId as string | undefined;

    let columns: string[] = [];
    if (mode === 'QUESTION_WISE') {
      const qCount = Math.max(1, Math.min(50, Number(req.query.qCount) || 5));
      columns = ['Roll Number / Email', 'Student Name'];
      for (let i = 1; i <= qCount; i++) {
        columns.push(`Q${i}`);
      }
    } else {
      columns = ['Roll Number / Email', 'Student Name', 'Total Obtained Marks'];
    }

    // Optionally pre-populate with students in selected scope
    const studentWhere = buildFacultyStudentWhere(req.facultyScope, { departmentId, sectionId }, userRole === 'ADMIN');
    const students = await prisma.user.findMany({
      where: {
        role: 'STUDENT',
        AND: [studentWhere]
      },
      select: {
        rollNumber: true,
        name: true,
        email: true
      },
      take: 50,
      orderBy: [{ rollNumber: 'asc' }, { name: 'asc' }]
    });

    const rows: Array<Record<string, string>> = [];
    if (students.length > 0) {
      students.forEach(s => {
        const row: Record<string, string> = {
          [columns[0]]: s.rollNumber || s.email,
          [columns[1]]: s.name
        };
        for (let i = 2; i < columns.length; i++) {
          row[columns[i]] = '';
        }
        rows.push(row);
      });
    } else {
      // Provide 2 dummy sample rows
      const sample1: Record<string, string> = {
        [columns[0]]: '21CS001',
        [columns[1]]: 'Sample Student 1'
      };
      const sample2: Record<string, string> = {
        [columns[0]]: 'student@college.edu',
        [columns[1]]: 'Sample Student 2'
      };
      for (let i = 2; i < columns.length; i++) {
        sample1[columns[i]] = mode === 'QUESTION_WISE' ? '5' : '45';
        sample2[columns[i]] = mode === 'QUESTION_WISE' ? '8' : '48';
      }
      rows.push(sample1, sample2);
    }

    const worksheet = xlsx.utils.json_to_sheet(rows, { header: columns });
    const csvContent = xlsx.utils.sheet_to_csv(worksheet);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="marksheet_template_${mode.toLowerCase()}.csv"`);
    res.status(200).send(csvContent);
  } catch (error) {
    next(error);
  }
};
