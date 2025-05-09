# Refly.AI Documentation

This repository contains the official documentation for [Refly.AI](https://refly.ai), an AI-native content creation platform built on the concept of "Free Canvas". The documentation site is built using [VitePress](https://vitepress.dev/), a static site generator powered by Vue.

## About Refly

Refly is a platform that enables users to:

- Engage in multi-topic & multi-threaded conversations on a free canvas
- Integrate writing materials and AI knowledge base for a powerful second brain system
- Utilize context memory functionality for precise modifications
- Access built-in AI web search and knowledge base retrieval
- Seamlessly create content with an integrated Notion-style AI editor

## Local Development

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or higher)
- [pnpm](https://pnpm.io/) (v8.15.8 or higher)

### Setup and Run

1. Clone this repository
   ```bash
   git clone https://github.com/refly-ai/refly-docs.git
   cd refly-docs
   ```

> 💡 If you want to contribute to the documentation, please **fork** this repository and clone your forked repo instead.

2. Install dependencies
   ```bash
   pnpm install
   ```

3. Start the development server
   ```bash
   pnpm dev
   ```

4. Build the documentation site
   ```bash
   pnpm build
   ```

5. Preview the production build
   ```bash
   pnpm preview
   ```

### Additional Scripts

- Convert all images to WebP format:
  ```bash
  pnpm convert-images
  ```

## Documentation Structure

This documentation site is organized into the following sections:

- **Getting Started**: Introduction to Refly and its core features
- **Guide**: Detailed usage instructions, configuration options, and tutorials
  - Crash Course for new users
  - Self-Deploy instructions
  - Configuration options
  - Chrome Extension usage
  - Video Tutorials
- **Roadmap**: Future plans and development roadmap
- **Community**: Contact information and community resources
- **About**: Privacy policy and terms of service
- **Changelog**: Detailed version history and release notes

## Multilingual Support

The documentation is available in:
- English (default), where all the documents are in the root directory
- Chinese (zh), where all the documents are in the `zh` directory

Contributions to other language translations are welcome!

## Contributing

We welcome contributions to the Refly documentation! Please feel free to submit pull requests with improvements, corrections, or translations.