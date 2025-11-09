/**
 * Example usage of Sandbox agent-tool
 *
 * This example demonstrates how to use the sandbox agent-tool
 * to create sessions and generate responses with code execution.
 */

import { SandboxToolset, SandboxGenerateResponse } from './index';
import { User } from '@refly/openapi-schema';

/**
 * Mock ReflyService for demonstration
 */
const mockReflyService = {
  uploadBase64: async (user: User, param: any) => {
    console.log('Mock upload:', param.filename, user);
    return {
      storageKey: 'mock-storage-key',
      url: 'https://mock-url.com/file.png',
    };
  },
  genImageID: async () => 'mock-image-id',
};

/**
 * Mock user for demonstration
 */
const mockUser: User = {
  uid: 'mock-user-uid',
  email: 'test@example.com',
};

/**
 * Example usage function
 */
async function exampleUsage() {
  console.log('Starting Sandbox Agent-Tool Example...');

  // Create toolset with parameters
  const toolset = new SandboxToolset({
    user: mockUser,
    reflyService: mockReflyService,
  });

  // Initialize tools
  const tools = toolset.initializeTools();
  console.log(
    'Available tools:',
    tools.map((t) => t.name),
  );

  try {
    const generateResponseTool = toolset.getToolInstance(
      'generateResponse',
    ) as SandboxGenerateResponse;

    // Example 1: Simple calculation (creates new session)
    console.log('\n--- Example 1: Simple Calculation ---');
    const calcResult = await generateResponseTool._call({
      message: 'Calculate the sum of numbers from 1 to 100 and show the result',
      options: { verbose: true },
    });
    console.log('Calculation Result:', calcResult);

    const sessionId = calcResult.data?.sessionId;

    // Example 2: Data visualization (reuse session)
    console.log('\n--- Example 2: Data Visualization ---');
    const vizResult = await generateResponseTool._call({
      sessionId,
      message:
        'Create a bar chart showing the values [10, 25, 30, 45, 20] with labels ["A", "B", "C", "D", "E"] and save it as chart.png',
    });
    console.log('Visualization Result:', vizResult);

    // Example 3: File processing with session continuity
    console.log('\n--- Example 3: File Processing ---');
    const csvData = 'name,age,city\nAlice,25,New York\nBob,30,London\nCharlie,35,Tokyo';
    const csvBase64 = Buffer.from(csvData).toString('base64');

    const fileResult = await generateResponseTool._call({
      sessionId,
      message:
        'Analyze the uploaded CSV file and create a summary with statistics. Also compare it with the previous chart data.',
      files: [
        {
          name: 'data.csv',
          content: csvBase64,
        },
      ],
    });
    console.log('File Processing Result:', fileResult);

    // Example 4: Multi-step analysis in same session
    console.log('\n--- Example 4: Multi-step Analysis ---');
    const multiStepResult = await generateResponseTool._call({
      sessionId,
      message:
        'Based on all the data we have analyzed, create a comprehensive report with: 1) Summary statistics 2) Visualizations 3) Key insights',
    });
    console.log('Multi-step Result:', multiStepResult);
  } catch (error) {
    console.error('Error during example execution:', error);
  }
}

// Run the example if this file is executed directly
if (require.main === module) {
  exampleUsage().catch(console.error);
}

export default exampleUsage;
