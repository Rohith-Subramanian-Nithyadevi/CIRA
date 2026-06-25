import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDepartmentAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const departmentId = req.query.departmentId as string;

    const whereClause: any = { role: 'STUDENT' };
    if (departmentId) {
      whereClause.departmentId = departmentId;
    }
    
    const students = await prisma.user.findMany({
      where: whereClause,
      include: { results: true }
    });

    let totalScore = 0;
    let resultCount = 0;
    const tiers = { Excellent: 0, Average: 0, Poor: 0 };

    students.forEach(student => {
        let studentAvg = 0;
        if(student.results.length > 0) {
            const sum = student.results.reduce((acc: number, curr: any) => acc + curr.score, 0);
            studentAvg = sum / student.results.length;
            totalScore += studentAvg;
            resultCount++;

            if(studentAvg > 85) tiers.Excellent++;
            else if(studentAvg >= 60) tiers.Average++;
            else tiers.Poor++;
        }
    });

    const averageIRI = resultCount > 0 ? (totalScore / resultCount) : 0;

    res.status(200).json({
      status: 'success',
      data: {
        departmentId: departmentId || 'All',
        averageIRI,
        readinessDistribution: tiers,
        totalStudentsEvaluated: resultCount
      }
    });
  } catch (error) {
    next(error);
  }
};
