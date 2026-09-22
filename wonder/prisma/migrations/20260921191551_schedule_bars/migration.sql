-- AlterTable: add endDate, backfill existing (all single-day) rows to endDate = date, then require it
ALTER TABLE "ScheduleEntry" ADD COLUMN "endDate" TIMESTAMP(3);
UPDATE "ScheduleEntry" SET "endDate" = "date";
ALTER TABLE "ScheduleEntry" ALTER COLUMN "endDate" SET NOT NULL;

-- Drop the done/planned distinction — entries are now colored by category instead
ALTER TABLE "ScheduleEntry" DROP COLUMN "status";

-- AlterTable: give categories a color so entries render color-coded by category
ALTER TABLE "ScheduleCategory" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#0066cc';

-- Give the three seeded categories distinct colors instead of all sharing the default
UPDATE "ScheduleCategory" SET "color" = '#0066cc' WHERE "name" = 'JM';
UPDATE "ScheduleCategory" SET "color" = '#059669' WHERE "name" = 'Q10';
UPDATE "ScheduleCategory" SET "color" = '#d97706' WHERE "name" = '창동';
