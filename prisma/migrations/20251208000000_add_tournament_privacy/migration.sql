-- AlterTable
ALTER TABLE "tournaments" ADD COLUMN "is_private" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "invited_user_ids" TEXT;








