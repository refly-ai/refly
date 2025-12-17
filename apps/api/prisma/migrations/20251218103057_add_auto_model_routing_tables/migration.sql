-- CreateTable
CREATE TABLE "refly"."auto_model_routing_rules" (
    "pk" BIGSERIAL NOT NULL,
    "rule_id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "description" TEXT,
    "match" TEXT NOT NULL DEFAULT '{}',
    "target" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "auto_model_routing_rules_pkey" PRIMARY KEY ("pk")
);

-- CreateTable
CREATE TABLE "refly"."auto_model_routing_results" (
    "pk" BIGSERIAL NOT NULL,
    "routing_result_id" TEXT NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "action_result_id" TEXT,
    "scene" TEXT,
    "routing_strategy" TEXT NOT NULL,
    "matched_rule_id" TEXT,
    "matched_rule_name" TEXT,
    "selected_model_id" TEXT NOT NULL,
    "original_model_id" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_model_routing_results_pkey" PRIMARY KEY ("pk")
);

-- CreateIndex
CREATE UNIQUE INDEX "auto_model_routing_rules_rule_id_key" ON "refly"."auto_model_routing_rules"("rule_id");

-- CreateIndex
CREATE INDEX "auto_model_routing_rules_enabled_priority_idx" ON "refly"."auto_model_routing_rules"("enabled", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "auto_model_routing_results_routing_result_id_key" ON "refly"."auto_model_routing_results"("routing_result_id");

-- CreateIndex
CREATE INDEX "auto_model_routing_results_user_id_created_at_idx" ON "refly"."auto_model_routing_results"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "auto_model_routing_results_matched_rule_id_idx" ON "refly"."auto_model_routing_results"("matched_rule_id");

-- CreateIndex
CREATE INDEX "auto_model_routing_results_routing_strategy_idx" ON "refly"."auto_model_routing_results"("routing_strategy");

-- CreateIndex
CREATE INDEX "auto_model_routing_results_action_result_id_idx" ON "refly"."auto_model_routing_results"("action_result_id");

