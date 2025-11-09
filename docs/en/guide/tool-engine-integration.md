# Tool-Engine Integration Guide

## Overview

This document explains how to integrate LLM calls at the Tool Layer, ensuring proper token usage tracking and credit billing.

## Architecture

### Call Chain

```
skill.service.ts
  ↓ prepareInvokeSkillJobData
skill-invoker.service.ts
  ↓ buildInvokeConfig (passes engine)
agent.ts / skill
  ↓ agentNode (selectedTools from config.configurable)
tool.service.ts
  ↓ instantiateRegularToolsets (passes engine to toolsets)
SandboxToolset
  ↓ initializeTools (uses engine parameter)
SandboxGenerateResponse
  ↓ _call (creates LLM via engine.chatModel())
CodeInterpreterSession
  ↓ Uses pre-configured LLM instance
```

### Key Components

1. **SkillEngine**: Provides unified LLM instance creation and configuration management
2. **BaseToolParams**: Base tool parameters interface, includes `engine` field
3. **ToolService**: Responsible for instantiating toolsets and passing engine
4. **Tool**: Tool implementation, uses `engine.chatModel()` to create LLM

## Usage Guide

### 1. Adding Engine Support to Tools

#### Step 1: Extend Tool Parameters Interface

Add the `engine` field to your tool parameters interface:

```typescript
import type { ISkillEngine } from '@refly/common-types';

export interface MyToolParams {
  user: User;
  apiKey?: string;
  reflyService?: any;
  
  /**
   * SkillEngine instance for creating LLM instances.
   * When provided, the tool should use engine.chatModel() to create LLM instances,
   * which ensures proper token usage tracking and credit billing.
   */
  engine?: ISkillEngine;
  
  // Other tool-specific parameters
  // ...
}
```

#### Step 2: Use Engine in Tool Implementation

Use `engine.chatModel()` in the tool's `_call` method to create LLM instances:

```typescript
export class MyTool extends AgentBaseTool<MyToolParams> {
  name = 'myTool';
  toolsetKey = 'my-toolset';
  
  protected params: MyToolParams;

  constructor(params: MyToolParams) {
    super(params);
    this.params = params;
  }

  async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
    try {
      // Method 1: Use engine to create LLM (Recommended)
      if (this.params.engine) {
        const llm = this.params.engine.chatModel({
          temperature: 0.1,
        });
        
        // Use llm for calls
        const response = await llm.invoke(messages);
        
        return {
          status: 'success',
          data: response,
          summary: 'Operation completed successfully',
        };
      }
      
      // Method 2: Fallback - Manually create LLM (Not recommended, for compatibility only)
      const llm = new ChatOpenAI({
        apiKey: this.params.openaiApiKey,
        // ... other configs
      });
      
      // ...
    } catch (error) {
      return {
        status: 'error',
        error: 'Failed to process request',
        summary: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

#### Step 3: Passing Pre-configured LLM Instance (For Third-party Libraries)

If using a third-party library that requires an LLM instance as a parameter (like sandbox-agent):

```typescript
async _call(input: z.infer<typeof this.schema>): Promise<ToolCallResult> {
  // Create configuration object for third-party library
  const createLibraryOptions = () => {
    const baseOptions = {
      apiKey: this.params.apiKey,
      // ... other options
    };

    // If engine is available, create LLM instance and pass it
    if (this.params.engine) {
      const llm = this.params.engine.chatModel({
        temperature: this.params.temperature ?? 0.1,
      });
      
      return {
        ...baseOptions,
        llm, // Pass pre-configured LLM instance
      };
    }

    // Fallback: Pass configuration parameters for library to create LLM itself
    return {
      ...baseOptions,
      openaiApiKey: this.params.openaiApiKey,
      model: this.params.model,
      temperature: this.params.temperature,
    };
  };

  // Use configuration to create third-party library instance
  const library = new ThirdPartyLibrary(createLibraryOptions());
  const result = await library.execute(input);
  
  return {
    status: 'success',
    data: result,
  };
}
```

### 2. Token Usage Tracking

LLM instances created via `engine.chatModel()` automatically participate in token usage tracking:

```typescript
// Use engine.chatModel() in tool
const llm = this.params.engine.chatModel({ temperature: 0.1 });

// Call LLM - token usage is automatically tracked
const response = await llm.invoke(messages, {
  ...config,
  metadata: {
    // LangChain automatically records token usage
  },
});

// No need to manually handle token usage, the system automatically:
// 1. Collects token usage in streamEvents' on_chat_model_end event
// 2. Records via resultAggregator.addUsageItem()
// 3. Performs batch billing via processCreditUsageReport() after skill completion
```

### 3. Credit Billing Flow

Credit billing is automatic and doesn't require manual handling at the tool layer:

```
1. LLM call generates token usage
   ↓
2. streamEvents triggers on_chat_model_end event
   ↓
3. skill-invoker.service collects token usage
   └─ resultAggregator.addUsageItem(runMeta, usage)
   ↓
4. Batch process credits after skill execution completes
   └─ processCreditUsageReport()
       ├─ Extract token usage from steps
       ├─ Find corresponding provider items and credit billing config
       └─ Call syncBatchTokenCreditUsage() for batch billing
```

## Type Definitions

### Avoiding Circular Dependencies

To avoid circular dependencies between `@refly/agent-tools` and `@refly/skill-template`, shared interface types are placed in `@refly/common-types`:

```typescript
// packages/common-types/src/skill-engine.ts
export interface ISkillEngine {
  /**
   * Create a chat model instance with the specified parameters.
   * This ensures proper token usage tracking and credit billing.
   */
  chatModel(params?: ChatModelParams, scene?: ModelScene): any;
  
  service?: any;
  logger?: ILogger;
}

// packages/agent-tools/src/base.ts
import type { ISkillEngine } from '@refly/common-types';

export interface BaseToolParams {
  engine?: ISkillEngine;
}
```

Benefits:
1. ✅ Avoids circular dependencies
2. ✅ Type safety
3. ✅ Clear interface definitions
4. ✅ Easy to document

## Best Practices

### 1. Prefer Using Engine

Always prefer using `engine.chatModel()` to create LLM instances:

```typescript
// ✅ Recommended
if (this.params.engine) {
  const llm = this.params.engine.chatModel({ temperature: 0.1 });
}

// ❌ Not recommended (unless as fallback)
const llm = new ChatOpenAI({
  apiKey: this.params.openaiApiKey,
});
```

### 2. Provide Fallback Mechanism

For backward compatibility and independent testing, provide fallback configuration:

```typescript
const createSessionOptions = () => {
  const baseOptions = { /* ... */ };

  // Prefer using engine
  if (this.params.engine) {
    return {
      ...baseOptions,
      llm: this.params.engine.chatModel({ temperature: 0.1 }),
    };
  }

  // Fallback to manual configuration
  return {
    ...baseOptions,
    openaiApiKey: this.params.openaiApiKey,
    model: this.params.model,
  };
};
```

### 3. Avoid Duplicate Token Tracking

Don't manually record token usage at the tool layer, the system handles it automatically:

```typescript
// ❌ Not needed
const response = await llm.invoke(messages);
const tokenUsage = response.usage_metadata; // No need to manually handle
// recordTokenUsage(tokenUsage); // No need to manually record

// ✅ Correct approach: Just use it, system tracks automatically
const response = await llm.invoke(messages);
return { status: 'success', data: response };
```

### 4. Use Appropriate Temperature

Set appropriate temperature based on the tool's purpose:

```typescript
// For code generation, data analysis, etc. requiring accuracy
const llm = this.params.engine.chatModel({ temperature: 0.1 });

// For creative writing, content generation, etc. requiring diversity
const llm = this.params.engine.chatModel({ temperature: 0.7 });
```

### 5. Proper API Key Handling

Follow Scalebox tool's best practices for proper API key handling:

```typescript
/**
 * Ensure API key is set in environment variable.
 * This is required by some underlying SDKs that expect the API key in process.env.
 */
function ensureApiKey(apiKey?: string): void {
  if (apiKey && (!process.env.YOUR_SDK_API_KEY || process.env.YOUR_SDK_API_KEY !== apiKey)) {
    process.env.YOUR_SDK_API_KEY = apiKey;
  }
}

export class MyTool extends AgentBaseTool<MyToolParams> {
  async _call(input: any): Promise<ToolCallResult> {
    // Ensure API key is set in environment variable
    ensureApiKey(this.params.apiKey);
    
    try {
      // Pass API key both as parameter and use environment variable as fallback
      const sdk = await YourSDK.create({
        apiKey: this.params.apiKey ?? process.env.YOUR_SDK_API_KEY,
        // ... other options
      });
      
      // ... use SDK
    } catch (error) {
      // ... error handling
    }
  }
}
```

**Why This Is Necessary**:
- Some SDKs read API key from `process.env`
- Pass API key in parameters as a fallback
- Ensures proper API key isolation in multi-user/multi-tenant environments

## Testing Recommendations

### 1. Functional Tests

```typescript
describe('MyTool with engine', () => {
  it('should use engine.chatModel() when engine is provided', async () => {
    const mockEngine = {
      chatModel: jest.fn().mockReturnValue(mockLLM),
    };
    
    const tool = new MyTool({
      user: mockUser,
      engine: mockEngine,
    });
    
    await tool.invoke(input);
    
    expect(mockEngine.chatModel).toHaveBeenCalledWith({
      temperature: 0.1,
    });
  });
});
```

### 2. Token Tracking Tests

```typescript
describe('Token usage tracking', () => {
  it('should track token usage from engine-created LLM', async () => {
    const resultAggregator = new ResultAggregator(/* ... */);
    
    // Execute skill with tool that uses engine
    await executeSkillWithTool();
    
    const steps = await resultAggregator.getSteps();
    const tokenUsage = steps[0].tokenUsage;
    
    expect(tokenUsage).toBeDefined();
    expect(tokenUsage.inputTokens).toBeGreaterThan(0);
    expect(tokenUsage.outputTokens).toBeGreaterThan(0);
  });
});
```

### 3. Credit Billing Tests

```typescript
describe('Credit billing', () => {
  it('should correctly bill credits for tool LLM usage', async () => {
    const initialCredits = await getCredits(user.uid);
    
    // Execute tool that uses LLM
    await executeTool();
    
    const finalCredits = await getCredits(user.uid);
    const creditUsed = initialCredits - finalCredits;
    
    expect(creditUsed).toBeGreaterThan(0);
  });
});
```

## Related Resources

- [SkillEngine Documentation](./skill-engine.md)
- [Tool Development Guide](./tool-development.md)
- [Credit Billing System](./credit-billing.md)
- [API Reference](../../api/skill-engine.md)

