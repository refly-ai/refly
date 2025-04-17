-- Provider: siliconflow
-- Default model: deepseek-chat
-- OPENAI_BASE_URL: https://api.siliconflow.cn/v1
INSERT INTO "refly"."model_infos" ("name", "label", "provider", "tier", "enabled", "is_default", "context_limit", "max_output", "capabilities")
VALUES 
    ('deepseek-ai/DeepSeek-V3', 'DeepSeek-V3', 'siliconflow', 't2', 't', 't', 64000, 8000, '{}');
