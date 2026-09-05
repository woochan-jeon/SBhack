-- CreateTable
CREATE TABLE "FlowBoard" (
    "id" TEXT NOT NULL,
    "stateJson" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FlowBoard_pkey" PRIMARY KEY ("id")
);
