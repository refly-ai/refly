import { CodeInterpreterSession } from '../src/index';
import path from 'node:path';

/**
 * Example usage of CodeInterpreterSession
 */
async function main() {
  // Make sure to set your API key in environment variables
  // OPENAI_API_KEY=your_key or ANTHROPIC_API_KEY=your_key

  console.log('Starting Code Interpreter Session...');

  // Create a new session
  const session = new CodeInterpreterSession({
    verbose: true,
  });

  try {
    // Start the session
    await session.start();
    console.log('Session started successfully!');
    console.log('Session ID:', session.sessionId);

    // // Example 1: Simple calculation
    // console.log('\n--- Example 1: Simple Calculation ---');
    // const response1 = await session.generateResponse(
    //   'Calculate the sum of numbers from 1 to 100'
    // );
    // console.log('Response:', response1.content);

    // Example 2: Data visualization
    console.log('\n--- Example 2: Data Visualization ---');
    const response2 = await session.generateResponse(
      'Create a simple bar chart showing the values [5, 10, 15, 20, 25] and save it as chart.png',
    );
    console.log('Response:', response2.content);
    console.log(
      'Files generated:',
      response2.files.map((f) => f.name),
    );

    for (const file of response2.files) {
      file.save(path.join(__dirname, `./output/${file.name}`));
      console.log(`Saved file: ${file.name}`);
    }

    // // Example 3: Data analysis
    // console.log('\n--- Example 3: Data Analysis ---');
    // const response3 = await session.generateResponse(
    //   'Generate a random dataset of 100 numbers and calculate its mean, median, and standard deviation'
    // );
    // console.log('Response:', response3.content);

    // Example 4: File operations
    // console.log('\n--- Example 4: File Operations ---');
    // const response4 = await session.generateResponse(
    //   'Create a CSV file with sample data containing columns: name, age, city'
    // );
    // console.log('Response:', response4.content);
    // console.log(
    //   'Files generated:',
    //   response4.files.map((f) => f.name)
    // );

    // // Save generated files
    // for (const file of response4.files) {
    //   file.save(path.join(__dirname, `./output/${file.name}`));
    //   console.log(`Saved file: ${file.name}`);
    // }

    // Check if session is still running
    const isRunning = await session.isRunning();
    console.log('\nSession is running:', isRunning);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Stop the session
    console.log('\nStopping session...');
    await session.stop();
    console.log('Session stopped.');
  }
}

// Run the example if this file is executed directly
main().catch(console.error);

export default main;
