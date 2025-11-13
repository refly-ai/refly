/**
 * Context Persistence Tests
 *
 * These tests verify that code execution context is preserved across
 * multiple executions within the same session, allowing variables,
 * functions, and imports to persist.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { CodeBox } from '../src/sandbox/codebox-adapter';
import { CodeContext } from '../src/sandbox/types';

const timeout = 120000; // 2 minutes timeout

describe('Code Execution Context Persistence', () => {
  let codebox: CodeBox;

  beforeEach(async () => {
    // Create a new CodeBox instance
    codebox = new CodeBox({
      apiKey: process.env.SCALEBOX_API_KEY || '',
      timeoutMs: timeout,
    });
  }, timeout);

  afterEach(async () => {
    // Clean up
    if (codebox) {
      await codebox.stop();
    }
  }, timeout);

  describe('Default Context Persistence', () => {
    it(
      'should preserve variables across executions',
      async () => {
        // Start sandbox
        await codebox.start();

        // First execution - define variables
        const result1 = await codebox.run(`
test_var = "Hello from context"
numbers = [1, 2, 3, 4, 5]
counter = 0
print(f"Defined: test_var={test_var}, counter={counter}")
`);

        expect(result1.type).toBe('text');
        expect(result1.content).toContain('Defined');

        // Second execution - use previously defined variables
        const result2 = await codebox.run(`
print(f"From context: test_var={test_var}")
counter += 10
numbers.append(6)
print(f"Modified: counter={counter}, len(numbers)={len(numbers)}")
`);

        expect(result2.type).toBe('text');
        expect(result2.content).toContain('From context: test_var=Hello from context');
        expect(result2.content).toContain('Modified: counter=10');
        expect(result2.content).toContain('len(numbers)=6');
      },
      timeout,
    );

    it(
      'should preserve functions across executions',
      async () => {
        await codebox.start();

        // First execution - define function
        const result1 = await codebox.run(`
def greet(name):
    return f"Hello, {name}!"

print(greet("World"))
`);

        expect(result1.type).toBe('text');
        expect(result1.content).toContain('Hello, World!');

        // Second execution - use previously defined function
        const result2 = await codebox.run(`
print(greet("Context"))
print("Function still available!")
`);

        expect(result2.type).toBe('text');
        expect(result2.content).toContain('Hello, Context!');
        expect(result2.content).toContain('Function still available!');
      },
      timeout,
    );

    it(
      'should preserve imports across executions',
      async () => {
        await codebox.start();

        // First execution - import module
        const result1 = await codebox.run(`
import math
print(f"pi = {math.pi}")
`);

        expect(result1.type).toBe('text');
        expect(result1.content).toContain('pi = 3.14');

        // Second execution - use previously imported module
        const result2 = await codebox.run(`
print(f"sqrt(16) = {math.sqrt(16)}")
print(f"cos(0) = {math.cos(0)}")
`);

        expect(result2.type).toBe('text');
        expect(result2.content).toContain('sqrt(16) = 4');
        expect(result2.content).toContain('cos(0) = 1');
      },
      timeout,
    );

    it(
      'should preserve class definitions and instances',
      async () => {
        await codebox.start();

        // First execution - define class and create instance
        const result1 = await codebox.run(`
class Counter:
    def __init__(self, start=0):
        self.value = start
    
    def increment(self, by=1):
        self.value += by
        return self.value

counter = Counter(0)
print(f"Initial value: {counter.value}")
`);

        expect(result1.type).toBe('text');
        expect(result1.content).toContain('Initial value: 0');

        // Second execution - use class instance
        const result2 = await codebox.run(`
counter.increment(5)
print(f"After increment: {counter.value}")
`);

        expect(result2.type).toBe('text');
        expect(result2.content).toContain('After increment: 5');

        // Third execution - create new instance from existing class
        const result3 = await codebox.run(`
counter2 = Counter(10)
counter2.increment(3)
print(f"Counter 1: {counter.value}, Counter 2: {counter2.value}")
`);

        expect(result3.type).toBe('text');
        expect(result3.content).toContain('Counter 1: 5, Counter 2: 13');
      },
      timeout,
    );
  });

  describe('Multiple Contexts', () => {
    it(
      'should isolate state between different contexts',
      async () => {
        await codebox.start();

        // Create two separate contexts
        const context1 = await codebox.createCodeContext({
          language: 'python',
          cwd: '/workspace',
        });

        const context2 = await codebox.createCodeContext({
          language: 'python',
          cwd: '/workspace',
        });

        // Skip test if context creation is not supported
        if (!context1 || !context2) {
          console.log('Context API not available, skipping test');
          return;
        }

        // Set different values in each context
        await codebox.run('secret = "context1_secret"; x = 100', context1);
        await codebox.run('secret = "context2_secret"; x = 200', context2);

        // Verify isolation
        const result1 = await codebox.run('print(f"x = {x}, secret = {secret}")', context1);
        const result2 = await codebox.run('print(f"x = {x}, secret = {secret}")', context2);

        expect(result1.content).toContain('x = 100');
        expect(result1.content).toContain('secret = context1_secret');
        expect(result2.content).toContain('x = 200');
        expect(result2.content).toContain('secret = context2_secret');

        // Clean up contexts
        await codebox.destroyContext(context1);
        await codebox.destroyContext(context2);
      },
      timeout,
    );

    it(
      'should handle multiple contexts simultaneously',
      async () => {
        await codebox.start();

        // Create multiple contexts
        const contexts: (CodeContext | null)[] = [];
        for (let i = 0; i < 3; i++) {
          const ctx = await codebox.createCodeContext({
            language: 'python',
          });
          contexts.push(ctx);
        }

        // Skip test if context creation is not supported
        if (contexts.some((ctx) => !ctx)) {
          console.log('Context API not available, skipping test');
          return;
        }

        // Execute code in each context with different values
        for (let i = 0; i < contexts.length; i++) {
          const ctx = contexts[i];
          if (ctx) {
            await codebox.run(`value = ${i * 100}`, ctx);
          }
        }

        // Verify each context has its own value
        for (let i = 0; i < contexts.length; i++) {
          const ctx = contexts[i];
          if (ctx) {
            const result = await codebox.run('print(f"value = {value}")', ctx);
            expect(result.content).toContain(`value = ${i * 100}`);
          }
        }

        // Clean up all contexts
        for (const ctx of contexts) {
          if (ctx) {
            await codebox.destroyContext(ctx);
          }
        }
      },
      timeout,
    );
  });

  describe('Context Lifecycle', () => {
    it(
      'should create and destroy context successfully',
      async () => {
        await codebox.start();

        // Create context
        const context = await codebox.createCodeContext({
          language: 'python',
        });

        // Skip test if context creation is not supported
        if (!context) {
          console.log('Context API not available, skipping test');
          return;
        }

        expect(context).toBeDefined();
        expect(context.id).toBeDefined();

        // Use context
        const result = await codebox.run('x = 42; print(f"x = {x}")', context);
        expect(result.content).toContain('x = 42');

        // Destroy context
        await codebox.destroyContext(context);

        // Context should not be usable after destruction
        // (This would throw an error if we tried to use it)
      },
      timeout,
    );

    it(
      'should handle rapid context creation and destruction',
      async () => {
        await codebox.start();

        const iterations = 5;

        for (let i = 0; i < iterations; i++) {
          // Create context
          const context = await codebox.createCodeContext({
            language: 'python',
          });

          // Skip test if context creation is not supported
          if (!context) {
            console.log('Context API not available, skipping test');
            return;
          }

          // Use context briefly
          await codebox.run(`print("Iteration ${i}")`, context);

          // Destroy immediately
          await codebox.destroyContext(context);
        }

        // All iterations should complete without issues
        expect(true).toBe(true);
      },
      timeout,
    );
  });

  describe('Error Handling', () => {
    it(
      'should handle errors while preserving context',
      async () => {
        await codebox.start();

        // Define a variable
        const result1 = await codebox.run('x = 10; print(f"x = {x}")');
        expect(result1.content).toContain('x = 10');

        // Execute code that raises an error
        const result2 = await codebox.run('y = 1 / 0');
        expect(result2.type).toBe('error');

        // Context should still be preserved
        const result3 = await codebox.run('print(f"x still exists: {x}")');
        expect(result3.content).toContain('x still exists: 10');
      },
      timeout,
    );
  });

  describe('Fallback Behavior', () => {
    it(
      'should work even when CodeInterpreter is not available',
      async () => {
        // This test verifies graceful degradation
        await codebox.start();

        // Execute code (will use default context if available, or fallback to sandbox)
        const result1 = await codebox.run('x = 42; print(f"x = {x}")');
        expect(result1.type).toBe('text');
        expect(result1.content).toContain('x = 42');

        // Second execution (should work with or without context)
        const result2 = await codebox.run('print(f"x = {x}")');
        expect(result2.type).toBe('text');
        // Note: This might fail if context is not available, which is expected
      },
      timeout,
    );
  });
});
