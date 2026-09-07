import { Request, Response, NextFunction } from 'express';
import { BadRequestError } from '../utils/errors';
import fs from 'fs';
import path from 'path';
import { uploadToCloudinary } from '../utils/cloudinary';
import mammoth from 'mammoth';
import * as cheerio from 'cheerio';

export const uploadDocxParser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      throw new BadRequestError('No file uploaded', 'INVALID_INPUT');
    }

    const filePath = path.resolve(req.file.path);
    
    try {
      const result = await mammoth.convertToHtml({ path: filePath });
      const html = result.value;
      const $ = cheerio.load(html);
      
      const metadata: any = {
        title: '',
        subject: '',
        totalMarks: 0,
        totalQuestions: 0,
        instructions: ''
      };
      
      const questions: any[] = [];
      let currentQ: any = null;
      let currentList: 'LEFT' | 'RIGHT' | 'MAPPING' | null = null;
      let currentQNumber = 0;

      const elements = $('h1, h2, h3, h4, h5, h6, p, img').toArray();

      const validateQuestionCompleteness = (q: any, num: number) => {
        if (!q.text && !q.image) {
          throw new BadRequestError(`Validation Failed: Question ${num} must have either Question Text or an Image.`, 'VALIDATION_ERROR');
        }
        if (!q.marks) {
          throw new BadRequestError(`Validation Failed: Question ${num} is missing Marks.`, 'VALIDATION_ERROR');
        }
        if (q.type === 'MCQ' && (!q.answerKey || q.options.filter(Boolean).length < 2)) {
          throw new BadRequestError(`Validation Failed: Question ${num} (Multiple Choice) is missing options or Correct Answer.`, 'VALIDATION_ERROR');
        }
        if (q.type === 'MATCHING' && q.options.length === 0) {
          throw new BadRequestError(`Validation Failed: Question ${num} (Match the Following) has invalid or missing mappings.`, 'VALIDATION_ERROR');
        }
        if (['SHORT_WRITTEN', 'LONG_WRITTEN', 'NUMERICAL'].includes(q.type) && q.answerKey === null) {
          throw new BadRequestError(`Validation Failed: Question ${num} is missing expected answer.`, 'VALIDATION_ERROR');
        }
      };

      for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        
        if (el.tagName === 'img') {
          const src = $(el).attr('src');
          if (src && currentQ) {
            try {
              const url = await uploadToCloudinary(src);
              if (url) currentQ.image = url;
            } catch (err) {
              console.error('Image upload failed', err);
            }
          }
          continue;
        }

        let text = $(el).text().trim();
        if (!text) continue;
        
        // Remove zero-width spaces or weird chars if any
        text = text.replace(/[\u200B-\u200D\uFEFF]/g, '');

        if (text.startsWith('Quiz Title:')) metadata.title = text.substring(11).trim();
        else if (text.startsWith('Subject:')) metadata.subject = text.substring(8).trim();
        else if (text.startsWith('Instructions:')) metadata.instructions = text.substring(13).trim();
        else if (text.startsWith('Total Marks:')) metadata.totalMarks = Number(text.substring(12).trim()) || 0;
        else if (text.startsWith('Total Number of Questions:')) metadata.totalQuestions = Number(text.substring(26).trim()) || 0;
        
        else if (text.startsWith('Question Number:')) {
          if (currentQ) {
            if (currentQ.type === 'MATCHING') {
              for (const m of currentQ._mapping) {
                const parts = m.split('->').map((s: string) => s.trim());
                if (parts.length === 2) {
                  const leftIdx = parseInt(parts[0]) - 1;
                  const rightIdx = parts[1].toUpperCase().charCodeAt(0) - 65;
                  if (leftIdx >= 0 && leftIdx < currentQ._left.length && rightIdx >= 0 && rightIdx < currentQ._right.length) {
                    currentQ.options.push({ left: currentQ._left[leftIdx], right: currentQ._right[rightIdx] });
                  }
                }
              }
            }
            validateQuestionCompleteness(currentQ, currentQNumber);
            questions.push(currentQ);
          }
          currentQNumber = Number(text.substring(16).trim()) || (currentQNumber + 1);
          currentQ = {
            type: 'MCQ', text: '', marks: 1, options: [], answerKey: null, explanation: null, hasImagePlaceholder: false,
            _left: [], _right: [], _mapping: []
          };
          currentList = null;
        }
        else if (currentQ) {
          if (text.startsWith('Question Type:')) {
            const qt = text.substring(14).trim().toLowerCase();
            if (qt.includes('multiple choice')) currentQ.type = 'MCQ';
            else if (qt.includes('numerical')) currentQ.type = 'NUMERICAL';
            else if (qt.includes('short answer')) currentQ.type = 'SHORT_WRITTEN';
            else if (qt.includes('long answer')) currentQ.type = 'LONG_WRITTEN';
            else if (qt.includes('match')) currentQ.type = 'MATCHING';
          }
          else if (text.startsWith('Question Text:')) currentQ.text = text.substring(14).trim();
          else if (text.startsWith('Image:')) {
            if (!text.toLowerCase().includes('n/a')) currentQ.hasImagePlaceholder = true;
          }
          else if (text.startsWith('Marks:')) currentQ.marks = Number(text.substring(6).trim()) || 1;
          else if (text.startsWith('Explanation:')) currentQ.explanation = text.substring(12).trim();
          
          else if (text.startsWith('Option A:')) currentQ.options[0] = text.substring(9).trim();
          else if (text.startsWith('Option B:')) currentQ.options[1] = text.substring(9).trim();
          else if (text.startsWith('Option C:')) currentQ.options[2] = text.substring(9).trim();
          else if (text.startsWith('Option D:')) currentQ.options[3] = text.substring(9).trim();
          
          else if (text.startsWith('Correct Answer:')) {
            const ansRaw = text.substring(15).trim();
            if (ansRaw.length === 1 && "ABCDEF".includes(ansRaw.toUpperCase())) {
               const idx = ansRaw.toUpperCase().charCodeAt(0) - 65;
               if (idx >= 0 && idx <= 3 && currentQ.options[idx]) {
                  currentQ.answerKey = currentQ.options[idx];
               } else {
                  currentQ.answerKey = ansRaw;
               }
            } else {
               currentQ.answerKey = ansRaw;
            }
          }
          else if (text.startsWith('Correct Numerical Answer:')) currentQ.answerKey = Number(text.substring(25).trim());
          else if (text.startsWith('Expected Answer / Evaluation Guidelines:')) currentQ.answerKey = text.substring(40).trim();
          else if (text.startsWith('Expected Answer:')) currentQ.answerKey = text.substring(16).trim();
          
          else if (text === 'Left Column') currentList = 'LEFT';
          else if (text === 'Right Column') currentList = 'RIGHT';
          else if (text === 'Correct Mapping') currentList = 'MAPPING';
          
          else if (currentList === 'LEFT' && text.match(/^\d+\./)) currentQ._left.push(text.replace(/^\d+\./, '').trim());
          else if (currentList === 'RIGHT' && text.match(/^[A-Z]\./)) currentQ._right.push(text.replace(/^[A-Z]\./, '').trim());
          else if (currentList === 'MAPPING' && text.includes('->')) currentQ._mapping.push(text);
          else {
            // Append to text if it's not a known field and we aren't parsing options/lists
            if (!currentList && currentQ.options.length === 0 && !text.includes('Question Information')) {
               // Only append if it's not one of the standard headers
               currentQ.text += (currentQ.text ? '\n' : '') + text;
            }
          }
        }
      }

      if (currentQ) {
        if (currentQ.type === 'MATCHING') {
          for (const m of currentQ._mapping) {
            const parts = m.split('->').map((s: string) => s.trim());
            if (parts.length === 2) {
              const leftIdx = parseInt(parts[0]) - 1;
              const rightIdx = parts[1].toUpperCase().charCodeAt(0) - 65;
              if (leftIdx >= 0 && leftIdx < currentQ._left.length && rightIdx >= 0 && rightIdx < currentQ._right.length) {
                currentQ.options.push({ left: currentQ._left[leftIdx], right: currentQ._right[rightIdx] });
              }
            }
          }
        }
        validateQuestionCompleteness(currentQ, currentQNumber);
        questions.push(currentQ);
      }

      if (metadata.totalQuestions && questions.length !== metadata.totalQuestions) {
         throw new BadRequestError(`Parsed questions count (${questions.length}) does not match metadata Total Number of Questions (${metadata.totalQuestions}).`, 'VALIDATION_ERROR');
      }

      // Clean up uploaded docx
      fs.unlinkSync(filePath);

      res.status(200).json({ status: 'success', data: { metadata, questions } });
    } catch (parseErr: any) {
      console.error('DOCX parsing error:', parseErr);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
      throw new BadRequestError(parseErr.message || 'Failed to parse docx document', 'PARSE_ERROR');
    }
  } catch (error) {
    next(error);
  }
};
