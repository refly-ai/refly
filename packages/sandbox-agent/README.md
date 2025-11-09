# Sandbox Agent

A TypeScript implementation of a code interpreter with LangChain integration. This project is a TypeScript port of the Python `codeinterpreter-api` library.

## Features

- 🐍 Execute Python code in a sandboxed environment
- 🤖 Integrate with LiteLLM, OpenAI, Azure OpenAI, or Anthropic LLMs
- 🌐 **LiteLLM Support**: Access 100+ AI models through a unified OpenAI-compatible API
- 📊 Generate visualizations and data analysis
- 📁 Handle file uploads and downloads
- 🔄 Maintain conversation context across multiple interactions
- 🛠️ Extensible with custom tools
- 💾 Support for multiple history backends (in-memory, Redis, PostgreSQL)

## Requirements

- Node.js >= 18.0.0
- LangChain >= 0.3.0 (for modern tool calling API)

## Installation

```bash
npm install
```

Or if you're using pnpm:

```bash
pnpm install
```

Or with yarn:

```bash
yarn install
```

> **Note**: This project uses LangChain v0.3.x which includes support for the modern `tools` API (replacing the deprecated `functions` API).

## Configuration

1. Copy the `env.example` file to `.env`:

```bash
cp env.example .env
```

2. Configure your environment variables in `.env`:

```env
# Recommended: Use LiteLLM for access to 100+ models
OPENAI_API_KEY=your_litellm_api_key_here
OPENAI_BASE_URL=https://litellm.powerformer.net/v1
MODEL=gpt-4-turbo

# Or use direct OpenAI
# OPENAI_API_KEY=your_openai_api_key_here
# MODEL=gpt-4o

# Optional: Customize settings
TEMPERATURE=0.03
DEBUG=false
```

> **Note**: LiteLLM is now the recommended provider. It provides a unified OpenAI-compatible API for 100+ LLM models from different providers.

### Environment Variables

| Variable            | Description                                               | Default         |
| ------------------- | --------------------------------------------------------- | --------------- |
| `OPENAI_API_KEY`    | OpenAI or LiteLLM API key (recommended)                   | -               |
| `OPENAI_BASE_URL`   | Custom base URL for LiteLLM or OpenAI-compatible services | -               |
| `ANTHROPIC_API_KEY` | Anthropic API key                                         | -               |
| `MODEL`             | LLM model to use                                          | `gpt-4o` |
| `TEMPERATURE`       | LLM temperature                                           | `0.03`          |
| `DEBUG`             | Enable debug mode                                         | `false`         |
| `MAX_ITERATIONS`    | Maximum agent iterations                                  | `12`            |
| `MAX_RETRY`         | Maximum retry attempts                                    | `3`             |
| `REQUEST_TIMEOUT`   | Request timeout in seconds                                | `300`           |
| `CUSTOM_PACKAGES`   | Comma-separated Python packages                           | `[]`            |

**LLM Provider Priority**: The session selects providers in this order:

1. Azure OpenAI (if Azure credentials are configured)
2. OpenAI-compatible API (if `OPENAI_API_KEY` is set) - supports LiteLLM, OpenAI direct, and other OpenAI-compatible services
3. Anthropic (if `ANTHROPIC_API_KEY` is set)

## Usage

### Basic Example

```typescript
import { CodeInterpreterSession } from 'sandbox-agent';

async function main() {
  // Create a new session
  const session = new CodeInterpreterSession({
    verbose: true,
  });

  try {
    // Start the session
    await session.start();
    console.log('Session started:', session.sessionId);

    // Generate a response
    const response = await session.generateResponse('Calculate the sum of numbers from 1 to 100');
    console.log('Response:', response.content);
  } finally {
    // Always stop the session when done
    await session.stop();
  }
}

main().catch(console.error);
```

### Advanced Example with File Handling

```typescript
import { CodeInterpreterSession, File } from 'sandbox-agent';

async function analyzeData() {
  const session = new CodeInterpreterSession();

  try {
    await session.start();

    // Upload a CSV file
    const csvFile = File.fromPath('./data.csv');

    // Generate response with file
    const response = await session.generateResponse(
      'Analyze this CSV file and create a visualization',
      [csvFile]
    );

    console.log('Analysis:', response.content);

    // Save generated files
    for (const file of response.files) {
      file.save(`./output/${file.name}`);
      console.log('Saved:', file.name);
    }
  } finally {
    await session.stop();
  }
}

analyzeData().catch(console.error);
```

### Using Custom Tools

```typescript
import { CodeInterpreterSession } from 'sandbox-agent';
import { DynamicStructuredTool } from '@langchain/core/tools';
import { z } from 'zod';

// Create a custom tool
const customTool = new DynamicStructuredTool({
  name: 'search_database',
  description: 'Search the database for information',
  schema: z.object({
    query: z.string().describe('Search query'),
  }),
  func: async ({ query }) => {
    // Your custom logic here
    return `Found results for: ${query}`;
  },
});

// Create session with custom tools
const session = new CodeInterpreterSession({
  additionalTools: [customTool],
  verbose: true,
});
```

### Session Persistence

```typescript
import { CodeInterpreterSession } from 'sandbox-agent';

// Create and save session ID
const session1 = new CodeInterpreterSession();
await session1.start();
const sessionId = session1.sessionId;
console.log('Session ID:', sessionId);

// Later, restore the session
const session2 = await CodeInterpreterSession.fromId(sessionId!);
const response = await session2.generateResponse('Continue our conversation');
```

## API Reference

### CodeInterpreterSession

Main class for managing code interpreter sessions.

#### Constructor Options

```typescript
interface CodeInterpreterSessionOptions {
  llm?: BaseChatModel; // Custom LLM instance
  additionalTools?: BaseTool[]; // Additional LangChain tools
  callbacks?: any[]; // LangChain callbacks
  verbose?: boolean; // Enable verbose logging
}
```

#### Methods

- `start()`: Start the session
- `stop()`: Stop the session
- `generateResponse(userMsg: string, files?: File[])`: Generate a response
- `isRunning()`: Check if session is running
- `static fromId(sessionId: string)`: Restore session from ID

### File

Class for handling file operations.

#### Methods

- `static fromPath(path: string)`: Create from file path
- `static fromUrl(url: string)`: Create from URL
- `save(path: string)`: Save file to disk

### Schema Types

- `CodeInput`: Code input schema
- `UserRequest`: User request with optional files
- `CodeInterpreterResponse`: Response with content, files, and code log
- `SessionStatus`: Session status information

## Development

### Build

```bash
npm run build
```

### Run Examples

Run the basic example:

```bash
npm run run-example
```

Or run specific examples:

```bash
npx tsx examples/example.ts
npx tsx examples/example-full-chain.ts
npx tsx examples/example-openrouter.ts
```

### Linting

```bash
npm run lint
```

### Format Code

```bash
npm run format
```

## Project Structure

```
sandbox-agent/
├── src/                           # Source code
│   ├── session.ts                 # Main session implementation
│   ├── schema.ts                  # Type definitions and schemas
│   ├── config.ts                  # Configuration and settings
│   ├── chains.ts                  # Utility functions and chains
│   ├── index.ts                   # Main exports
│   ├── test-prompts.ts            # Prompts testing suite
│   ├── prompts/                   # Prompt templates
│   │   ├── system-message.ts      # System message
│   │   ├── modifications-check.ts # File modification detection
│   │   ├── remove-dl-link.ts      # Download link removal
│   │   ├── index.ts               # Prompts exports
│   │   └── README.md              # Prompts documentation
│   └── sandbox/                   # Sandbox adapter implementation
│       ├── codebox-adapter.ts     # CodeBox API adapter
│       ├── types.ts               # Sandbox type definitions
│       ├── index.ts               # Sandbox exports
│       ├── example.ts             # Sandbox usage example
│       ├── README.md              # Sandbox documentation
│       ├── ARCHITECTURE.md        # Architecture overview
│       ├── MIGRATION.md           # Migration guide
│       ├── API_COMPARISON.md      # API comparison
│       ├── CHANGELOG.md           # Sandbox changelog
│       └── CHECKLIST.md           # Implementation checklist
├── examples/                      # Usage examples
│   ├── example.ts                 # Basic usage example
│   ├── example-full-chain.ts      # Full chain example
│   ├── example-openrouter.ts      # OpenRouter integration example
│   └── output/                    # Example output files
├── evaluation-cases/              # Evaluation and testing
│   ├── evaluation-runner.ts       # Evaluation runner
│   ├── analyze-results.ts         # Results analysis
│   ├── generate-test-data.ts      # Test data generation
│   ├── use-cases.md               # Use cases documentation
│   ├── README.md                  # Evaluation documentation
│   ├── SUMMARY.md                 # Evaluation summary
│   └── MCP_CODE_EXECUTION.md      # MCP code execution guide
├── docs/                          # Documentation
│   ├── QUICKSTART.md              # Quick start guide
│   ├── PROJECT_SUMMARY.md         # Project overview
│   ├── LLM_PROVIDERS.md           # LLM providers guide
│   ├── LITELLM_MIGRATION.md       # LiteLLM migration guide
│   ├── OPENROUTER.md              # OpenRouter setup
│   ├── UPGRADE_GUIDE.md           # Upgrade guide
│   ├── SANDBOX_OPTIMIZATION_SUMMARY.md # Sandbox optimization
│   ├── FIX_SUMMARY.md             # Bug fix summary
│   ├── QUICK_FIX.md               # Quick fixes
│   ├── INDEX.md                   # Documentation index
│   ├── BUGFIX_FUNCTIONS_DEPRECATED.md # Functions deprecation fix
│   ├── BUGFIX_PROMPT_VARIABLES.md # Prompt variables fix
│   ├── BUGFIX_TIMEOUT.md          # Timeout fix
│   └── CHANGELOG_OPENROUTER.md    # OpenRouter changelog
├── __tests__/                     # Test files
│   ├── schema.test.ts             # Schema tests
│   └── chains.test.ts             # Chains tests
├── package.json                   # Dependencies and scripts
├── tsconfig.json                  # TypeScript configuration
├── jest.config.js                 # Jest configuration
├── env.example                    # Environment variables example
├── .gitignore                     # Git ignore rules
├── LICENSE                        # MIT License
├── README.md                      # This file
├── SETUP.md                       # Setup guide
├── CONTRIBUTING.md                # Contributing guidelines
├── CHANGELOG.md                   # Project changelog
└── verify-setup.sh                # Setup verification script
```

## Requirements

- Node.js >= 18.0.0
- TypeScript >= 5.4.0

## Dependencies

### Runtime Dependencies

- `@langchain/core`: LangChain core functionality
- `@langchain/openai`: OpenAI integration
- `@langchain/anthropic`: Anthropic integration
- `langchain`: LangChain library
- `codeboxapi`: Code execution sandbox (legacy)
- `@scalebox/sdk`: Scalebox SDK for code execution
- `uuid`: UUID generation
- `zod`: Schema validation
- `axios`: HTTP client
- `dotenv`: Environment variable management

### Development Dependencies

- `typescript`: TypeScript compiler
- `tsx`: TypeScript execution
- `eslint`: Code linting
- `prettier`: Code formatting
- `jest`: Testing framework
- `ts-jest`: Jest TypeScript preprocessor
- `@typescript-eslint/eslint-plugin`: TypeScript ESLint plugin
- `@typescript-eslint/parser`: TypeScript ESLint parser

## License

MIT

## Credits

This project is a TypeScript port of the Python [codeinterpreter-api](https://github.com/shroominic/codeinterpreter-api) library.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## Documentation

For more detailed information, please refer to:

- [Quick Start Guide](docs/QUICKSTART.md) - Get started quickly
- [Project Summary](docs/PROJECT_SUMMARY.md) - Project overview
- [LLM Providers Guide](docs/LLM_PROVIDERS.md) - Configure different LLM providers
- [LiteLLM Migration](docs/LITELLM_MIGRATION.md) - Migrate to LiteLLM
- [Upgrade Guide](docs/UPGRADE_GUIDE.md) - Upgrade from older versions
- [Sandbox Architecture](src/sandbox/ARCHITECTURE.md) - Sandbox implementation details
- [Evaluation Cases](evaluation-cases/README.md) - Test cases and evaluations

## Support

For issues and questions, please open an issue on GitHub.
