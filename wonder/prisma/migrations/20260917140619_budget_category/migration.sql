-- DropIndex
DROP INDEX "MarketingBudget_projectId_year_month_key";

-- AlterTable
ALTER TABLE "MarketingBudget" ADD COLUMN     "categoryId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MarketingBudget_projectId_categoryId_year_month_key" ON "MarketingBudget"("projectId", "categoryId", "year", "month");

-- AddForeignKey
ALTER TABLE "MarketingBudget" ADD CONSTRAINT "MarketingBudget_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MarketingCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
