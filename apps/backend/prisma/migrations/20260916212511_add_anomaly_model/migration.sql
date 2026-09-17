-- CreateTable
CREATE TABLE "Anomaly" (
    "id" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "totalLogs" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "distinctUrls" INTEGER NOT NULL,
    "simulateFailureCount" INTEGER NOT NULL,
    "errorRate" DOUBLE PRECISION NOT NULL,
    "anomalyScore" DOUBLE PRECISION NOT NULL,
    "isFalsePositive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Anomaly_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Anomaly_windowStart_idx" ON "Anomaly"("windowStart");

-- CreateIndex
CREATE INDEX "Anomaly_createdAt_idx" ON "Anomaly"("createdAt");
