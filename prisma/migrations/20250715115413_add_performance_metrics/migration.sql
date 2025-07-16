-- CreateTable
CREATE TABLE "performance_metrics" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "metricType" TEXT NOT NULL,
    "metricValue" DOUBLE PRECISION NOT NULL,
    "url" TEXT,
    "userAgent" TEXT,
    "viewport" TEXT,
    "connection" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "performance_metrics_shopId_idx" ON "performance_metrics"("shopId");

-- CreateIndex
CREATE INDEX "performance_metrics_metricType_idx" ON "performance_metrics"("metricType");

-- CreateIndex
CREATE INDEX "performance_metrics_createdAt_idx" ON "performance_metrics"("createdAt");

-- CreateIndex
CREATE INDEX "performance_metrics_shopId_metricType_createdAt_idx" ON "performance_metrics"("shopId", "metricType", "createdAt");
