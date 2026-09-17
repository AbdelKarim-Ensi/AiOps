/*
  Warnings:

  - A unique constraint covering the columns `[windowStart]` on the table `Anomaly` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Anomaly_windowStart_key" ON "Anomaly"("windowStart");
