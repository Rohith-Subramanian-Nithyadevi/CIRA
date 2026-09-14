import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

export const getSheetDetails = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { id } = req.params as { id: string };

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const resource = await prisma.resource.findUnique({
      where: { id, type: 'SHEET' },
      include: {
        sheetTopics: {
          orderBy: { order: 'asc' },
          include: {
            questions: {
              orderBy: { order: 'asc' },
              include: {
                studentProgress: {
                  where: { userId },
                  select: { status: true, markedForRevision: true }
                }
              }
            }
          }
        }
      }
    });

    if (!resource) return res.status(404).json({ error: 'Sheet not found' });

    res.json({ success: true, data: resource });
  } catch (error) {
    console.error('Error fetching sheet details:', error);
    res.status(500).json({ error: 'Failed to fetch sheet details' });
  }
};

export const updateQuestionProgress = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { questionId } = req.params as { questionId: string };
    const { status, markedForRevision } = req.body;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const data: any = {};
    if (status !== undefined) data.status = status;
    if (markedForRevision !== undefined) data.markedForRevision = markedForRevision;

    const progress = await prisma.studentSheetProgress.upsert({
      where: {
        userId_questionId: {
          userId,
          questionId
        }
      },
      update: data,
      create: {
        userId,
        questionId,
        status: status || 'UNSOLVED',
        markedForRevision: markedForRevision || false
      }
    });

    res.json({ success: true, data: progress });
  } catch (error) {
    console.error('Error updating question progress:', error);
    res.status(500).json({ error: 'Failed to update question progress' });
  }
};

export const getRevisionPool = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    const { limit = 10 } = req.query;

    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const markedQuestions = await prisma.studentSheetProgress.findMany({
      where: {
        userId,
        markedForRevision: true
      },
      include: {
        question: {
          include: {
            topic: {
              include: {
                resource: true
              }
            }
          }
        }
      }
    });

    const shuffled = markedQuestions.sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, Number(limit));

    res.json({ success: true, data: selected });
  } catch (error) {
    console.error('Error fetching revision pool:', error);
    res.status(500).json({ error: 'Failed to fetch revision pool' });
  }
};

export const getSheetAnalytics = async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const sheets = await prisma.resource.findMany({
      where: { type: 'SHEET' },
      include: {
        sheetTopics: {
          include: {
            questions: {
              include: {
                studentProgress: {
                  where: { userId }
                }
              }
            }
          }
        }
      }
    });

    const analytics = sheets.map(sheet => {
      let totalQuestions = 0;
      let solvedQuestions = 0;
      const topicStats: Record<string, { total: number; solved: number }> = {};

      sheet.sheetTopics.forEach(topic => {
        topicStats[topic.name] = { total: 0, solved: 0 };
        topic.questions.forEach(q => {
          totalQuestions++;
          topicStats[topic.name].total++;
          
          if (q.studentProgress.length > 0 && q.studentProgress[0].status === 'SOLVED') {
            solvedQuestions++;
            topicStats[topic.name].solved++;
          }
        });
      });

      const weakTopics = Object.entries(topicStats)
        .filter(([_, stats]) => stats.total > 0)
        .map(([name, stats]) => ({ name, score: Math.round((stats.solved / stats.total) * 100) }))
        .sort((a, b) => a.score - b.score)
        .slice(0, 3);

      const strongTopics = Object.entries(topicStats)
        .filter(([_, stats]) => stats.total > 0)
        .map(([name, stats]) => ({ name, score: Math.round((stats.solved / stats.total) * 100) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);

      return {
        id: sheet.id,
        title: sheet.title,
        totalQuestions,
        solvedQuestions,
        progress: totalQuestions > 0 ? Math.round((solvedQuestions / totalQuestions) * 100) : 0,
        weakTopics,
        strongTopics,
        topicStats: Object.entries(topicStats).map(([name, stats]) => ({
          subject: name,
          A: stats.total > 0 ? Math.round((stats.solved / stats.total) * 100) : 0,
          fullMark: 100
        }))
      };
    });

    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Error fetching sheet analytics:', error);
    res.status(500).json({ error: 'Failed to fetch sheet analytics' });
  }
};
