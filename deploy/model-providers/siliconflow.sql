-- Provider: siliconflow
-- Default model: deepseek-chat
-- OPENAI_BASE_URL: https://api.siliconflow.cn/v1
INSERT INTO "refly"."model_infos" ("name", "label", "provider", "tier", "enabled", "is_default", "context_limit", "max_output", "capabilities")
VALUES 
    ('deepseek-ai/DeepSeek-V3', 'DeepSeek-V3', 'siliconflow', 't2', 't', 't', 64000, 8000, '{}'),
    ('deepseek-ai/DeepSeek-R1-Distill-Qwen-7B', 'DeepSeek-R1-Distill-Qwen-7B', 'siliconflow', 't2', 't', 't', 32000, 8000, '{}'),
    ('deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B', 'DeepSeek-R1-Distill-Qwen-1.5B', 'siliconflow', 't2', 't', 't', 32000, 8000, '{}'),
    ('THUDM/GLM-Z1-9B-0414', 'GLM-Z1-9B-0414', 'siliconflow', 't2', 't', 't', 32000, 8000, '{}');
