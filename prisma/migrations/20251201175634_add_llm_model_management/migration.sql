-- CreateTable
CREATE TABLE "model_versions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "model_type" TEXT NOT NULL,
    "config" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "model_versions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "model_metrics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "model_version_id" TEXT NOT NULL,
    "metric_type" TEXT NOT NULL,
    "metric_value" REAL NOT NULL,
    "dataset" TEXT,
    "period" TEXT,
    "recorded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "model_metrics_model_version_id_fkey" FOREIGN KEY ("model_version_id") REFERENCES "model_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ab_tests" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "model_version_a_id" TEXT NOT NULL,
    "model_version_b_id" TEXT NOT NULL,
    "traffic_split" INTEGER NOT NULL DEFAULT 50,
    "start_date" DATETIME NOT NULL,
    "end_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "model_a_score" REAL,
    "model_b_score" REAL,
    "winner" TEXT,
    "created_by" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "ab_tests_model_version_a_id_fkey" FOREIGN KEY ("model_version_a_id") REFERENCES "model_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ab_tests_model_version_b_id_fkey" FOREIGN KEY ("model_version_b_id") REFERENCES "model_versions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "appeal_predictions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "debate_id" TEXT NOT NULL,
    "model_version_id" TEXT,
    "predicted_success" BOOLEAN NOT NULL,
    "confidence" REAL NOT NULL,
    "reasoning" TEXT,
    "actual_success" BOOLEAN,
    "predicted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME,
    CONSTRAINT "appeal_predictions_debate_id_fkey" FOREIGN KEY ("debate_id") REFERENCES "debates" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "appeal_predictions_model_version_id_fkey" FOREIGN KEY ("model_version_id") REFERENCES "model_versions" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "model_versions_model_type_idx" ON "model_versions"("model_type");

-- CreateIndex
CREATE INDEX "model_versions_is_active_idx" ON "model_versions"("is_active");

-- CreateIndex
CREATE UNIQUE INDEX "model_versions_name_version_key" ON "model_versions"("name", "version");

-- CreateIndex
CREATE INDEX "model_metrics_model_version_id_idx" ON "model_metrics"("model_version_id");

-- CreateIndex
CREATE INDEX "model_metrics_metric_type_idx" ON "model_metrics"("metric_type");

-- CreateIndex
CREATE INDEX "model_metrics_recorded_at_idx" ON "model_metrics"("recorded_at");

-- CreateIndex
CREATE INDEX "ab_tests_status_idx" ON "ab_tests"("status");

-- CreateIndex
CREATE INDEX "ab_tests_is_active_idx" ON "ab_tests"("is_active");

-- CreateIndex
CREATE INDEX "ab_tests_start_date_idx" ON "ab_tests"("start_date");

-- CreateIndex
CREATE INDEX "appeal_predictions_model_version_id_idx" ON "appeal_predictions"("model_version_id");

-- CreateIndex
CREATE INDEX "appeal_predictions_predicted_success_idx" ON "appeal_predictions"("predicted_success");

-- CreateIndex
CREATE INDEX "appeal_predictions_actual_success_idx" ON "appeal_predictions"("actual_success");

-- CreateIndex
CREATE UNIQUE INDEX "appeal_predictions_debate_id_key" ON "appeal_predictions"("debate_id");
