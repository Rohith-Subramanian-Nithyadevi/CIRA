CREATE TYPE "PaperStatus" AS ENUM ('DRAFT', 'READY', 'PUBLISHED', 'CLOSED');

ALTER TABLE "Quiz"
  ADD COLUMN "paperCategory" "QuestionCategory",
  ADD COLUMN "paperStatus" "PaperStatus" NOT NULL DEFAULT 'PUBLISHED';

ALTER TABLE "QuestionUsage"
  ADD COLUMN "marks" DOUBLE PRECISION,
  ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "wasReused" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "isFinalized" BOOLEAN NOT NULL DEFAULT true;

WITH ordered_usage AS (
  SELECT usage."id", question."marks",
         ROW_NUMBER() OVER (PARTITION BY usage."quizId" ORDER BY question."createdAt", question."id") - 1 AS position
  FROM "QuestionUsage" usage
  JOIN "Question" question ON question."id" = usage."questionId"
)
UPDATE "QuestionUsage" usage
SET "marks" = ordered_usage."marks", "sortOrder" = ordered_usage.position
FROM ordered_usage
WHERE usage."id" = ordered_usage."id";

ALTER TABLE "QuestionUsage" ALTER COLUMN "marks" SET NOT NULL;
CREATE INDEX "Quiz_paperCategory_paperStatus_idx" ON "Quiz"("paperCategory", "paperStatus");
CREATE INDEX "QuestionUsage_quizId_sortOrder_idx" ON "QuestionUsage"("quizId", "sortOrder");
CREATE INDEX "QuestionUsage_category_isFinalized_idx" ON "QuestionUsage"("category", "isFinalized");
