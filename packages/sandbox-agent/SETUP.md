# Setup Guide for Sandbox Agent

Complete setup instructions for getting the Sandbox Agent project up and running.

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Installation](#installation)
3. [Configuration](#configuration)
4. [Building the Project](#building-the-project)
5. [Running Examples](#running-examples)
6. [Development Workflow](#development-workflow)
7. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required

- **Node.js**: Version 18.0.0 or higher
  ```bash
  node --version  # Should be >= 18.0.0
  ```

- **Package Manager**: npm (comes with Node.js), yarn, or pnpm
  ```bash
  npm --version
  # or
  yarn --version
  # or
  pnpm --version
  ```

- **API Keys**: At least one of the following:
  - OpenAI API Key (recommended)
  - Anthropic API Key
  - Azure OpenAI credentials

### Recommended

- **Git**: For version control
- **VS Code**: With recommended extensions:
  - ESLint
  - Prettier
  - TypeScript

## Installation

### Step 1: Clone or Navigate to the Project

```bash
cd /Users/pftom/Projects/workflow-agents/code-interpreter/sandbox-agent
```

### Step 2: Install Dependencies

Choose your preferred package manager:

#### Using npm (default):
```bash
npm install
```

#### Using pnpm (faster):
```bash
pnpm install
```

#### Using yarn:
```bash
yarn install
```

### Step 3: Verify Installation

Check that all dependencies installed correctly:

```bash
npm list --depth=0
```

You should see packages like:
- `@langchain/core`
- `@langchain/openai`
- `langchain`
- `typescript`
- etc.

## Configuration

### Step 1: Create Environment File

Copy the example environment file:

```bash
cp env.example .env
```

### Step 2: Add Your API Keys

Edit the `.env` file and add your credentials:

#### For OpenAI:
```env
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxx
MODEL=gpt-4o
```

#### For Anthropic:
```env
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxx
MODEL=claude-3-sonnet-20240229
```

#### For Azure OpenAI:
```env
AZURE_OPENAI_API_KEY=your_azure_key
AZURE_API_BASE=https://your-resource.openai.azure.com
AZURE_API_VERSION=2023-05-15
AZURE_DEPLOYMENT_NAME=your_deployment_name
MODEL=gpt-4o
```

### Step 3: Customize Settings (Optional)

Adjust other settings in `.env`:

```env
# Enable debug logging
DEBUG=true

# Increase timeout for long-running operations
REQUEST_TIMEOUT=300

# Set maximum iterations
MAX_ITERATIONS=20

# Add custom Python packages (comma-separated)
CUSTOM_PACKAGES=pandas,numpy,matplotlib,seaborn
```

## Building the Project

### Compile TypeScript

```bash
npm run build
```

This will:
- Compile TypeScript files to JavaScript
- Generate type definitions (`.d.ts`)
- Output to the `dist/` directory

### Verify Build

Check that the `dist/` directory was created:

```bash
ls -la dist/
```

## Running Examples

### Quick Test

Run the included example:

```bash
npx tsx example.ts
```

Or if you've built the project:

```bash
node dist/example.js
```

### Run in Development Mode

For hot-reload during development:

```bash
npm run dev
```

### Create Your Own Script

Create a new file `test.ts`:

```typescript
import { CodeInterpreterSession } from './index';

async function myTest() {
  const session = new CodeInterpreterSession({ verbose: true });
  
  try {
    await session.start();
    console.log('Session started!');
    
    const response = await session.generateResponse(
      'Calculate 2 + 2 and explain the result'
    );
    
    console.log('Response:', response.content);
  } finally {
    await session.stop();
  }
}

myTest();
```

Run it:

```bash
npx tsx test.ts
```

## Development Workflow

### 1. Code Formatting

Format your code:

```bash
npm run format
```

### 2. Linting

Check for code issues:

```bash
npm run lint
```

Fix auto-fixable issues:

```bash
npm run lint -- --fix
```

### 3. Running Tests

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm test -- --watch
```

Run tests with coverage:

```bash
npm test -- --coverage
```

### 4. Development Cycle

1. Make changes to TypeScript files
2. Run tests: `npm test`
3. Run lint: `npm run lint`
4. Format code: `npm run format`
5. Build: `npm run build`
6. Test the build: `node dist/example.js`

### 5. VS Code Integration

If using VS Code:

1. **Auto-format on save**: Already configured in `.vscode/settings.json`
2. **Debugging**: Use F5 to start debugging
3. **Run Example**: Select "Run Example" from the debug menu
4. **Run Tests**: Select "Run Tests" from the debug menu

## Project Structure Overview

```
sandbox-agent/
├── session.ts              # Main session implementation
├── schema.ts               # Type definitions
├── config.ts               # Configuration
├── chains.ts               # Utility functions
├── index.ts                # Public API exports
├── example.ts              # Usage examples
├── package.json            # Dependencies
├── tsconfig.json           # TypeScript config
├── jest.config.js          # Test configuration
├── .eslintrc.json          # ESLint rules
├── .prettierrc             # Prettier config
├── __tests__/              # Test files
│   ├── schema.test.ts
│   └── chains.test.ts
├── .vscode/                # VS Code settings
│   ├── settings.json
│   └── launch.json
├── dist/                   # Compiled output (after build)
└── node_modules/           # Dependencies
```

## Troubleshooting

### Issue: "Cannot find module 'xxx'"

**Solution**: Install dependencies

```bash
rm -rf node_modules package-lock.json
npm install
```

### Issue: TypeScript compilation errors

**Solution**: Check TypeScript version

```bash
npx tsc --version  # Should be >= 5.4.0
```

Reinstall TypeScript:

```bash
npm install --save-dev typescript@latest
```

### Issue: "API key not found" error

**Solution**: Verify `.env` file

```bash
# Check if .env exists
ls -la .env

# View contents (be careful not to share this!)
cat .env
```

Make sure your API key is set correctly without extra spaces:

```env
OPENAI_API_KEY=sk-your-key-here
```

### Issue: Module resolution errors

**Solution**: Clear TypeScript cache

```bash
rm -rf dist/
rm -rf node_modules/
npm install
npm run build
```

### Issue: Tests failing

**Solution**: Check Jest configuration

```bash
# Run tests with verbose output
npm test -- --verbose

# Clear Jest cache
npx jest --clearCache
npm test
```

### Issue: Port or network errors

**Solution**: Check firewall and network settings

If using CodeBox API or E2B, ensure you have network access and correct API keys.

### Issue: Timeout errors

**Solution**: Increase timeout in `.env`

```env
REQUEST_TIMEOUT=600  # 10 minutes
```

Or in your code:

```typescript
const session = new CodeInterpreterSession({
  verbose: true,
  requestTimeout: 600,
});
```

## Next Steps

1. ✅ Read [QUICKSTART.md](./QUICKSTART.md) for quick examples
2. ✅ Read [README.md](./README.md) for detailed documentation
3. ✅ Explore [example.ts](./example.ts) for usage patterns
4. ✅ Read [CONTRIBUTING.md](./CONTRIBUTING.md) if you want to contribute
5. ✅ Check [CHANGELOG.md](./CHANGELOG.md) for version history

## Getting Help

- 📖 Check the documentation first
- 🐛 Search existing GitHub issues
- 💬 Open a new issue with details
- 📧 Contact the maintainers

## Useful Commands Reference

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format

# Run example
npx tsx example.ts

# Clean build
rm -rf dist/ && npm run build
```

---

**Happy coding!** 🚀

If you encounter any issues not covered here, please open an issue on GitHub.

