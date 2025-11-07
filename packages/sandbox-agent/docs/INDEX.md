# Sandbox Agent - Documentation Index

Welcome to Sandbox Agent! This index helps you navigate the documentation and get started quickly.

## 🚀 Getting Started

**New to Sandbox Agent?** Start here:

1. **[QUICKSTART.md](./QUICKSTART.md)** - Get running in 5 minutes
2. **[SETUP.md](./SETUP.md)** - Detailed setup instructions
3. **[example.ts](./example.ts)** - See it in action

## 📚 Documentation Files

### Core Documentation

| File | Purpose | When to Read |
|------|---------|--------------|
| **[README.md](./README.md)** | Complete project documentation | Full understanding needed |
| **[QUICKSTART.md](./QUICKSTART.md)** | 5-minute getting started guide | First time setup |
| **[SETUP.md](./SETUP.md)** | Detailed setup instructions | Installation help needed |
| **[PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)** | Project overview and completion status | Understanding project scope |

### Development Documentation

| File | Purpose | When to Read |
|------|---------|--------------|
| **[CONTRIBUTING.md](./CONTRIBUTING.md)** | How to contribute | Planning to contribute |
| **[CHANGELOG.md](./CHANGELOG.md)** | Version history | Checking what's new |
| **[LICENSE](./LICENSE)** | MIT license terms | Legal/licensing questions |

## 📂 Project Structure

### Core Implementation Files

```
session.ts       - Main CodeInterpreterSession class
schema.ts        - Type definitions (File, UserRequest, Response, etc.)
config.ts        - Configuration and settings
chains.ts        - Utility functions and helpers
index.ts         - Public API exports
```

### Configuration Files

```
package.json      - Dependencies and scripts
tsconfig.json     - TypeScript configuration
jest.config.js    - Test configuration
.eslintrc.json    - Linting rules
.prettierrc       - Code formatting rules
env.example       - Environment variables template
```

### Examples and Tests

```
example.ts        - Usage examples
__tests__/        - Test files
  ├── schema.test.ts
  └── chains.test.ts
```

### Development Tools

```
.vscode/          - VS Code settings
  ├── settings.json
  └── launch.json
.gitignore        - Git ignore rules
verify-setup.sh   - Setup verification script
```

## 🎯 Use Case Guide

### What do you want to do?

#### "I want to try it out quickly"
→ Read: [QUICKSTART.md](./QUICKSTART.md)  
→ Run: `npx tsx example.ts`

#### "I want to understand the full setup"
→ Read: [SETUP.md](./SETUP.md)  
→ Follow: Step-by-step installation

#### "I want to use it in my project"
→ Read: [README.md](./README.md) → Usage section  
→ See: [example.ts](./example.ts) for patterns

#### "I want to understand how it works"
→ Read: [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)  
→ Review: Core implementation files

#### "I want to contribute"
→ Read: [CONTRIBUTING.md](./CONTRIBUTING.md)  
→ Follow: Development workflow

#### "I'm having issues"
→ Read: [SETUP.md](./SETUP.md) → Troubleshooting  
→ Run: `./verify-setup.sh`  
→ Check: Common issues below

## 💡 Common Tasks

### Initial Setup

```bash
# 1. Verify setup
./verify-setup.sh

# 2. Install dependencies
npm install

# 3. Configure environment
cp env.example .env
# Edit .env to add API key

# 4. Run example
npx tsx example.ts
```

### Development Workflow

```bash
# Run in development mode
npm run dev

# Run tests
npm test

# Lint code
npm run lint

# Format code
npm run format

# Build project
npm run build
```

### Verification Checklist

- [ ] Node.js >= 18.0.0 installed
- [ ] Dependencies installed (`npm install`)
- [ ] `.env` file created with API key
- [ ] Example runs successfully
- [ ] Tests pass (`npm test`)

## 🔍 API Quick Reference

### Create a Session

```typescript
import { CodeInterpreterSession } from './index';

const session = new CodeInterpreterSession({
  verbose: true,
});
```

### Generate Response

```typescript
await session.start();

const response = await session.generateResponse(
  'Your prompt here'
);

await session.stop();
```

### Upload Files

```typescript
import { File } from './index';

const file = File.fromPath('./data.csv');
const response = await session.generateResponse(
  'Analyze this file',
  [file]
);
```

### Access Results

```typescript
console.log(response.content);    // AI response text
console.log(response.files);       // Generated files
console.log(response.codeLog);     // Executed code
```

## 📖 Learning Path

### For Beginners

1. Read [QUICKSTART.md](./QUICKSTART.md)
2. Run [example.ts](./example.ts)
3. Modify example to experiment
4. Read [README.md](./README.md) API section

### For Developers

1. Read [SETUP.md](./SETUP.md)
2. Review [schema.ts](./schema.ts) for types
3. Study [session.ts](./session.ts) implementation
4. Read [CONTRIBUTING.md](./CONTRIBUTING.md)

### For Contributors

1. Complete developer path above
2. Read [CONTRIBUTING.md](./CONTRIBUTING.md)
3. Review [PROJECT_SUMMARY.md](./PROJECT_SUMMARY.md)
4. Check open issues on GitHub

## 🐛 Troubleshooting Quick Links

### Common Issues

| Issue | Solution | Details |
|-------|----------|---------|
| "Cannot find module" | Run `npm install` | [SETUP.md](./SETUP.md) → Troubleshooting |
| "API key not found" | Check `.env` file | [QUICKSTART.md](./QUICKSTART.md) → Step 2 |
| TypeScript errors | Check version | [SETUP.md](./SETUP.md) → Prerequisites |
| Tests failing | Clear cache | [SETUP.md](./SETUP.md) → Testing |
| Timeout errors | Increase timeout | [README.md](./README.md) → Configuration |

### Getting Help

1. **Run verification**: `./verify-setup.sh`
2. **Check docs**: Review relevant documentation file
3. **Search issues**: Look for similar problems
4. **Ask for help**: Open a GitHub issue

## 📊 Quick Stats

- **Total Files**: 24+
- **Core TypeScript**: ~600 lines
- **Documentation**: ~1500 lines
- **Test Coverage**: Schema and utilities
- **Dependencies**: 8 runtime, 10+ dev

## 🔗 Important Links

### Documentation
- [README.md](./README.md) - Main documentation
- [QUICKSTART.md](./QUICKSTART.md) - Quick start
- [SETUP.md](./SETUP.md) - Setup guide
- [API Reference](./README.md#api-reference) - In README

### Code
- [session.ts](./session.ts) - Main implementation
- [schema.ts](./schema.ts) - Type definitions
- [example.ts](./example.ts) - Usage examples
- [index.ts](./index.ts) - Public exports

### Development
- [CONTRIBUTING.md](./CONTRIBUTING.md) - How to contribute
- [package.json](./package.json) - Dependencies
- [tsconfig.json](./tsconfig.json) - TS config

## 🎓 External Resources

### Technologies Used
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [LangChain JS Documentation](https://js.langchain.com/docs/)
- [OpenAI API Documentation](https://platform.openai.com/docs/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)

### Related Projects
- [Python codeinterpreter-api](https://github.com/shroominic/codeinterpreter-api)
- [E2B Code Interpreter](https://e2b.dev)
- [LangChain](https://github.com/langchain-ai/langchainjs)

## ✅ Next Steps

Based on your needs, choose your path:

**Path 1: Quick Trial**
1. [QUICKSTART.md](./QUICKSTART.md)
2. Run `npx tsx example.ts`
3. Modify and experiment

**Path 2: Serious Development**
1. [SETUP.md](./SETUP.md)
2. [README.md](./README.md)
3. Build your application

**Path 3: Contributing**
1. [SETUP.md](./SETUP.md)
2. [CONTRIBUTING.md](./CONTRIBUTING.md)
3. Start coding!

---

**Need help?** Start with [QUICKSTART.md](./QUICKSTART.md) or run `./verify-setup.sh`

**Ready to code?** See [example.ts](./example.ts) for usage patterns

**Want to contribute?** Read [CONTRIBUTING.md](./CONTRIBUTING.md)

---

*Last updated: 2024-11-07*

