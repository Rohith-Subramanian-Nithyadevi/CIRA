import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const getDashboardData = async (req: Request, res: Response) => {
  try {
    // In a real app, req.user would be populated by the auth middleware.
    // For this demonstration, we'll extract the rollNumber from the user or assume the mock user.
    // Since we're just visualizing it, let's try to get it from query params or fallback to the seed user
    const user = await prisma.user.findFirst({
      where: {
        rollNumber: 'ch.sc.u4cse24141',
      },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // 1. Performance Trajectory
    const attempts = await prisma.quizAttempt.findMany({
      where: { userId: user.id },
      orderBy: { startTime: 'asc' },
      include: {
        quiz: {
          select: { title: true },
        },
      },
    });

    const performanceTrajectory = attempts.map(attempt => ({
      name: attempt.quiz.title,
      score: attempt.score,
      date: attempt.startTime.toISOString().split('T')[0],
    }));

    // 2. Knowledge Deficits
    // Find the latest attempt that has metrics
    const attemptWithMetrics = [...attempts].reverse().find(a => a.metrics && Object.keys(a.metrics).length > 0);
    const metricsData = attemptWithMetrics?.metrics as Record<string, number> || {};
    
    const knowledgeDeficits = Object.entries(metricsData).map(([subject, score]) => ({
      subject,
      score,
      fullMark: 100, // Assuming 100 is the max
    }));

    // 3. NLP-Generated Remediation Assignments
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

    res.status(200).json({
      success: true,
      data: {
        performanceTrajectory,
        knowledgeDeficits,
        assignments,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
