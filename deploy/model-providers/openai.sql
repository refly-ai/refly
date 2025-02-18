-- Provider: openai
-- Default model: gpt-4o-mini
-- OPENAI_BASE_URL: https://api.openai.com
INSERT INTO "refly"."model_infos" ("name", "label", "provider", "tier", "enabled", "is_default", "context_limit", "max_output", "capabilities")
VALUES 
    ('o3-mini', 'o3 Mini', 'openai', 't1', 't', 'f', 200000, 100000, '{}'),
    ('o1-preview', 'o1 Preview', 'openai', 't1', 't', 'f', 128000, 32768, '{}'),
    ('gpt-4o', 'GPT-4o', 'openai', 't1', 't', 'f', 128000, 16384, '{"vision":true}'),
    ('gpt-4o-mini', 'GPT-4o Mini', 'openai', 't2', 't', 't', 128000, 16384, '{"vision":true}');
