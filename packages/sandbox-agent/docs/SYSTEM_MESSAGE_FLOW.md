# System Message Flow

## Overview

This document explains how the optimized system message flows through the entire sandbox agent architecture.

## System Message Definition

**Location**: `packages/sandbox-agent/src/prompts/system-message.ts`

```typescript
export const CODE_INTERPRETER_SYSTEM_MESSAGE = `You are an AI Assistant specializing in...

**CRITICAL OPERATION GUIDELINES**:

1. **Efficiency First**: Write comprehensive, complete code in a SINGLE execution...
2. **Task Completion Recognition**: When you see "✓ File(s) successfully created and saved"...
3. **Error Handling**: If code fails, analyze the error and fix it...
4. **Output Communication**: When files are created (images, CSVs, etc.)...
5. **Code Quality**: Write robust, well-commented code...

Remember: Your goal is to complete tasks efficiently in as few iterations as possible...`;
```

## Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  1. packages/sandbox-agent/src/prompts/system-message.ts            │
│     └─> CODE_INTERPRETER_SYSTEM_MESSAGE (定义优化后的系统消息)        │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  2. packages/sandbox-agent/src/config.ts                            │
│     └─> settings.SYSTEM_MESSAGE = CODE_INTERPRETER_SYSTEM_MESSAGE  │
│         (设置默认值)                                                  │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                                    ↓
┌─────────────────────────────────────────────────────────────────────┐
│  3. packages/sandbox-agent/src/session.ts                           │
│     └─> CodeInterpreterSession constructor                         │
│         └─> this.config.systemMessage = options.systemMessage ||   │
│             settings.SYSTEM_MESSAGE                                 │
│         └─> 在 createAgentExecutor() 中使用:                         │
│             ['system', this.config.systemMessage]                   │
└─────────────────────────────────────────────────────────────────────┘
                                    ↑
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│  4. packages/agent-tools/src/sandbox/index.ts                       │
│     └─> SandboxGenerateResponse._call()                            │
│         └─> createSessionOptions()                                 │
│             └─> systemMessage: this.params.systemMessage ||        │
│                 CODE_INTERPRETER_SYSTEM_MESSAGE                     │
│         └─> new CodeInterpreterSession(createSessionOptions())     │
└─────────────────────────────────────────────────────────────────────┘
                                    ↑
                                    │
┌─────────────────────────────────────────────────────────────────────┐
│  5. apps/api/src/modules/tool/tool.service.ts                      │
│     └─> instantiateRegularToolsets()                               │
│         └─> new toolset.class({                                    │
│               engine,          // ✅ 传递                            │
│               context,         // ✅ 传递                            │
│               // systemMessage ❌ 未传递 (使用默认值)                 │
│             })                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Current Behavior

### Without Explicit systemMessage Parameter

When `tool.service.ts` doesn't pass `systemMessage` explicitly:

```typescript
// tool.service.ts - Line 911
const toolsetInstance = new toolset.class({
  ...config,
  ...authData,
  reflyService: engine.service,
  user,
  isGlobalToolset: t?.isGlobal ?? false,
  engine,  // ✅ Passed
  context, // ✅ Passed
  // systemMessage: undefined (not passed)
});
```

The sandbox agent uses the **optimized default**:

```typescript
// sandbox/index.ts - Line 484
systemMessage: this.params.systemMessage || CODE_INTERPRETER_SYSTEM_MESSAGE
//             └─> undefined                └─> ✅ Uses optimized message
```

### Result

✅ **The optimized system message IS being used!**

Even though `tool.service.ts` doesn't explicitly pass `systemMessage`, the sandbox agent falls back to `CODE_INTERPRETER_SYSTEM_MESSAGE`, which contains all our optimizations:
- Efficiency guidelines
- Task completion recognition
- Clear stop conditions
- Comprehensive code writing instructions

## Override Options

### Option 1: Environment Variable (Global)

```bash
# .env
SYSTEM_MESSAGE="Your custom system message here"
```

This affects **all** sandbox sessions globally.

### Option 2: Tool Configuration (Per Toolset)

If you want to customize the system message for specific use cases, add it to the toolset configuration:

```typescript
// tool.service.ts
const toolsetInstance = new toolset.class({
  ...config,
  ...authData,
  reflyService: engine.service,
  user,
  isGlobalToolset: t?.isGlobal ?? false,
  engine,
  context,
  systemMessage: customSystemMessage, // 🆕 Custom message
});
```

### Option 3: Session Options (Per Request)

Pass system message through the `generateResponse` tool:

```json
{
  "message": "Analyze data.csv",
  "options": {
    "systemMessage": "Custom instructions for this specific task..."
  }
}
```

## Verification

### Check Current System Message

The system message is used in `session.ts` when creating the agent executor:

```typescript
// For ChatOpenAI (line 314)
const prompt = ChatPromptTemplate.fromMessages([
  ['system', this.config.systemMessage], // ✅ Used here
  new MessagesPlaceholder('chat_history'),
  ['human', '{input}'],
  new MessagesPlaceholder('agent_scratchpad'),
]);

// For ReAct agent (line 353)
const prompt = ChatPromptTemplate.fromMessages([
  ['system', `${this.config.systemMessage}\n\n...`], // ✅ Used here
  new MessagesPlaceholder('chat_history'),
  ['human', '{input}'],
  new MessagesPlaceholder('agent_scratchpad'),
]);
```

### Logging

To verify which system message is being used, add logging in `session.ts`:

```typescript
constructor(options: CodeInterpreterSessionOptions = {}) {
  // ... existing code ...
  
  this.config = {
    // ... existing config ...
    systemMessage: options.systemMessage || settings.SYSTEM_MESSAGE,
  };
  
  // Debug log (optional)
  console.log('[CodeInterpreterSession] System Message Preview:', 
    this.config.systemMessage.substring(0, 200) + '...');
}
```

## Priority Order

System message is resolved in this priority order:

1. **Request-level options** (highest priority)
   ```json
   { "options": { "systemMessage": "..." } }
   ```

2. **Tool params** (from tool.service.ts)
   ```typescript
   new toolset.class({ systemMessage: "..." })
   ```

3. **Environment variable** (SYSTEM_MESSAGE)
   ```bash
   SYSTEM_MESSAGE="..."
   ```

4. **Default from prompts** (lowest priority, current fallback)
   ```typescript
   CODE_INTERPRETER_SYSTEM_MESSAGE
   ```

## Summary

✅ **Current Status**: The optimized system message is **ACTIVE** and being used by default

✅ **Key Improvements Included**:
- Efficiency-first guidelines
- Task completion recognition
- Clear stop conditions
- Comprehensive code writing examples
- Minimal iteration encouragement

✅ **No Action Required**: The optimization is already in effect through the default fallback mechanism

✅ **Customization Available**: Can be overridden at any level (environment, tool config, or request) if needed

## Related Files

- `packages/sandbox-agent/src/prompts/system-message.ts` - System message definition
- `packages/sandbox-agent/src/config.ts` - Default settings
- `packages/sandbox-agent/src/session.ts` - System message consumption
- `packages/agent-tools/src/sandbox/index.ts` - Default fallback implementation
- `apps/api/src/modules/tool/tool.service.ts` - Tool instantiation

