# Quick Start Guide

Get up and running with Sandbox Agent in 5 minutes!

## Prerequisites

- Node.js >= 18.0.0
- npm, yarn, or pnpm
- An OpenAI API key (or Anthropic API key)

## Step 1: Install Dependencies

```bash
npm install
```

## Step 2: Set Up Environment

Create a `.env` file in the root directory:

```bash
cp env.example .env
```

Edit `.env` and add your API key:

```env
OPENAI_API_KEY=sk-your-api-key-here
```

## Step 3: Run the Example

```bash
npx tsx example.ts
```

## Step 4: Try It Yourself

Create a new file `my-test.ts`:

```typescript
import { CodeInterpreterSession } from './session';

async function quickTest() {
  const session = new CodeInterpreterSession({ verbose: true });
  
  try {
    await session.start();
    
    const response = await session.generateResponse(
      'Write a Python script to generate the Fibonacci sequence up to 10 numbers'
    );
    
    console.log('\n=== Response ===');
    console.log(response.content);
    
    if (response.codeLog.length > 0) {
      console.log('\n=== Code Executed ===');
      response.codeLog.forEach(([code, output]) => {
        console.log('Code:', code);
        console.log('Output:', output);
      });
    }
  } finally {
    await session.stop();
  }
}

quickTest();
```

Run it:

```bash
npx tsx my-test.ts
```

## Common Use Cases

### 1. Data Analysis

```typescript
const response = await session.generateResponse(
  'Load this CSV, calculate statistics, and create a histogram',
  [File.fromPath('./data.csv')]
);
```

### 2. Create Visualizations

```typescript
const response = await session.generateResponse(
  'Create a line chart of sine wave from 0 to 2π'
);

// Save the generated image
response.files.forEach(file => {
  file.save(`./output/${file.name}`);
});
```

### 3. File Processing

```typescript
const response = await session.generateResponse(
  'Convert this JSON file to CSV format',
  [File.fromPath('./data.json')]
);
```

## Troubleshooting

### Error: API key not found

Make sure you've set `OPENAI_API_KEY` in your `.env` file.

### Error: Cannot find module 'codeboxapi'

The `codeboxapi` package is a placeholder. You'll need to implement or use an actual code execution sandbox. Consider:
- E2B (https://e2b.dev)
- CodeBox API
- Your own Docker-based sandbox

### Timeout errors

Increase the timeout in `.env`:

```env
REQUEST_TIMEOUT=300
```

## Next Steps

- Read the full [README.md](./README.md) for detailed documentation
- Explore more examples in [example.ts](./example.ts)
- Check out the API reference in the README
- Customize the system message in `config.ts`

## Need Help?

- Check the documentation in README.md
- Open an issue on GitHub
- Review the example files

Happy coding! 🚀

