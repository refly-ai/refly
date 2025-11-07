# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-11-07

### Added
- Initial release of Sandbox Agent
- TypeScript implementation of code interpreter
- LangChain integration with OpenAI, Azure OpenAI, and Anthropic
- Session management with start/stop capabilities
- File upload and download support
- Python code execution in sandboxed environment
- Automatic package installation on ModuleNotFoundError
- Image generation and handling
- Code logging and tracking
- Customizable system messages
- Support for additional LangChain tools
- Multiple history backend support (in-memory, Redis, PostgreSQL)
- Configuration via environment variables
- Session persistence and restoration
- Comprehensive documentation and examples
- Unit tests for core functionality
- ESLint and Prettier configuration
- TypeScript strict mode support

### Features
- Execute Python code with context preservation
- Handle file uploads and process them
- Generate and download output files
- Track code execution history
- Extensible tool system
- Verbose logging mode
- Error handling and retry logic
- Timeout configuration
- Custom package installation

### Documentation
- README with comprehensive guide
- Quick start guide
- API reference
- Usage examples
- Configuration guide
- Troubleshooting section

## [Unreleased]

### Planned
- Streaming support for real-time responses
- More language support (JavaScript, R, Julia)
- Enhanced error recovery
- Performance optimizations
- Additional example projects
- Web UI for testing
- Docker support
- CI/CD pipeline
- More comprehensive test coverage

