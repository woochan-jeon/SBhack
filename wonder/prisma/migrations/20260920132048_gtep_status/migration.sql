-- DropForeignKey
ALTER TABLE "PersonalStatusExhibition" DROP CONSTRAINT "PersonalStatusExhibition_memberId_fkey";

-- DropTable
DROP TABLE "PersonalStatusExhibition";

-- DropTable
DROP TABLE "PersonalStatusMember";

-- DropEnum
DROP TYPE "ExhibitionLocation";

-- CreateEnum
CREATE TYPE "GtepFlagKey" AS ENUM ('GPA_37', 'MARKET_REPORT', 'TEAM_EXPO_DONE', 'ECOMMERCE_DONE', 'GPA_SEM2_OK', 'JINCHWI', 'JINCHWI_SEM1', 'CERT_GUKMUSA1', 'CERT_TRADE_ENG1', 'CERT_MULGWANSA', 'CERT_DISTRIBUTION2', 'CERT_IMPORT_MGR');

-- CreateEnum
CREATE TYPE "GtepActivityCategory" AS ENUM ('PERSONAL_EXPO', 'OTHER');

-- CreateTable
CREATE TABLE "GtepMember" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GtepMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GtepFlag" (
    "id" TEXT NOT NULL,
    "key" "GtepFlagKey" NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checkedAt" TIMESTAMP(3),
    "memberId" TEXT NOT NULL,

    CONSTRAINT "GtepFlag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GtepActivityHours" (
    "id" TEXT NOT NULL,
    "category" "GtepActivityCategory" NOT NULL,
    "hours" INTEGER NOT NULL DEFAULT 0,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "GtepActivityHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GtepLangScore" (
    "id" TEXT NOT NULL,
    "exam" TEXT NOT NULL,
    "grade" TEXT,
    "score" INTEGER,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "isBaseline" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memberId" TEXT NOT NULL,

    CONSTRAINT "GtepLangScore_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GtepMember_name_key" ON "GtepMember"("name");

-- CreateIndex
CREATE UNIQUE INDEX "GtepFlag_memberId_key_key" ON "GtepFlag"("memberId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "GtepActivityHours_memberId_category_key" ON "GtepActivityHours"("memberId", "category");

-- CreateIndex
CREATE INDEX "GtepLangScore_memberId_idx" ON "GtepLangScore"("memberId");

-- AddForeignKey
ALTER TABLE "GtepFlag" ADD CONSTRAINT "GtepFlag_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GtepMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GtepActivityHours" ADD CONSTRAINT "GtepActivityHours_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GtepMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GtepLangScore" ADD CONSTRAINT "GtepLangScore_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "GtepMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
