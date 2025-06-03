import { Agent } from '../src/agent';
import { createLangfuseIntegration, traced } from '../src/langfuse-integration';
import { ChatOpenAI } from '@langchain/openai';

/**
 * Example: Basic Langfuse Integration
 */
async function basicExample() {
  // Create Langfuse integration with configuration
  const langfuseIntegration = createLangfuseIntegration({
    sessionId: 'example-session-123',
    userId: 'user-456',
    tags: ['example', 'skill-execution'],
    metadata: {
      environment: 'development',
      version: '1.0.0',
    },
  });

  // Create agent
  const agent = new Agent({
    name: 'example-agent',
    description: 'An example agent with Langfuse monitoring',
    // ... other agent configuration
  });

  // Attach monitoring to agent
  langfuseIntegration.attachToAgent(agent);

  // Create a trace for skill execution
  const traceId = langfuseIntegration.createSkillTrace('example-skill', {
    input: 'Hello, world!',
    parameters: { temperature: 0.7 },
  });

  try {
    // Simulate skill execution
    const result = await agent.run({
      input: 'Hello, world!',
      context: { sessionId: 'example-session-123' },
    });

    // Update trace with successful result
    langfuseIntegration.updateSkillTrace(traceId, {
      output: result,
      success: true,
    });

    console.log('Skill executed successfully:', result);
  } catch (error) {
    // Mark trace as failed
    langfuseIntegration.failSkillTrace(traceId, error as Error);
    console.error('Skill execution failed:', error);
  } finally {
    // Cleanup resources
    langfuseIntegration.cleanup();
  }
}

/**
 * Example: LangChain Integration
 */
async function langchainExample() {
  const langfuseIntegration = createLangfuseIntegration({
    sessionId: 'langchain-session-123',
    userId: 'user-789',
    tags: ['langchain', 'llm'],
  });

  // Get LangChain callback handler
  const callback = langfuseIntegration.getLangChainCallback();

  // Create LLM with Langfuse monitoring
  const llm = new ChatOpenAI({
    modelName: 'gpt-3.5-turbo',
    temperature: 0.7,
    callbacks: callback ? [callback] : [],
  });

  try {
    // This LLM call will be automatically traced
    const response = await llm.invoke('What is the capital of France?');
    console.log('LLM Response:', response.content);
  } catch (error) {
    console.error('LLM call failed:', error);
  } finally {
    langfuseIntegration.cleanup();
  }
}

/**
 * Example: Custom Span Creation
 */
async function customSpanExample() {
  const langfuseIntegration = createLangfuseIntegration({
    sessionId: 'custom-span-session',
    userId: 'user-custom',
  });

  // Create a span for data processing
  const spanId = langfuseIntegration.createSpan('data-processing', {
    inputSize: 1000,
    processingType: 'batch',
  });

  try {
    // Simulate data processing
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Update span with results
    langfuseIntegration.updateSpan(spanId, {
      outputSize: 500,
      processingTime: 1000,
      itemsProcessed: 100,
    });

    console.log('Data processing completed');
  } catch (error) {
    // Mark span as failed
    langfuseIntegration.failSpan(spanId, error as Error);
    console.error('Data processing failed:', error);
  } finally {
    langfuseIntegration.cleanup();
  }
}

/**
 * Example: Method Tracing with Decorator
 */
class ExampleService {
  private langfuseIntegration = createLangfuseIntegration({
    sessionId: 'service-session',
    userId: 'service-user',
    tags: ['service', 'example'],
  });

  @traced('data-validation')
  async validateData(data: any): Promise<boolean> {
    // Simulate validation logic
    await new Promise((resolve) => setTimeout(resolve, 500));

    if (!data || typeof data !== 'object') {
      throw new Error('Invalid data format');
    }

    return true;
  }

  @traced('data-transformation')
  async transformData(data: any): Promise<any> {
    // Simulate transformation logic
    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      ...data,
      transformed: true,
      timestamp: new Date().toISOString(),
    };
  }

  async processData(data: any): Promise<any> {
    try {
      // These method calls will be automatically traced
      await this.validateData(data);
      const result = await this.transformData(data);

      console.log('Data processed successfully:', result);
      return result;
    } catch (error) {
      console.error('Data processing failed:', error);
      throw error;
    }
  }

  cleanup(): void {
    this.langfuseIntegration.cleanup();
  }
}

/**
 * Example: LLM Generation Logging
 */
async function generationLoggingExample() {
  const langfuseIntegration = createLangfuseIntegration({
    sessionId: 'generation-session',
    userId: 'user-generation',
  });

  // Log a generation with token usage
  langfuseIntegration.logGeneration(
    'text-completion',
    'What is the capital of France?',
    'The capital of France is Paris.',
    {
      promptTokens: 8,
      completionTokens: 7,
      totalTokens: 15,
    },
    {
      model: 'gpt-3.5-turbo',
      temperature: 0.7,
      maxTokens: 100,
    },
  );

  console.log('Generation logged successfully');
  langfuseIntegration.cleanup();
}

/**
 * Example: Error Handling and Recovery
 */
async function errorHandlingExample() {
  const langfuseIntegration = createLangfuseIntegration({
    sessionId: 'error-handling-session',
    userId: 'user-error',
    tags: ['error-handling', 'resilience'],
  });

  const traceId = langfuseIntegration.createSkillTrace('error-prone-skill', {
    input: 'test data',
    retryAttempts: 3,
  });

  let attempt = 0;
  const maxAttempts = 3;

  while (attempt < maxAttempts) {
    const spanId = langfuseIntegration.createSpan(`attempt-${attempt + 1}`, {
      attemptNumber: attempt + 1,
      maxAttempts,
    });

    try {
      // Simulate operation that might fail
      if (Math.random() < 0.7) {
        throw new Error(`Simulated failure on attempt ${attempt + 1}`);
      }

      // Success
      langfuseIntegration.updateSpan(spanId, {
        success: true,
        attemptNumber: attempt + 1,
      });

      langfuseIntegration.updateSkillTrace(traceId, {
        success: true,
        totalAttempts: attempt + 1,
      });

      console.log(`Operation succeeded on attempt ${attempt + 1}`);
      break;
    } catch (error) {
      langfuseIntegration.failSpan(spanId, error as Error, {
        attemptNumber: attempt + 1,
        willRetry: attempt < maxAttempts - 1,
      });

      attempt++;

      if (attempt >= maxAttempts) {
        langfuseIntegration.failSkillTrace(traceId, error as Error, {
          totalAttempts: attempt,
          finalFailure: true,
        });
        console.error('Operation failed after all attempts:', error);
      } else {
        console.log(`Attempt ${attempt} failed, retrying...`);
        await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait before retry
      }
    }
  }

  langfuseIntegration.cleanup();
}

/**
 * Run all examples
 */
async function runExamples() {
  console.log('Running Langfuse integration examples...\n');

  try {
    console.log('1. Basic Example:');
    await basicExample();
    console.log('✓ Basic example completed\n');

    console.log('2. LangChain Example:');
    await langchainExample();
    console.log('✓ LangChain example completed\n');

    console.log('3. Custom Span Example:');
    await customSpanExample();
    console.log('✓ Custom span example completed\n');

    console.log('4. Method Tracing Example:');
    const service = new ExampleService();
    await service.processData({ test: 'data' });
    service.cleanup();
    console.log('✓ Method tracing example completed\n');

    console.log('5. Generation Logging Example:');
    await generationLoggingExample();
    console.log('✓ Generation logging example completed\n');

    console.log('6. Error Handling Example:');
    await errorHandlingExample();
    console.log('✓ Error handling example completed\n');

    console.log('All examples completed successfully!');
  } catch (error) {
    console.error('Example execution failed:', error);
  }
}

// Export examples for use
export {
  basicExample,
  langchainExample,
  customSpanExample,
  ExampleService,
  generationLoggingExample,
  errorHandlingExample,
  runExamples,
};

// Run examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}
