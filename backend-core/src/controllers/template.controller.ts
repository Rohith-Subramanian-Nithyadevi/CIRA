import { Request, Response, NextFunction } from 'express';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { BadRequestError } from '../utils/errors';

export const downloadTemplate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const totalCount = parseInt(req.query.count as string) || 10;
    
    if (totalCount < 1 || totalCount > 100) {
      throw new BadRequestError('Count must be between 1 and 100');
    }

    let mcq = parseInt(req.query.mcq as string) || 0;
    let numerical = parseInt(req.query.numerical as string) || 0;
    let short = parseInt(req.query.short as string) || 0;
    let long = parseInt(req.query.long as string) || 0;
    let matching = parseInt(req.query.matching as string) || 0;

    const hasMixed = req.query.mcq !== undefined;
    if (!hasMixed) {
      mcq = totalCount;
    } else {
      if (mcq + numerical + short + long + matching !== totalCount) {
         throw new BadRequestError('Question type counts must sum to total count');
      }
    }

    const sections: Paragraph[] = [
      new Paragraph({ text: "CIRA Quiz Faculty Template", heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
      new Paragraph({ text: "" }),
      new Paragraph({ text: "Instructions for Faculty:", heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: "Follow the template exactly. Do not rename or remove any fields." }),
      new Paragraph({ text: "If no image is used, enter N/A in the Image field." }),
      new Paragraph({ text: "If the question itself is represented entirely by an image, the Question Text field may be left empty." }),
      new Paragraph({ text: "At least one of the following must be provided: Question Text or Image." }),
      new Paragraph({ text: "If both Question Text and Question Image are empty, the upload will be rejected." }),
      new Paragraph({ text: "Enter marks for every question." }),
      new Paragraph({ text: "Ensure the total marks equal the sum of the marks assigned to all questions." }),
      new Paragraph({ text: "Do not modify the question numbering or question types generated in the template." }),
      new Paragraph({ text: "Fill only the values requested under each heading." }),
      new Paragraph({ text: "" }),
      new Paragraph({ text: "Quiz Information Section", heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: "Quiz Title: Enter Quiz Title Here" }),
      new Paragraph({ text: "Subject: Enter Subject Here" }),
      new Paragraph({ text: "Instructions: Enter instructions for students here." }),
      new Paragraph({ text: "Total Marks: 100" }),
      new Paragraph({ text: `Total Number of Questions: ${totalCount}` }),
      new Paragraph({ text: "Faculty Name: Optional" }),
      new Paragraph({ text: "" }),
      new Paragraph({ text: "Question Sections", heading: HeadingLevel.HEADING_2 }),
      new Paragraph({ text: "" }),
    ];

    let currentQ = 1;

    // Helper to add lines
    const addLines = (lines: string[]) => lines.map(t => new Paragraph({ text: t }));

    // MCQ
    for (let i = 0; i < mcq; i++) {
      sections.push(...addLines([
        `Question Number: ${currentQ}`,
        "Question Type: Multiple Choice",
        "Question Text: ",
        "Image: N/A",
        "Option A: ",
        "Option B: ",
        "Option C: ",
        "Option D: ",
        "Correct Answer: ",
        "Marks: 1",
        "Explanation: ",
        ""
      ]));
      currentQ++;
    }

    // Numerical
    for (let i = 0; i < numerical; i++) {
      sections.push(...addLines([
        `Question Number: ${currentQ}`,
        "Question Type: Numerical",
        "Question Text: ",
        "Image: N/A",
        "Correct Numerical Answer: ",
        "Acceptable Error/Tolerance: ",
        "Marks: 1",
        "Explanation: ",
        ""
      ]));
      currentQ++;
    }

    // Short Answer
    for (let i = 0; i < short; i++) {
      sections.push(...addLines([
        `Question Number: ${currentQ}`,
        "Question Type: Short Answer",
        "Question Text: ",
        "Image: N/A",
        "Expected Answer: ",
        "Marks: 1",
        "Explanation: ",
        ""
      ]));
      currentQ++;
    }

    // Long Answer
    for (let i = 0; i < long; i++) {
      sections.push(...addLines([
        `Question Number: ${currentQ}`,
        "Question Type: Long Answer",
        "Question Text: ",
        "Image: N/A",
        "Expected Answer / Evaluation Guidelines: ",
        "Marks: 1",
        "Explanation: ",
        ""
      ]));
      currentQ++;
    }

    // Match the Following
    for (let i = 0; i < matching; i++) {
      sections.push(...addLines([
        `Question Number: ${currentQ}`,
        "Question Type: Match the Following",
        "Question Text: ",
        "Image: N/A",
        "Left Column",
        "1. ",
        "2. ",
        "3. ",
        "4. ",
        "Right Column",
        "A. ",
        "B. ",
        "C. ",
        "D. ",
        "Correct Mapping",
        "1 -> A",
        "2 -> B",
        "3 -> C",
        "4 -> D",
        "Marks: 1",
        "Explanation: ",
        ""
      ]));
      currentQ++;
    }

    const doc = new Document({
      sections: [{ properties: {}, children: sections }]
    });

    const buffer = await Packer.toBuffer(doc);

    res.setHeader('Content-Disposition', 'attachment; filename=Quiz_Template.docx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};
