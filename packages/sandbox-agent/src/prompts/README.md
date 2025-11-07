# Prompts for Sandbox Agent

This directory contains all prompt templates and related utilities for the Sandbox Agent.

## 📁 Files

### `system-message.ts`
The main system message that defines the code interpreter agent's capabilities and behavior.

**Exports:**
- `CODE_INTERPRETER_SYSTEM_MESSAGE` - Default system message
- `getSystemMessage(customPackages?)` - Get system message with custom package list

**Usage:**
```typescript
import { CODE_INTERPRETER_SYSTEM_MESSAGE, getSystemMessage } from './prompts';

// Use default message
console.log(CODE_INTERPRETER_SYSTEM_MESSAGE);

// Add custom packages
const message = getSystemMessage(['tensorflow', 'pytorch']);
```

### `modifications-check.ts`
Prompt template for detecting file modifications in Python code.

**Exports:**
- `DETERMINE_MODIFICATIONS_PROMPT` - LangChain prompt template
- `parseModifications(response)` - Parse LLM response to extract filenames

**Usage:**
```typescript
import { DETERMINE_MODIFICATIONS_PROMPT, parseModifications } from './prompts';

const code = 'df.to_csv("output.csv")';
const chain = DETERMINE_MODIFICATIONS_PROMPT.pipe(llm);
const response = await chain.invoke({ code });
const files = parseModifications(response.content);
// files = ["output.csv"]
```

**How it works:**
1. Provides few-shot examples showing code → modifications mapping
2. LLM returns JSON with list of modified filenames
3. Parser extracts the filenames from JSON response

**Examples in prompt:**
- Code with `plt.savefig()` → detects PNG file
- Code with `plt.show()` → no file modifications
- Teaches LLM the pattern to follow

### `remove-dl-link.ts`
Prompt template for removing download links from responses.

**Exports:**
- `REMOVE_DL_LINK_PROMPT` - LangChain chat prompt template
- `extractCleanResponse(response)` - Regex-based fallback for link removal

**Usage:**
```typescript
import { REMOVE_DL_LINK_PROMPT, extractCleanResponse } from './prompts';

// With LLM
const chain = REMOVE_DL_LINK_PROMPT.pipe(llm);
const cleaned = await chain.invoke({ input_response: text });

// Regex fallback (no LLM needed)
const cleaned = extractCleanResponse(text);
```

**What it removes:**
- Markdown links: `[text](url)`
- Download phrases: "You can download here...", "File available at..."
- Extra whitespace and formatting issues

### `index.ts`
Exports all prompts and utilities for easy importing.

**Usage:**
```typescript
// Import everything
import {
  CODE_INTERPRETER_SYSTEM_MESSAGE,
  getSystemMessage,
  DETERMINE_MODIFICATIONS_PROMPT,
  parseModifications,
  REMOVE_DL_LINK_PROMPT,
  extractCleanResponse,
} from './prompts';
```

## 🎯 Design Principles

### 1. **Few-Shot Learning**
All prompts use few-shot examples to teach the LLM the expected behavior:
- Shows correct inputs and outputs
- Covers edge cases
- Makes responses more consistent

### 2. **Structured Output**
Prompts request structured formats (JSON, specific patterns):
- Easier to parse programmatically
- Reduces parsing errors
- More reliable than free-form text

### 3. **Fallback Mechanisms**
Every LLM-based function has a regex fallback:
- Works without API calls
- Faster for simple cases
- More cost-effective
- Ensures reliability

### 4. **Clear Instructions**
Prompts are explicit about:
- What to do
- What format to use
- Edge cases to handle
- Examples to follow

## 🔄 Integration with Chains

The prompts are used in `chains.ts`:

```typescript
// chains.ts
import { DETERMINE_MODIFICATIONS_PROMPT, parseModifications } from './prompts';

export async function getFileModifications(code: string, llm: BaseChatModel) {
  // Quick heuristic check first
  if (!hasFileOperations(code)) return null;
  
  // Use LLM with prompt
  const chain = DETERMINE_MODIFICATIONS_PROMPT.pipe(llm);
  const response = await chain.invoke({ code });
  return parseModifications(response.content);
}
```

## 🧪 Testing

Test the prompts using `test-prompts.ts`:

```bash
# Run tests
npx tsx test-prompts.ts

# With OpenAI API key for full testing
OPENAI_API_KEY=sk-xxx npx tsx test-prompts.ts
```

The test suite verifies:
- System message generation
- Modifications detection
- Link removal
- Prompt template formatting

## 📝 Customization

### Custom System Message

Override via environment variable:
```bash
SYSTEM_MESSAGE="Your custom system message here"
```

Or programmatically:
```typescript
import { settings } from './config';
settings.SYSTEM_MESSAGE = 'Custom message';
```

### Custom Prompts

Extend or modify prompts:
```typescript
import { ChatPromptTemplate } from '@langchain/core/prompts';

const MY_CUSTOM_PROMPT = ChatPromptTemplate.fromTemplate(`
Your custom prompt here with {variables}
`);
```

## 🔍 Prompt Details

### System Message Components

1. **Capability Declaration**
   - Lists what the agent can do
   - Sets expectations for users
   - Guides the LLM's behavior

2. **Environment Description**
   - Jupyter kernel environment
   - Available packages
   - Limitations and constraints

3. **Usage Instructions**
   - How to interact
   - Error handling approach
   - Expected workflow

### Modifications Prompt Structure

```
1. Instruction: What to determine
2. Format: JSON with "modifications" array
3. Example 1: Code with file save → ["file.png"]
4. Example 2: Code without file save → []
5. Actual Code: {code}
6. Response Template: ```json
```

### Remove Link Prompt Structure

```
1. System: Instructions for link removal
2. Human Example: Text with download link
3. AI Example: Cleaned text
4. Actual Input: {input_response}
```

## 🚀 Best Practices

1. **Use Fallbacks**: Always provide regex-based fallbacks
2. **Test Thoroughly**: Test with various input types
3. **Keep Simple**: Don't over-complicate prompts
4. **Show Examples**: Few-shot learning works better
5. **Structure Output**: Request JSON or specific formats
6. **Handle Errors**: Gracefully handle parsing failures

## 📚 Related Files

- `chains.ts` - Uses these prompts
- `session.ts` - Main session logic
- `config.ts` - Configuration and settings
- `test-prompts.ts` - Test suite

## 🔗 References

- [LangChain Prompts Documentation](https://js.langchain.com/docs/modules/model_io/prompts/)
- [Few-Shot Prompting Guide](https://www.promptingguide.ai/techniques/fewshot)
- [Structured Output with LLMs](https://www.promptingguide.ai/techniques/structured)

---

**Created**: 2024-11-07  
**Status**: ✅ Complete  
**Version**: 1.0.0

