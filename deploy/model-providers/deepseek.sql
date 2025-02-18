-- Provider: deepseek
-- Default model: deepseek-chat
-- OPENAI_BASE_URL: https://api.deepseek.com
INSERT INTO "refly"."model_infos" ("name", "label", "provider", "tier", "enabled", "is_default", "context_limit", "max_output", "capabilities")
VALUES 
    ('deepseek-chat', 'DeepSeek Chat', 'deepseek', 't2', 't', 't', 64000, 8000, '{}'),
    ('deepseek-reasoner', 'DeepSeek Reasoner', 'deepseek', 't1', 't', 'f', 64000, 8000, '{}');
