import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { parseExcelBuffer } from '../utils/excelParser';
import QuestionBank from '../models/QuestionBank';
import { BadRequestError } from '../utils/errors';

// Strict validation schema for a single question row
const questionRowSchema = z.object({
  question_type: z.string().min(1, 'Question Type is required'),
  content: z.string().min(1, 'Content is required'),
  options: z.string().min(1, 'Options are required (use pipe | to separate)'),
  correct_option: z.string().min(1, 'Correct Answer is required'),
  difficulty: z.enum(['Easy', 'Medium', 'Hard'], {
    message: 'Difficulty must be Easy, Medium, or Hard',
  }),
  topic: z.string().min(1, 'Topic is required'),
  sub_topics: z.string().min(1, 'Sub-Divisions are required'),
});

export const importQuestions = async (req: Request, res: Response, next: NextFunction) => {
  let session;
  
  try {
    if (!req.file) {
      throw new BadRequestError('No file uploaded. Please upload a valid .xlsx file.', 'ERR_FILE_MISSING');
    }

    const rows = parseExcelBuffer(req.file.buffer);

    if (rows.length === 0) {
      throw new BadRequestError('The uploaded file is empty.', 'ERR_FILE_EMPTY');
    }

    const validationErrors: Array<{ line: number; errors: any }> = [];
    const validQuestionsToInsert: any[] = [];

    // Strictly validate each row
    rows.forEach((row) => {
      const validationResult = questionRowSchema.safeParse(row);
      
      if (!validationResult.success) {
        validationErrors.push({
          line: row.__rowNum__,
          errors: validationResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`),
        });
      } else {
        // Parse comma-separated or pipe-separated values
        const optionsArray = row.options.split('|').map(o => o.trim()).filter(o => o.length > 0);
        const subTopicsArray = row.sub_topics.split(',').map(s => s.trim()).filter(s => s.length > 0);

        // Additional business validation
        if (optionsArray.length < 2) {
          validationErrors.push({
            line: row.__rowNum__,
            errors: ['Options must contain at least 2 items separated by |'],
          });
          return;
        }

        if (!optionsArray.includes(row.correct_option)) {
          validationErrors.push({
            line: row.__rowNum__,
            errors: ['Correct Answer must strictly match one of the provided Options'],
          });
          return;
        }

        validQuestionsToInsert.push({
          question_type: row.question_type,
          content: row.content,
          options: optionsArray,
          correct_option: row.correct_option,
          difficulty: row.difficulty,
          topic: row.topic,
          sub_topics: subTopicsArray,
        });
      }
    });

    // If any validation errors occurred, abort the process and return the exact line failures
    if (validationErrors.length > 0) {
      return res.status(400).json({
        status: 'error',
        errorCode: 'ERR_BATCH_VALIDATION',
        message: 'Spreadsheet validation failed. No data was imported.',
        details: validationErrors,
      });
    }

    // Begin MongoDB Transaction
    session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Execute transactional batch insert
      await QuestionBank.insertMany(validQuestionsToInsert, { session });
      
      await session.commitTransaction();
      session.endSession();
    } catch (dbError) {
      // Abort transaction on any DB failure
      await session.abortTransaction();
      session.endSession();
      throw dbError; // Rethrow to be caught by outer catch block
    }

    res.status(200).json({
      status: 'success',
      message: `Successfully imported ${validQuestionsToInsert.length} questions.`,
    });

  } catch (error) {
    if (session && session.inTransaction()) {
      await session.abortTransaction();
      session.endSession();
    }
    
    // Check if error is related to Mongoose replica set requirements
    if (error instanceof Error && error.message.includes('transaction')) {
      console.warn('Transaction failed: Ensure MongoDB is running as a replica set.');
    }
    
    next(error);
  }
};
