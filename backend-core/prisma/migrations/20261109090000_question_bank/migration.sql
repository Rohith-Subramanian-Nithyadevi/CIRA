CREATE TYPE "QuestionCategory" AS ENUM ('ASSIGNMENT', 'TEST_QUIZ');

ALTER TABLE "Question"
  ALTER COLUMN "quizId" DROP NOT NULL,
  ADD COLUMN "ownerId" TEXT,
  ADD COLUMN "category" "QuestionCategory" NOT NULL DEFAULT 'TEST_QUIZ',
  ADD COLUMN "subject" TEXT,
  ADD COLUMN "subtopic" TEXT,
  ADD COLUMN "difficulty" TEXT,
  ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "Question" q
SET "ownerId" = CASE WHEN EXISTS (SELECT 1 FROM "User" u WHERE u."id" = quiz."createdBy") THEN quiz."createdBy" ELSE NULL END,
    "subject" = quiz."subject"
FROM "Quiz" quiz
WHERE q."quizId" = quiz."id";

ALTER TABLE "Question" DROP CONSTRAINT "Question_quizId_fkey";
ALTER TABLE "Question"
  ADD CONSTRAINT "Question_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Question_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "QuestionUsage" (
  "id" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "category" "QuestionCategory" NOT NULL,
  "quizId" TEXT,
  "assignmentId" TEXT,
  "assessmentTitle" TEXT NOT NULL,
  "usedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionUsage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "QuestionUsage_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "QuestionUsage_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "QuestionUsage_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Question_ownerId_idx" ON "Question"("ownerId");
CREATE INDEX "Question_category_idx" ON "Question"("category");
CREATE INDEX "QuestionUsage_questionId_category_idx" ON "QuestionUsage"("questionId", "category");
CREATE INDEX "QuestionUsage_quizId_idx" ON "QuestionUsage"("quizId");
CREATE INDEX "QuestionUsage_assignmentId_idx" ON "QuestionUsage"("assignmentId");

INSERT INTO "QuestionUsage" ("id", "questionId", "category", "quizId", "assessmentTitle", "usedAt")
SELECT gen_random_uuid()::text, q."id", 'TEST_QUIZ'::"QuestionCategory", quiz."id", quiz."title", COALESCE(quiz."createdAt", CURRENT_TIMESTAMP)
FROM "Question" q JOIN "Quiz" quiz ON quiz."id" = q."quizId";
