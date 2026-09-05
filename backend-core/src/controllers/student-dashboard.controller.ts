import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDashboardData = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 1. Performance Trajectory — from actual quiz attempts
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: user.id },
      orderBy: { startTime: 'asc' },
      include: {
        quiz: {
          select: { id: true, title: true, answersPublished: true },
        },
      },
    });

    const performanceTrajectory = attempts.map(attempt => ({
      name: attempt.quiz.title,
      score: attempt.totalScore,
      date: attempt.startTime.toISOString().split('T')[0],
    }));

    // 2. Knowledge Deficits — from the latest attempt that has metrics
    const attemptWithMetrics = [...attempts].reverse().find(a => a.metrics && Object.keys(a.metrics as any).length > 0);
    const metricsData = (attemptWithMetrics?.metrics as Record<string, number>) || {};
    
    const knowledgeDeficits = Object.entries(metricsData).map(([subject, score]) => ({
      subject,
      score,
      fullMark: 100,
    }));

    // 3. Remediation Assignments
    const submissions = await prisma.assignmentSubmission.findMany({
      where: { userId: user.id },
      orderBy: { submittedAt: 'desc' },
      include: {
        assignment: true,
      },
    });

    const assignments = submissions.map(sub => ({
      id: sub.id,
      title: sub.assignment.title,
      date: sub.submittedAt.toISOString().split('T')[0],
      status: sub.rating === 'POOR' ? 'Generated' : 'Completed',
    }));

    // 4. Past quiz results — submitted/evaluated attempts with scores
    const pastQuizzes = attempts
      .filter(a => a.status === 'SUBMITTED' || a.status === 'EVALUATED')
      .map(a => ({
        id: a.id,
        quizId: a.quiz.id,
        title: a.quiz.title,
        submittedAt: a.endTime?.toISOString().split('T')[0] || a.startTime.toISOString().split('T')[0],
        totalScore: a.totalScore,
        objectiveScore: a.objectiveScore,
        writtenScore: a.writtenScore,
        grade: a.finalGrade || null,
        facultyFeedback: a.facultyFeedback || null,
        performanceCategory: a.performanceCategory || null,
        answersPublished: a.quiz.answersPublished,
      }));

    res.status(200).json({
      success: true,
      data: {
        performanceTrajectory,
        knowledgeDeficits,
        assignments,
        pastQuizzes,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

