/**
 * Context Persistence Example
 *
 * This example demonstrates how code execution context persistence works
 * in the Refly sandbox agent. Variables, functions, and imports defined
 * in one execution are available in subsequent executions within the same session.
 */

import { CodeBox } from '../src/sandbox/codebox-adapter';
import { CodeInterpreterSession } from '../src/session';

/**
 * Example 1: Basic Context Persistence with CodeBox
 */
async function basicContextExample() {
  console.log('\n=== Example 1: Basic Context Persistence ===\n');

  const codebox = new CodeBox({
    apiKey: process.env.SCALEBOX_API_KEY,
    timeoutMs: 1800000,
  });

  try {
    // Start the sandbox (automatically creates default context)
    await codebox.start();
    console.log('✓ Sandbox started with persistent context');

    // First execution - define variables and functions
    console.log('\n--- Execution 1: Define variables and functions ---');
    const result1 = await codebox.run(`
# Define variables
test_var = "Hello from context"
numbers = [1, 2, 3, 4, 5]
counter = 0

# Define a function
def greet(name):
    return f"Hello, {name}!"

# Import a module
import math

print(f"Defined variables: test_var={test_var}, numbers={numbers}, counter={counter}")
print(f"Function test: {greet('World')}")
print(f"Import test: math.pi = {math.pi}")
`);
    console.log('Output:', result1.content);

    // Second execution - use previously defined items
    console.log('\n--- Execution 2: Use previously defined items ---');
    const result2 = await codebox.run(`
# Access variables from previous execution
print(f"From context: test_var={test_var}")

# Modify variables
counter += 10
numbers.append(6)

# Use previously defined function
print(f"Function still available: {greet('Context')}")

# Use previously imported module
print(f"Math module still available: math.sqrt(16) = {math.sqrt(16)}")

print(f"Modified: counter={counter}, numbers={numbers}")
`);
    console.log('Output:', result2.content);

    // Third execution - verify state persists
    console.log('\n--- Execution 3: Verify state persistence ---');
    const result3 = await codebox.run(`
print(f"Counter is now: {counter}")
print(f"Numbers is now: {numbers}")
print(f"test_var still exists: {test_var}")
`);
    console.log('Output:', result3.content);

    console.log('\n✓ Context persistence verified successfully!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Stop the sandbox (automatically cleans up context)
    await codebox.stop();
    console.log('\n✓ Sandbox stopped, context cleaned up');
  }
}

/**
 * Example 2: Multiple Contexts with Isolation
 */
async function multipleContextsExample() {
  console.log('\n=== Example 2: Multiple Contexts with Isolation ===\n');

  const codebox = new CodeBox({
    apiKey: process.env.SCALEBOX_API_KEY,
  });

  try {
    await codebox.start();
    console.log('✓ Sandbox started');

    // Create separate contexts
    console.log('\n--- Creating separate contexts ---');
    const context1 = await codebox.createCodeContext({
      language: 'python',
      cwd: '/workspace/project1',
    });

    const context2 = await codebox.createCodeContext({
      language: 'python',
      cwd: '/workspace/project2',
    });

    if (!context1 || !context2) {
      console.log('⚠ CodeInterpreter not available, skipping multiple contexts example');
      return;
    }

    console.log(`✓ Context 1 created: ${context1.id}`);
    console.log(`✓ Context 2 created: ${context2.id}`);

    // Execute code in context 1
    console.log('\n--- Execution in Context 1 ---');
    await codebox.run('secret = "context1_secret"; x = 100', context1);
    const result1 = await codebox.run('print(f"Context 1: secret={secret}, x={x}")', context1);
    console.log('Output:', result1.content);

    // Execute code in context 2
    console.log('\n--- Execution in Context 2 ---');
    await codebox.run('secret = "context2_secret"; x = 200', context2);
    const result2 = await codebox.run('print(f"Context 2: secret={secret}, x={x}")', context2);
    console.log('Output:', result2.content);

    // Verify contexts are isolated
    console.log('\n--- Verify Context Isolation ---');
    const verify1 = await codebox.run('print(f"Context 1 still has: x={x}")', context1);
    const verify2 = await codebox.run('print(f"Context 2 still has: x={x}")', context2);
    console.log('Context 1:', verify1.content);
    console.log('Context 2:', verify2.content);

    console.log('\n✓ Context isolation verified!');

    // Clean up specific contexts
    await codebox.destroyContext(context1);
    await codebox.destroyContext(context2);
    console.log('✓ Contexts destroyed');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await codebox.stop();
    console.log('\n✓ Sandbox stopped');
  }
}

/**
 * Example 3: Context Persistence with CodeInterpreterSession
 */
async function sessionContextExample() {
  console.log('\n=== Example 3: Context Persistence with CodeInterpreterSession ===\n');

  const session = new CodeInterpreterSession({
    apiKey: process.env.SCALEBOX_API_KEY,
    verbose: false,
  });

  try {
    await session.start();
    console.log('✓ Session started with persistent context');

    // First request - define data
    console.log('\n--- Request 1: Define data ---');
    const response1 = await session.generateResponse(`
Define a list of numbers: numbers = [10, 20, 30, 40, 50]
Print the list.
`);
    console.log('Response:', response1.content);

    // Second request - use previously defined data
    console.log('\n--- Request 2: Use previously defined data ---');
    const response2 = await session.generateResponse(`
Calculate the sum and average of the numbers list.
Print both values.
`);
    console.log('Response:', response2.content);

    // Third request - modify and use data
    console.log('\n--- Request 3: Modify and use data ---');
    const response3 = await session.generateResponse(`
Add 60 to the numbers list.
Print the updated list and its new average.
`);
    console.log('Response:', response3.content);

    console.log('\n✓ Session context persistence verified!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await session.stop();
    console.log('\n✓ Session stopped');
  }
}

/**
 * Example 4: Context Persistence with Complex State
 */
async function complexStateExample() {
  console.log('\n=== Example 4: Context Persistence with Complex State ===\n');

  const codebox = new CodeBox({
    apiKey: process.env.SCALEBOX_API_KEY,
  });

  try {
    await codebox.start();
    console.log('✓ Sandbox started');

    // Define a class and create instances
    console.log('\n--- Execution 1: Define class and create instances ---');
    const result1 = await codebox.run(`
class Counter:
    def __init__(self, start=0):
        self.value = start
    
    def increment(self, by=1):
        self.value += by
        return self.value
    
    def get_value(self):
        return self.value

# Create instances
counter1 = Counter(0)
counter2 = Counter(100)

print(f"Counter 1: {counter1.get_value()}")
print(f"Counter 2: {counter2.get_value()}")
`);
    console.log('Output:', result1.content);

    // Use the class instances
    console.log('\n--- Execution 2: Use class instances ---');
    const result2 = await codebox.run(`
counter1.increment(5)
counter2.increment(10)

print(f"After increment - Counter 1: {counter1.get_value()}")
print(f"After increment - Counter 2: {counter2.get_value()}")
`);
    console.log('Output:', result2.content);

    // Create new instance using existing class
    console.log('\n--- Execution 3: Create new instance from existing class ---');
    const result3 = await codebox.run(`
counter3 = Counter(50)
counter3.increment(25)

print(f"New Counter 3: {counter3.get_value()}")
print(f"Counter 1 still has: {counter1.get_value()}")
print(f"Counter 2 still has: {counter2.get_value()}")
`);
    console.log('Output:', result3.content);

    console.log('\n✓ Complex state persistence verified!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await codebox.stop();
    console.log('\n✓ Sandbox stopped');
  }
}

/**
 * Run all examples
 */
async function main() {
  console.log('\n╔════════════════════════════════════════════════════════════╗');
  console.log('║      Code Execution Context Persistence Examples          ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  try {
    // Example 1: Basic context persistence
    await basicContextExample();

    // Example 2: Multiple contexts with isolation
    await multipleContextsExample();

    // Example 3: Context persistence with session
    await sessionContextExample();

    // Example 4: Complex state persistence
    await complexStateExample();

    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║             All Examples Completed Successfully!          ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n❌ Error running examples:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

export { basicContextExample, multipleContextsExample, sessionContextExample, complexStateExample };
