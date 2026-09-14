-- AlterTable
ALTER TABLE "MarketingExpense" ADD COLUMN     "categoryId" TEXT;

-- CreateTable
CREATE TABLE "MarketingCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0066cc',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "MarketingCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingCategory_projectId_name_key" ON "MarketingCategory"("projectId", "name");

-- AddForeignKey
ALTER TABLE "MarketingCategory" ADD CONSTRAINT "MarketingCategory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "MarketingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingExpense" ADD CONSTRAINT "MarketingExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MarketingCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
