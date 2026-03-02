-- AlterTable
ALTER TABLE "debates" ADD COLUMN IF NOT EXISTS "slug" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "debates_slug_key" ON "debates"("slug") WHERE "slug" IS NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "debates_slug_idx" ON "debates"("slug");
