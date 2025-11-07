# Contributing to Sandbox Agent

Thank you for your interest in contributing to Sandbox Agent! This document provides guidelines and instructions for contributing.

## Code of Conduct

Please be respectful and considerate in your interactions with other contributors.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- **Clear title and description**
- **Steps to reproduce** the issue
- **Expected behavior** vs **actual behavior**
- **Environment details** (Node.js version, OS, etc.)
- **Code samples** if applicable
- **Error messages** and stack traces

### Suggesting Enhancements

Enhancement suggestions are welcome! Please provide:

- **Clear use case** for the enhancement
- **Expected behavior** with the enhancement
- **Code examples** showing how it would work
- **Alternatives considered**

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding style** used in the project
3. **Write tests** for your changes
4. **Update documentation** as needed
5. **Ensure tests pass** before submitting
6. **Write clear commit messages**

## Development Setup

### Prerequisites

- Node.js >= 18.0.0
- npm, yarn, or pnpm
- Git

### Setup Steps

1. **Clone your fork:**
```bash
git clone https://github.com/your-username/sandbox-agent.git
cd sandbox-agent
```

2. **Install dependencies:**
```bash
npm install
```

3. **Set up environment:**
```bash
cp env.example .env
# Add your API keys to .env
```

4. **Run tests:**
```bash
npm test
```

5. **Build the project:**
```bash
npm run build
```

## Coding Standards

### TypeScript

- Use **TypeScript strict mode**
- Add **type annotations** for function parameters and return types
- Avoid `any` types when possible
- Use **interfaces** for object shapes
- Use **enums** for fixed sets of values

### Style Guide

- Use **single quotes** for strings
- Use **2 spaces** for indentation
- Add **semicolons** at the end of statements
- Use **trailing commas** in objects and arrays
- Keep lines under **100 characters**
- Use **camelCase** for variables and functions
- Use **PascalCase** for classes and types

### Comments

- Write comments in **English**
- Add **JSDoc comments** for public APIs
- Explain **why**, not what the code does
- Keep comments **up to date** with code changes

### Example:

```typescript
/**
 * Generate a response from the code interpreter
 * 
 * @param userMsg - The user's message
 * @param files - Optional files to upload
 * @returns A promise that resolves to the interpreter response
 */
async generateResponse(
  userMsg: string,
  files: File[] = []
): Promise<CodeInterpreterResponse> {
  // Implementation
}
```

## Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm test -- --watch

# Run tests with coverage
npm test -- --coverage
```

### Writing Tests

- Write tests for **new features**
- Write tests for **bug fixes**
- Use **descriptive test names**
- Follow **AAA pattern** (Arrange, Act, Assert)
- Mock external dependencies

### Example Test:

```typescript
describe('CodeInterpreterSession', () => {
  it('should start a new session', async () => {
    // Arrange
    const session = new CodeInterpreterSession();
    
    // Act
    await session.start();
    
    // Assert
    expect(session.sessionId).toBeDefined();
    expect(await session.isRunning()).toBe(true);
  });
});
```

## Commit Messages

Use clear and descriptive commit messages:

```
feat: add support for streaming responses
fix: resolve timeout issue in code execution
docs: update README with new examples
test: add tests for file upload feature
refactor: simplify session initialization
style: format code with prettier
chore: update dependencies
```

### Format:

```
<type>: <subject>

<body (optional)>

<footer (optional)>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Test changes
- `chore`: Build process or auxiliary tool changes

## Documentation

### Code Documentation

- Add **JSDoc comments** to all public APIs
- Include **examples** in documentation
- Document **parameters** and **return values**
- Mention **side effects** if any

### README Updates

When adding features, update:
- **API Reference** section
- **Usage Examples** section
- **Configuration** section if needed

## Pull Request Process

1. **Update documentation** for any changed functionality
2. **Add tests** for new features or bug fixes
3. **Ensure all tests pass**: `npm test`
4. **Lint your code**: `npm run lint`
5. **Format your code**: `npm run format`
6. **Update CHANGELOG.md** with your changes
7. **Create a pull request** with a clear description

### PR Description Template:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe the tests you ran

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added where needed
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] CHANGELOG.md updated
```

## Questions?

Feel free to open an issue for any questions or concerns.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Sandbox Agent! 🎉

