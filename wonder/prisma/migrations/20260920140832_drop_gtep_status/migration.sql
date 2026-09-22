-- DropForeignKey
ALTER TABLE "GtepFlag" DROP CONSTRAINT "GtepFlag_memberId_fkey";

-- DropForeignKey
ALTER TABLE "GtepActivityHours" DROP CONSTRAINT "GtepActivityHours_memberId_fkey";

-- DropForeignKey
ALTER TABLE "GtepLangScore" DROP CONSTRAINT "GtepLangScore_memberId_fkey";

-- DropTable
DROP TABLE "GtepFlag";

-- DropTable
DROP TABLE "GtepActivityHours";

-- DropTable
DROP TABLE "GtepLangScore";

-- DropTable
DROP TABLE "GtepMember";

-- DropEnum
DROP TYPE "GtepFlagKey";

-- DropEnum
DROP TYPE "GtepActivityCategory";
