const translations = {
  agent: {
    name: 'Agent',
    description: 'Answer questions based on the context',
    placeholder: 'Ask AI a question, press Ctrl + / to select skill...',
    placeholderMac: 'Ask AI a question, press ⌘ + / to select skill...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      analyzeContext: {
        name: 'Context Analysis',
      },
      answerQuestion: {
        name: 'Question Answering',
      },
    },
  },
  commonQnA: {
    name: 'Question Answering',
    description: 'Answer questions based on the context',
    placeholder: 'Ask AI a question, press Ctrl + / to select skill...',
    placeholderMac: 'Ask AI a question, press ⌘ + / to select skill...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      analyzeContext: {
        name: 'Context Analysis',
      },
      answerQuestion: {
        name: 'Question Answering',
      },
    },
  },
  customPrompt: {
    name: 'Custom Prompt',
    description: 'Answer questions based on the custom system prompt and context',
    placeholder: 'Let AI help you answer questions with a custom system prompt...',
    placeholderMac: 'Let AI help you answer questions with a custom system prompt...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      analyzeContext: {
        name: 'Context Analysis',
      },
      answerQuestion: {
        name: 'Question Answering',
      },
    },
  },
  codeArtifacts: {
    name: 'Code Artifacts',
    description: 'Generate React/TypeScript components based on the question and context',
    placeholder: 'Let AI help you generate a React/TypeScript component...',
    placeholderMac: 'Let AI help you generate a React/TypeScript component...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      analyzeContext: {
        name: 'Context Analysis',
      },
      generateTitle: {
        name: 'Generate Title',
      },
      generateCodeArtifact: {
        name: 'Generate Code Artifact',
      },
    },
  },
  generateDoc: {
    name: 'Document Writing',
    description: 'Generate documents based on the question and context',
    placeholder: 'Let AI help you generate a document...',
    placeholderMac: 'Let AI help you generate a document...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      analyzeContext: {
        name: 'Context Analysis',
      },
      generateTitle: {
        name: 'Generate Title',
      },
      generateDocument: {
        name: 'Generate Document',
      },
    },
  },
  editDoc: {
    name: 'Edit Document',
    placeholder: 'Let AI help you edit the document...',
    placeholderMac: 'Let AI help you edit the document...',
    steps: {},
  },
  rewriteDoc: {
    name: 'Rewrite Document',
    steps: {},
  },
  webSearch: {
    name: 'Web Search',
    description: 'Search the web and get answers',
    placeholder: 'Search the web and get answers...',
    placeholderMac: 'Search the web and get answers...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      analyzeContext: {
        name: 'Context Analysis',
      },
      webSearch: {
        name: 'Web Search',
      },
      answerQuestion: {
        name: 'Answer Generation',
      },
    },
  },
  librarySearch: {
    name: 'Library Search',
    description: 'Search the library and get answers',
    placeholder: 'Search the library and get answers...',
    placeholderMac: 'Search the library and get answers...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      analyzeContext: {
        name: 'Context Analysis',
      },
      librarySearch: {
        name: 'Library Search',
      },
      answerQuestion: {
        name: 'Answer Generation',
      },
    },
  },
  recommendQuestions: {
    name: 'Recommend Questions',
    description: 'Brainstorm questions based on the context',
    placeholder: 'Let AI recommend questions for you...',
    placeholderMac: 'Let AI recommend questions for you...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
      },
      recommendQuestions: {
        name: 'Generate Recommended Questions',
      },
    },
  },
  imageGeneration: {
    name: 'Image Generation',
    description: 'Generate images based on text prompts using AI models',
    placeholder: 'Describe the image you want to generate...',
    steps: {
      generateImage: {
        name: 'Generate Image',
      },
    },
    config: {
      apiUrl: {
        label: 'API URL',
        description: 'The API endpoint for image generation',
      },
      apiKey: {
        label: 'API Key',
        description: 'Your API key for the image generation service',
      },
      imageRatio: {
        label: 'Image Ratio',
        description: 'The aspect ratio of generated images',
        options: {
          '1:1': '1:1 (Square)',
          '16:9': '16:9 (Landscape)',
          '9:16': '9:16 (Portrait)',
        },
      },
      model: {
        label: 'Model',
        description: 'The model to use for image generation',
        options: {
          'gpt-4o-image-vip': 'GPT-4o-image-vip',
          'gpt-4o-image': 'GPT-4o-image',
        },
      },
    },
    ui: {
      generatedImage: 'Generated Image',
      prompt: 'Prompt',
      imageId: 'Image ID',
      note: 'Note: If the image is not displayed on the canvas, please check your network connection or refresh the page. If the problem persists, you can try regenerating using the "Image ID".',
    },
  },
};

export default translations;
