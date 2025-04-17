-- Provider: grok
-- Default model: grok-3-mini-beta
-- OPENAI_BASE_URL: https://api.x.ai/v1
INSERT INTO "refly"."model_infos" ("name", "label", "provider", "tier", "enabled", "is_default", "context_limit", "max_output", "capabilities")
VALUES 
    ('grok-3-mini-beta', 'grok-3-mini-beta', 'grok', 't2', 't', 't', 64000, 8000, '{}');
