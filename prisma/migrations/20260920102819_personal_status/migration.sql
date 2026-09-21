-- CreateEnum
CREATE TYPE "ExhibitionLocation" AS ENUM ('DOMESTIC', 'OVERSEAS');

-- CreateTable
CREATE TABLE "PersonalStatusMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "languageCertified" BOOLEAN NOT NULL DEFAULT false,
    "tradeIntlLevel1" BOOLEAN NOT NULL DEFAULT false,
    "tradeEnglishLevel1" BOOLEAN NOT NULL DEFAULT false,
    "distributionLevel2" BOOLEAN NOT NULL DEFAULT false,
    "logisticsLevel2" BOOLEAN NOT NULL DEFAULT false,
    "importManager" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "PersonalStatusMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalStatusExhibition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" "ExhibitionLocation" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "hours" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "PersonalStatusExhibition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PersonalStatusMember_name_key" ON "PersonalStatusMember"("name");

-- CreateIndex
CREATE INDEX "PersonalStatusExhibition_memberId_idx" ON "PersonalStatusExhibition"("memberId");

-- AddForeignKey
ALTER TABLE "PersonalStatusExhibition" ADD CONSTRAINT "PersonalStatusExhibition_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "PersonalStatusMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
