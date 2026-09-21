-- ScheduleEntry has no rows yet, so this converts the fixed ScheduleCategory
-- enum into a managed table without needing to backfill any data.

-- DropColumn (drops the enum-typed column and its composite index automatically)
ALTER TABLE "ScheduleEntry" DROP COLUMN "category";

-- DropEnum (frees up the "ScheduleCategory" name for the new table)
DROP TYPE "ScheduleCategory";

-- CreateTable
CREATE TABLE "ScheduleCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ScheduleCategory_name_key" ON "ScheduleCategory"("name");

-- Seed the three categories that previously existed as fixed enum values.
INSERT INTO "ScheduleCategory" ("id", "name") VALUES
  ('cschedcat00000000000jm', 'JM'),
  ('cschedcat0000000000q10', 'Q10'),
  ('cschedcat000000changdong', '창동');

-- AlterTable (safe as NOT NULL since the table has no existing rows)
ALTER TABLE "ScheduleEntry" ADD COLUMN "categoryId" TEXT NOT NULL;

-- CreateIndex
CREATE INDEX "ScheduleEntry_categoryId_date_idx" ON "ScheduleEntry"("categoryId", "date");

-- AddForeignKey
ALTER TABLE "ScheduleEntry" ADD CONSTRAINT "ScheduleEntry_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ScheduleCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
