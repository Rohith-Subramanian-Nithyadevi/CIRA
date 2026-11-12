import { PrismaClient } from '@prisma/client';
import { OBJECTIVE_TYPES } from '../src/controllers/student-exam.controller';

const prisma = new PrismaClient();

export interface AttemptCorrection {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  studentId: string;
  studentName: string;
  oldObjectiveScore: number;
  oldWrittenScore: number;
  oldTotalScore: number;
  correctedWrittenScore: number;
  correctedTotalScore: number;
}

export function computeCorrectedAttemptScores(attempt: {
  id: string;
  quizId: string;
  userId: string;
  objectiveScore: number;
  writtenScore: number;
  totalScore: number;
  quiz?: { title?: string | null };
  user?: { name?: string | null };
  responses?: Array<{
    marksAwarded: number | null;
    question?: { type?: string | null } | null;
  }>;
}): AttemptCorrection | null {
  const responses = attempt.responses || [];
  let expectedWrittenScore = 0;

  for (const response of responses) {
    const qType = response.question?.type || '';
    if (!OBJECTIVE_TYPES.includes(qType)) {
      expectedWrittenScore += Number(response.marksAwarded ?? 0);
    }
  }

  const objectiveScore = Number(attempt.objectiveScore ?? 0);
  const oldWrittenScore = Number(attempt.writtenScore ?? 0);
  const oldTotalScore = Number(attempt.totalScore ?? 0);
  const expectedTotalScore = objectiveScore + expectedWrittenScore;

  const writtenDiffers = Math.abs(oldWrittenScore - expectedWrittenScore) > 1e-6;
  const totalDiffers = Math.abs(oldTotalScore - expectedTotalScore) > 1e-6;

  if (!writtenDiffers && !totalDiffers) {
    return null;
  }

  return {
    attemptId: attempt.id,
    quizId: attempt.quizId,
    quizTitle: attempt.quiz?.title || '',
    studentId: attempt.userId,
    studentName: attempt.user?.name || '',
    oldObjectiveScore: objectiveScore,
    oldWrittenScore,
    oldTotalScore,
    correctedWrittenScore: expectedWrittenScore,
    correctedTotalScore: expectedTotalScore,
  };
}

async function main() {
  const applyChanges = process.argv.includes('--apply');
  console.log(
    applyChanges
      ? '[APPLY MODE] Scanning EVALUATED quiz attempts for duplicate evaluation marks...'
      : '[DRY RUN] Scanning EVALUATED quiz attempts for duplicate evaluation marks (pass --apply to update DB)...'
  );

  const attempts = await prisma.quizAttempt.findMany({
    where: {
      status: 'EVALUATED',
    },
    include: {
      quiz: { select: { title: true } },
      user: { select: { name: true } },
      responses: {
        include: {
          question: { select: { type: true } },
        },
      },
    },
  });

  const corrections: AttemptCorrection[] = [];
  for (const attempt of attempts) {
    const correction = computeCorrectedAttemptScores(attempt);
    if (correction) {
      corrections.push(correction);
    }
  }

  console.log(`Scanned ${attempts.length} evaluated attempt(s). Found ${corrections.length} affected attempt(s).`);

  for (const c of corrections) {
    console.log(
      `- Attempt ${c.attemptId} | Quiz: "${c.quizTitle}" | Student: "${c.studentName}" | ` +
        `auto=${c.oldObjectiveScore}, written: ${c.oldWrittenScore} -> ${c.correctedWrittenScore}, ` +
        `total: ${c.oldTotalScore} -> ${c.correctedTotalScore}`
    );
  }

  if (applyChanges && corrections.length > 0) {
    await prisma.$transaction(
      corrections.map((c) =>
        prisma.quizAttempt.update({
          where: { id: c.attemptId },
          data: {
            writtenScore: c.correctedWrittenScore,
            totalScore: c.correctedTotalScore,
          },
        })
      )
    );
    console.log(`Successfully updated ${corrections.length} attempt(s) inside a transaction.`);
  }
}

if (require.main === module) {
  main()
    .catch((err) => {
      console.error('Failed to scan/fix duplicate evaluation marks:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}

