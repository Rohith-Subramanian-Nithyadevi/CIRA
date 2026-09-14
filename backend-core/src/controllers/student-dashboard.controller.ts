import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

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
          select: { id: true, title: true, answersPublished: true, totalMarks: true },
        },
      },
    });

    const performanceTrajectory = attempts.map(attempt => {
      const maxScore = attempt.quiz.totalMarks;
      const percentage = maxScore > 0 ? (attempt.totalScore / maxScore) * 100 : attempt.totalScore;
      
      return {
        name: attempt.quiz.title,
        score: Math.round(percentage),
        date: attempt.startTime.toISOString().split('T')[0],
      };
    });

    // 2. Knowledge Deficits — dynamically calculated from recent responses
    const recentResponses = await prisma.quizResponse.findMany({
      where: { 
        attempt: { userId: user.id },
        marksAwarded: { not: null }
      },
      include: { question: { select: { topic: true, marks: true } } },
      orderBy: { savedAt: 'desc' },
      take: 200 // Look at last 200 responses for recent deficits
    });

    const topicStats: Record<string, { earned: number; max: number }> = {};
    recentResponses.forEach(r => {
      const topic = r.question.topic || 'General';
      if (!topicStats[topic]) topicStats[topic] = { earned: 0, max: 0 };
      topicStats[topic].earned += r.marksAwarded || 0;
      topicStats[topic].max += r.question.marks || 1;
    });

    const knowledgeDeficits = Object.entries(topicStats)
      .map(([subject, stats]) => ({
        subject,
        score: Math.round((stats.earned / stats.max) * 100),
        fullMark: 100,
      }))
      .sort((a, b) => a.score - b.score) // Sort ascending by score (worst first)
      .slice(0, 5); // Take the 5 worst topics

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
  } catch (error: any) {
    console.error('Error fetching dashboard data:', error);
    res.status(500).json({ success: false, message: 'Server Error', details: error.message });
  }
};

// Submit a survey response for an announcement
export const submitAnnouncementResponse = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Not authenticated' });

    const { announcementId, response } = req.body;
    if (!announcementId || !response) {
      return res.status(400).json({ success: false, message: 'announcementId and response are required' });
    }

    // Verify announcement exists
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true, title: true, facultyId: true, isSurvey: true }
    });

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    if (!announcement.isSurvey) {
      return res.status(400).json({ success: false, message: 'This announcement does not accept responses' });
    }

    // Upsert response (student may update their answer)
    const savedResponse = await prisma.announcementResponse.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      update: { response, submittedAt: new Date() },
      create: { announcementId, userId, response }
    });

    // Fire a notification to the faculty who posted the announcement
    try {
      const student = await prisma.user.findUnique({
        where: { id: userId },
        select: { name: true, rollNumber: true }
      });
      if (student) {
        await prisma.notification.create({
          data: {
            facultyId: announcement.facultyId,
            type: 'SURVEY_RESPONSE',
            message: `${student.name} (${student.rollNumber || 'N/A'}) responded to your survey "${announcement.title}"`
          }
        });
      }
    } catch (_notifErr) {
      console.error('Notification creation failed:', _notifErr);
    }

    res.json({ success: true, data: savedResponse });
  } catch (error) {
    console.error('Error submitting survey response:', error);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};
