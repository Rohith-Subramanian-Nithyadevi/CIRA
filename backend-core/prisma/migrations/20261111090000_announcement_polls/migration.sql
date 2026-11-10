ALTER TABLE "Announcement"
  ADD COLUMN "isPoll" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "pollOptions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "pollStartsAt" TIMESTAMP(3),
  ADD COLUMN "pollExpiresAt" TIMESTAMP(3),
  ADD COLUMN "pollAudienceType" TEXT,
  ADD COLUMN "pollTargetId" TEXT;

CREATE INDEX "Announcement_facultyId_isPoll_date_idx" ON "Announcement"("facultyId", "isPoll", "date");
CREATE INDEX "Announcement_pollTarget_idx" ON "Announcement"("pollAudienceType", "pollTargetId");
