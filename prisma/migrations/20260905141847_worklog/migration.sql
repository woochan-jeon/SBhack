-- CreateEnum
CREATE TYPE "WorkLogStatus" AS ENUM ('DONE', 'PLANNED');

-- CreateTable
CREATE TABLE "WorkLogMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkLogMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkLogEntry" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "content" TEXT NOT NULL,
    "status" "WorkLogStatus" NOT NULL DEFAULT 'PLANNED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "WorkLogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkLogMember_name_key" ON "WorkLogMember"("name");

-- CreateIndex
CREATE INDEX "WorkLogEntry_date_idx" ON "WorkLogEntry"("date");

-- CreateIndex
CREATE INDEX "WorkLogEntry_memberId_date_idx" ON "WorkLogEntry"("memberId", "date");

-- AddForeignKey
ALTER TABLE "WorkLogEntry" ADD CONSTRAINT "WorkLogEntry_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "WorkLogMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
