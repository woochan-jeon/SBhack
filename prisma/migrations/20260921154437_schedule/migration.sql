-- CreateEnum
CREATE TYPE "ScheduleCategory" AS ENUM ('JM', 'Q10', 'CHANGDONG');

-- CreateTable
CREATE TABLE "ScheduleEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "WorkLogStatus" NOT NULL DEFAULT 'PLANNED',
    "category" "ScheduleCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ScheduleEntry_date_idx" ON "ScheduleEntry"("date");

-- CreateIndex
CREATE INDEX "ScheduleEntry_category_date_idx" ON "ScheduleEntry"("category", "date");
