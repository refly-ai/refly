-- Provider: openrouter
-- Default model: gpt-4o-mini
-- OPENAI_BASE_URL: https://openrouter.ai/api/v1
INSERT INTO "refly"."model_infos" ("name", "label", "provider", "tier", "enabled", "is_default", "context_limit", "max_output", "capabilities")
VALUES 
    -- Anthropic models
    ('anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'anthropic', 't1', 't', 'f', 200000, 8192, '{"vision":true}'),
    ('anthropic/claude-3.5-haiku', 'Claude 3.5 Haiku', 'anthropic', 't2', 't', 'f', 200000, 8192, '{"vision":true}'),

    -- DeepSeek models
    ('deepseek/deepseek-r1', 'DeepSeek R1', 'deepseek', 't1', 't', 'f', 64000, 8192, '{"reasoning":true}'),
    ('deepseek/deepseek-chat', 'DeepSeek V3', 'deepseek', 't2', 't', 'f', 64000, 8192, '{}'),
    ('deepseek/deepseek-r1-distill-qwen-32b', 'DeepSeek R1 Distill Qwen 32B', 'deepseek', 't2', 't', 'f', 131072, 131072, '{}'),

    -- Google models
    ('google/gemini-2.0-flash-exp:free', 'Gemini Flash 2.0', 'google', 'free', 't', 'f', 1048576, 8192, '{}'),
    ('google/gemini-2.0-pro-exp-02-05:free', 'Gemini Pro 2.0 Experimental', 'google', 'free', 't', 'f', 2000000, 8192, '{}'),
    ('google/gemini-pro-1.5', 'Gemini Pro 1.5', 'google', 't1', 't', 'f', 2000000, 8192, '{"vision":true}'),
    ('google/gemini-2.0-flash-001', 'Gemini Flash 2.0', 'google', 't2', 't', 'f', 1000000, 8192, '{"vision":true}'),

    -- Meta-Llama models
    ('meta-llama/llama-3.3-70b-instruct', 'Llama 3.3 70B', 'meta-llama', 't2', 't', 'f', 131072, 131072, '{}'),

    -- Mistral models
    ('mistralai/ministral-8b', 'Ministral 8B', 'mistral', 'free', 't', 'f', 128000, 128000, '{}'),
    ('mistralai/mixtral-8x7b-instruct', 'Mixtral 8x7B Instruct', 'mistral', 't2', 't', 'f', 32768, 32768, '{}'),

    -- OpenAI models
    ('openai/gpt-4o', 'GPT-4o', 'openai', 't1', 't', 'f', 128000, 16384, '{"vision":true}'),
    ('openai/o3-mini', 'o3 Mini', 'openai', 't1', 't', 'f', 200000, 100000, '{}'),
    ('openai/gpt-4o-mini', 'GPT-4o Mini', 'openai', 't2', 't', 't', 128000, 16384, '{"vision":true}'),

    -- Qwen models
    ('qwen/qwen-2.5-72b-instruct', 'Qwen 2.5 72B', 'qwen', 't2', 't', 'f', 32000, 4096, '{}'),

    -- Grok models
    ('x-ai/grok-3-beta', 'Grok 3 Beta', 'xai', 't2', 't', 'f', 131072, 131072, '{}'),
    ('x-ai/grok-3-mini-beta', 'Grok 3 Mini Beta', 'xai', 't2', 't', 'f', 131072, 131072, '{}');