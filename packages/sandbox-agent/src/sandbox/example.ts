/**
 * CodeBox Adapter Usage Examples
 *
 * This file demonstrates how to use the CodeBox adapter for various
 * code execution scenarios.
 */

import { CodeBox } from './codebox-adapter';

/**
 * Example 1: Basic Code Execution
 * Execute simple Python code and get text output
 */
async function basicCodeExecution() {
  console.log('=== Example 1: Basic Code Execution ===');

  const codebox = new CodeBox({
    apiKey: process.env.SCALEBOX_API_KEY,
  });

  await codebox.start();

  const result = await codebox.run(`
print('Hello from CodeBox!')
x = 10
y = 20
print(f'Sum: {x + y}')
`);

  console.log('Result type:', result.type);
  console.log('Result content:', result.content);

  await codebox.stop();
}

/**
 * Example 2: Data Analysis with Pandas
 * Install packages and perform data analysis
 */
async function dataAnalysis() {
  console.log('\n=== Example 2: Data Analysis ===');

  const codebox = new CodeBox({
    requirements: ['pandas', 'numpy'],
    apiKey: process.env.SCALEBOX_API_KEY,
  });

  await codebox.start();

  // Create sample data
  const csvData = `name,age,city
John,30,New York
Jane,25,Los Angeles
Bob,35,Chicago
Alice,28,Houston`;

  await codebox.upload('data.csv', csvData);

  // Analyze the data
  const result = await codebox.run(`
import pandas as pd
import numpy as np

df = pd.read_csv('data.csv')
print('Data shape:', df.shape)
print('\\nData preview:')
print(df.head())
print('\\nAge statistics:')
print(df['age'].describe())
print('\\nAverage age:', np.mean(df['age']))
`);

  console.log('Analysis result:\n', result.content);

  await codebox.stop();
}

/**
 * Example 3: Visualization with Matplotlib
 * Generate a plot and get the image output
 */
async function visualization() {
  console.log('\n=== Example 3: Visualization ===');

  const codebox = new CodeBox({
    requirements: ['matplotlib', 'numpy'],
    apiKey: process.env.SCALEBOX_API_KEY,
  });

  await codebox.start();

  const result = await codebox.run(`
import matplotlib.pyplot as plt
import numpy as np

# Generate data
x = np.linspace(0, 10, 100)
y1 = np.sin(x)
y2 = np.cos(x)

# Create plot
plt.figure(figsize=(10, 6))
plt.plot(x, y1, label='sin(x)', linewidth=2)
plt.plot(x, y2, label='cos(x)', linewidth=2)
plt.xlabel('X')
plt.ylabel('Y')
plt.title('Trigonometric Functions')
plt.legend()
plt.grid(True)
plt.savefig('trig.png', dpi=100, bbox_inches='tight')
plt.close()

print('Plot generated successfully')
`);

  if (result.type === 'image/png') {
    console.log('Generated PNG image (base64):', `${result.content.substring(0, 100)}...`);
  } else {
    console.log('Result:', result.content);
  }

  await codebox.stop();
}

/**
 * Example 4: Error Handling
 * Demonstrate how errors are handled
 */
async function errorHandling() {
  console.log('\n=== Example 4: Error Handling ===');

  const codebox = new CodeBox({
    apiKey: process.env.SCALEBOX_API_KEY,
  });

  await codebox.start();

  // Intentional error
  const result1 = await codebox.run(`
x = 10
y = 0
result = x / y  # Division by zero
`);

  console.log('Error result type:', result1.type);
  console.log('Error message:', result1.content);

  // Missing module (should auto-install)
  const result2 = await codebox.run(`
import requests
print('Module installed successfully')
`);

  console.log('\nModule installation result:', result2.content);

  await codebox.stop();
}

/**
 * Example 5: File Operations
 * Upload, process, and download files
 */
async function fileOperations() {
  console.log('\n=== Example 5: File Operations ===');

  const codebox = new CodeBox({
    requirements: ['pandas'],
    apiKey: process.env.SCALEBOX_API_KEY,
  });

  await codebox.start();

  // Upload input file
  const inputData = `product,quantity,price
Apple,5,1.5
Banana,10,0.8
Orange,7,1.2`;

  await codebox.upload('sales.csv', inputData);
  console.log('Uploaded sales.csv');

  // Process the data
  await codebox.run(`
import pandas as pd

df = pd.read_csv('sales.csv')
df['total'] = df['quantity'] * df['price']
df.to_csv('sales_with_total.csv', index=False)
print('Processing complete')
`);

  // Download processed file
  const output = await codebox.download('sales_with_total.csv');
  console.log('Downloaded file content:\n', output.content);

  await codebox.stop();
}

/**
 * Example 6: Session Resumption
 * Connect to an existing session
 */
async function sessionResumption() {
  console.log('\n=== Example 6: Session Resumption ===');

  // Create initial session
  const codebox1 = new CodeBox({
    apiKey: process.env.SCALEBOX_API_KEY,
  });

  await codebox1.start();
  const sessionId = codebox1.sessionId;

  console.log('Created session:', sessionId);

  // Set some variables
  await codebox1.run(`
x = 42
y = 'Hello, World!'
data = [1, 2, 3, 4, 5]
`);

  console.log('Variables set in first session');

  // Simulate reconnecting later
  const codebox2 = await CodeBox.fromId(sessionId!, {
    apiKey: process.env.SCALEBOX_API_KEY,
  });

  console.log('Reconnected to session:', sessionId);

  // Access variables from previous session
  const result = await codebox2.run(`
print(f'x = {x}')
print(f'y = {y}')
print(f'data = {data}')
print(f'sum of data = {sum(data)}')
`);

  console.log('Variables from previous session:\n', result.content);

  await codebox2.stop();
}

/**
 * Example 7: Machine Learning
 * Train a simple model with scikit-learn
 */
async function machineLearning() {
  console.log('\n=== Example 7: Machine Learning ===');

  const codebox = new CodeBox({
    requirements: ['scikit-learn', 'numpy'],
    apiKey: process.env.SCALEBOX_API_KEY,
  });

  await codebox.start();

  const result = await codebox.run(`
import numpy as np
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error, r2_score

# Generate sample data
np.random.seed(42)
X = np.random.rand(100, 1) * 10
y = 2.5 * X + np.random.randn(100, 1) * 2

# Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train model
model = LinearRegression()
model.fit(X_train, y_train)

# Make predictions
y_pred = model.predict(X_test)

# Evaluate
mse = mean_squared_error(y_test, y_pred)
r2 = r2_score(y_test, y_pred)

print(f'Coefficient: {model.coef_[0][0]:.2f}')
print(f'Intercept: {model.intercept_[0]:.2f}')
print(f'Mean Squared Error: {mse:.2f}')
print(f'R² Score: {r2:.4f}')
`);

  console.log('ML Results:\n', result.content);

  await codebox.stop();
}

/**
 * Run all examples
 */
async function runAllExamples() {
  try {
    // await basicCodeExecution();
    // await dataAnalysis();
    await visualization();
    // await errorHandling();
    // await fileOperations();
    // await sessionResumption();
    // await machineLearning();

    console.log('\n=== All examples completed successfully ===');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples();
}

export {
  basicCodeExecution,
  dataAnalysis,
  visualization,
  errorHandling,
  fileOperations,
  sessionResumption,
  machineLearning,
};
