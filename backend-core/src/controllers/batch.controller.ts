import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getActiveBatches = async (req: Request, res: Response) => {
  try {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth(); // 0-indexed, 5 is June
    
    // Determine the baseline "start year" based on whether June has passed
    // If it's before June, the "newest" batch started last year.
    // If it's June or later, the "newest" batch starts this year.
    const startYear = currentMonth >= 5 ? currentYear : currentYear - 1;

    // A typical 4-year degree means 4 active batches at any time.
    const activeStartYears = [
      startYear,
      startYear - 1,
      startYear - 2,
      startYear - 3
    ];

    // Ensure these batches exist in the database
    for (const year of activeStartYears) {
      const batchName = `${year}-${year + 4}`;
      await prisma.batch.upsert({
        where: { name: batchName },
        update: {},
        create: {
          name: batchName,
          startYear: year
        }
      });
    }

    const batches = await prisma.batch.findMany({
      orderBy: { startYear: 'desc' }
    });

    res.status(200).json({
      status: 'success',
      data: {
        batches
      }
    });
  } catch (error) {
    console.error('Error fetching batches:', error);
    res.status(500).json({ status: 'error', message: 'Failed to fetch batches' });
  }
};
