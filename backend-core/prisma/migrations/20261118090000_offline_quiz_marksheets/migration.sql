-- CreateEnum
CREATE TYPE "QuizSourceType" AS ENUM ('ONLINE', 'OFFLINE');

-- AlterTable
ALTER TABLE "Quiz" ADD COLUMN "sourceType" "QuizSourceType" NOT NULL DEFAULT 'ONLINE';
ALTER TABLE "Quiz" ADD COLUMN "hasQuestionBreakdown" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "QuizAttempt" ADD COLUMN "sourceType" "QuizSourceType" NOT NULL DEFAULT 'ONLINE';

-- CreateIndex
CREATE INDEX "Quiz_sourceType_idx" ON "Quiz"("sourceType");
CREATE INDEX "QuizAttempt_sourceType_idx" ON "QuizAttempt"("sourceType");
