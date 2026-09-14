-- CreateTable
CREATE TABLE "MarketingProject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#0066cc',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MarketingProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingBudget" (
    "id" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "MarketingBudget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingExpense" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "MarketingExpense_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingProject_name_key" ON "MarketingProject"("name");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingBudget_projectId_year_month_key" ON "MarketingBudget"("projectId", "year", "month");

-- CreateIndex
CREATE INDEX "MarketingExpense_date_idx" ON "MarketingExpense"("date");

-- CreateIndex
CREATE INDEX "MarketingExpense_projectId_date_idx" ON "MarketingExpense"("projectId", "date");

-- AddForeignKey
ALTER TABLE "MarketingBudget" ADD CONSTRAINT "MarketingBudget_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "MarketingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingExpense" ADD CONSTRAINT "MarketingExpense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "MarketingProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
