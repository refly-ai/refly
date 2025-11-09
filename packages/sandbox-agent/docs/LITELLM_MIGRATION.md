# LiteLLM Migration Guide

This document describes the migration from OpenRouter to LiteLLM for the Sandbox Agent project.

## Overview

LiteLLM provides a unified OpenAI-compatible API that supports 100+ LLM models from different providers, making it an excellent choice for:

- Easy model switching
- Cost tracking and budgets
- Load balancing and fallbacks
- Self-hosting options

## Changes Made

### 1. Environment Configuration (`env.example`)

**Before:**

```bash
OPENROUTER_API_KEY=your_openrouter_api_key_here
MODEL=openai/gpt-4-turbo
```

**After:**

```bash
OPENAI_API_KEY=your_litellm_api_key_here
OPENAI_BASE_URL=https://litellm.powerformer.net/v1
MODEL=gpt-4-turbo
```

### 2. Configuration Interface (`config.ts`)

**Removed:**

- `OPENROUTER_API_KEY` from the settings interface

**Added:**

- `OPENAI_BASE_URL` to support custom base URLs for LiteLLM and other OpenAI-compatible services

### 3. Session Implementation (`session.ts`)

**Simplified LLM Selection Logic:**

The `chooseLLM()` method now has a cleaner priority order:

1. Azure OpenAI (for enterprise deployments)
2. OpenAI-compatible API (LiteLLM, OpenAI direct, etc.)
3. Anthropic (for Claude models)

**Key Changes:**

- Removed OpenRouter-specific logic and HTTP headers
- Consolidated OpenAI and LiteLLM into a single configuration path
- Added automatic provider detection based on `OPENAI_BASE_URL`
- Simplified error messages

### 4. Documentation Updates

**Updated Files:**

- `README.md`: Changed recommendations from OpenRouter to LiteLLM
- `docs/LLM_PROVIDERS.md`: Updated provider comparison and migration guides

## Setup Instructions

### 1. Create `.env` File

Copy the example and configure your LiteLLM credentials:

```bash
cp env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your LiteLLM credentials:

```bash
# Debug mode
DEBUG=false

# LiteLLM API Configuration
OPENAI_API_KEY=sk-P1YzjogTlu09MYlnWBDtog
OPENAI_BASE_URL=https://litellm.powerformer.net/v1

# LLM Settings
MODEL=gpt-4o
TEMPERATURE=0.03
DETAILED_ERROR=true
REQUEST_TIMEOUT=300
MAX_ITERATIONS=12
MAX_RETRY=3

# CodeBox Settings
SCALEBOX_API_KEY=
```

### 3. Model Configuration

LiteLLM uses direct model names (no provider prefix):

| Model Type | Model Name                                           |
| ---------- | ---------------------------------------------------- |
| OpenAI     | `gpt-4-turbo`, `gpt-4o`, `gpt-4`              |
| Anthropic  | `claude-3-opus`, `claude-3-sonnet`, `claude-3-haiku` |
| Google     | `gemini-pro`, `gemini-pro-vision`                    |
| Meta       | `llama-3-70b`, `llama-3-8b`                          |
| Mistral    | `mistral-large`, `mistral-medium`                    |

## Benefits of LiteLLM

### 1. OpenAI-Compatible API

- Drop-in replacement for OpenAI SDK
- No need to change existing code patterns
- Easy migration from OpenAI direct

### 2. Cost Management

- Built-in cost tracking
- Budget limits and alerts
- Usage analytics

### 3. Reliability

- Load balancing across multiple providers
- Automatic fallbacks on failures
- Rate limit management

### 4. Flexibility

- Self-hostable (open source)
- Support for 100+ models
- Easy model switching

## Usage Examples

### Basic Usage

```typescript
import { CodeInterpreterSession } from './session';

async function main() {
  const session = new CodeInterpreterSession({
    verbose: true,
  });

  try {
    await session.start();
    console.log('Session started with LiteLLM');

    const response = await session.generateResponse('Calculate the sum of numbers from 1 to 100');
    console.log('Response:', response.content);
  } finally {
    await session.stop();
  }
}

main().catch(console.error);
```

### Switching Models

Simply change the `MODEL` environment variable:

```bash
# Use GPT-4 Turbo
MODEL=gpt-4-turbo

# Use Claude 3 Opus
MODEL=claude-3-opus

# Use Gemini Pro
MODEL=gemini-pro
```

### Using Direct OpenAI (Fallback)

If you want to use OpenAI directly without LiteLLM, simply remove the `OPENAI_BASE_URL`:

```bash
OPENAI_API_KEY=sk-...
# OPENAI_BASE_URL=  # Comment out or remove this line
MODEL=gpt-4o
```

## Troubleshooting

### Connection Issues

If you encounter connection issues:

1. Verify your API key is correct
2. Check the base URL is accessible
3. Ensure network connectivity to LiteLLM proxy

### Model Not Found

If you get a model not found error:

1. Check the model name is correct (no provider prefix)
2. Verify the model is available through your LiteLLM proxy
3. Check LiteLLM proxy configuration

### Timeout Errors

If requests timeout:

1. Increase `REQUEST_TIMEOUT` in `.env`
2. Check LiteLLM proxy health
3. Verify model availability

## Migration Checklist

- [x] Updated `env.example` with LiteLLM configuration
- [x] Updated `config.ts` to support `OPENAI_BASE_URL`
- [x] Simplified `session.ts` LLM selection logic
- [x] Updated `README.md` documentation
- [x] Updated `docs/LLM_PROVIDERS.md`
- [x] Fixed linter errors (string quotes)
- [x] Created `.env` with provided credentials (user needs to create manually)

## Additional Resources

- **LiteLLM Documentation**: [https://docs.litellm.ai](https://docs.litellm.ai)
- **LiteLLM GitHub**: [https://github.com/BerriAI/litellm](https://github.com/BerriAI/litellm)
- **Self-hosting Guide**: [https://docs.litellm.ai/docs/proxy/deploy](https://docs.litellm.ai/docs/proxy/deploy)

## Support

For issues related to:

- **LiteLLM Proxy**: Check LiteLLM documentation or GitHub issues
- **Code Interpreter**: Open an issue in this repository
- **Model Availability**: Contact your LiteLLM proxy administrator

## Rollback Plan

If you need to rollback to OpenAI direct:

```bash
# In .env
OPENAI_API_KEY=sk-...
# Remove or comment out OPENAI_BASE_URL
MODEL=gpt-4o
```

The code automatically detects whether to use custom base URL or standard OpenAI based on the presence of `OPENAI_BASE_URL`.
