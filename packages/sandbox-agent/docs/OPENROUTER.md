# OpenRouter Integration Guide

## Overview

The CodeInterpreter session now supports **OpenRouter** as the primary and recommended LLM provider. OpenRouter provides unified access to multiple AI models from different providers through a single API.

## Benefits of Using OpenRouter

1. **Multiple Models**: Access GPT-4, Claude, Gemini, and other models through one API
2. **Cost Efficiency**: Choose the best model for your budget
3. **Fallback Options**: Easily switch between models without code changes
4. **Simplified Management**: One API key for all providers
5. **Transparent Pricing**: Clear per-token pricing for all models

## Quick Start

### 1. Get Your API Key

Visit [https://openrouter.ai/keys](https://openrouter.ai/keys) to create an account and get your API key.

### 2. Configure Environment Variables

Copy the `.env.example` to `.env` and set your OpenRouter API key:

```bash
cp env.example .env
```

Edit `.env`:

```bash
# OpenRouter Configuration
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Choose your model (OpenRouter format: provider/model-name)
MODEL=openai/gpt-4-turbo
```

### 3. Model Selection

OpenRouter uses the format `provider/model-name`. Popular options include:

**OpenAI Models:**
- `openai/gpt-4-turbo` - Most capable GPT-4 model
- `openai/gpt-4` - Standard GPT-4
- `openai/gpt-4o` - Fast and cost-effective

**Anthropic Models:**
- `anthropic/claude-3-opus` - Most capable Claude model
- `anthropic/claude-3-sonnet` - Balanced performance
- `anthropic/claude-3-haiku` - Fast and efficient

**Google Models:**
- `google/gemini-pro` - Google's flagship model
- `google/gemini-pro-vision` - With vision capabilities

**Meta Models:**
- `meta-llama/llama-3-70b-instruct` - Open source alternative

See the full list at: [https://openrouter.ai/models](https://openrouter.ai/models)

## Usage Example

```typescript
import { CodeInterpreterSession } from './session';

// Using OpenRouter (automatically detected from environment)
const session = new CodeInterpreterSession({
  verbose: true,
});

await session.start();

const response = await session.generateResponse(
  'Create a bar chart of monthly sales data'
);

console.log(response.content);
```

## Advanced Configuration

### Custom Model with OpenRouter

```typescript
import { CodeInterpreterSession } from './session';
import { ChatOpenAI } from '@langchain/openai';

const customLLM = new ChatOpenAI({
  modelName: 'anthropic/claude-3-opus',
  openAIApiKey: process.env.OPENROUTER_API_KEY,
  temperature: 0.1,
  configuration: {
    baseURL: 'https://openrouter.ai/api/v1',
    defaultHeaders: {
      'HTTP-Referer': 'https://your-app.com',
      'X-Title': 'Your App Name',
    },
  },
});

const session = new CodeInterpreterSession({
  llm: customLLM,
  verbose: true,
});
```

## Provider Priority

The session automatically selects the LLM provider in the following order:

1. **OpenRouter** (`OPENROUTER_API_KEY`) - Recommended
2. **Azure OpenAI** (`AZURE_OPENAI_API_KEY`)
3. **Direct OpenAI** (`OPENAI_API_KEY`)
4. **Anthropic** (`ANTHROPIC_API_KEY`)

This allows you to easily switch between providers by setting different environment variables.

## Function Calling Support

OpenRouter supports function calling for compatible models (OpenAI, Claude 3+, etc.). The session automatically uses function calling when available, providing better tool usage and more reliable code execution.

## Migration from Direct OpenAI

If you're currently using direct OpenAI:

### Before:
```bash
OPENAI_API_KEY=sk-...
MODEL=gpt-4
```

### After:
```bash
OPENROUTER_API_KEY=sk-or-v1-...
MODEL=openai/gpt-4-turbo
```

No code changes required! Just update your environment variables.

## Troubleshooting

### Functions/Function_call Deprecated Error

If you see:
```
400 "functions" and "function_call" are deprecated in favor of "tools" and "tool_choice."
```

**Solution**: Ensure you're using LangChain v0.3.0+

```bash
npm install @langchain/openai@^0.3.0 @langchain/core@^0.3.0 langchain@^0.3.0
```

This error occurs with older LangChain versions. The fix upgrades to the modern `tools` API.

See: [BUGFIX_FUNCTIONS_DEPRECATED.md](./BUGFIX_FUNCTIONS_DEPRECATED.md)

### Request Timeout Error

If you encounter timeout errors:

**Solution 1: Increase Timeout**
```bash
# Set timeout to 5 minutes (300 seconds) or more
REQUEST_TIMEOUT=300
```

**Solution 2: Use Faster Models**
Some models respond faster than others. Try:
- `openai/gpt-4o` (fastest)
- `anthropic/claude-3-haiku` (fast)
- `google/gemini-pro` (fast)

**Note**: The timeout is automatically converted from seconds to milliseconds internally. A 300-second timeout gives you 5 minutes, which is recommended for OpenRouter.

### Model Not Found Error

If you get a "model not found" error, check:
1. The model name format is correct (`provider/model-name`)
2. The model is available on OpenRouter
3. Your API key has access to the model

### Rate Limit Issues

OpenRouter has different rate limits per model. Consider:
1. Using a different model tier
2. Implementing retry logic (already built-in with `MAX_RETRY`)
3. Checking your account limits

### Cost Monitoring

Monitor your usage at: [https://openrouter.ai/activity](https://openrouter.ai/activity)

## Best Practices

1. **Start with gpt-4o**: Cost-effective for testing
2. **Use GPT-4 for Complex Tasks**: Better reasoning for complex code generation
3. **Try Claude for Long Context**: Excellent for large codebases
4. **Set Appropriate Timeouts**: Adjust `REQUEST_TIMEOUT` based on model speed
5. **Monitor Costs**: Keep track of token usage for different models

## Environment Variables Reference

| Variable | Description | Example |
|----------|-------------|---------|
| `OPENROUTER_API_KEY` | Your OpenRouter API key | `sk-or-v1-...` |
| `MODEL` | Model to use | `openai/gpt-4-turbo` |
| `TEMPERATURE` | Response randomness (0-1) | `0.03` |
| `MAX_ITERATIONS` | Max agent iterations | `12` |
| `MAX_RETRY` | Max retry attempts | `3` |
| `REQUEST_TIMEOUT` | Timeout in seconds (converted to ms internally) | `300` |

## Additional Resources

- OpenRouter Documentation: [https://openrouter.ai/docs](https://openrouter.ai/docs)
- Model Pricing: [https://openrouter.ai/models](https://openrouter.ai/models)
- API Status: [https://status.openrouter.ai/](https://status.openrouter.ai/)

## Support

For issues related to:
- **OpenRouter API**: Contact [https://openrouter.ai/support](https://openrouter.ai/support)
- **CodeInterpreter Integration**: Open an issue on GitHub

