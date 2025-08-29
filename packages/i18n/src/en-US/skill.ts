const translations = {
  agent: {
    name: 'Agent',
    description: 'Answer questions based on the context',
    placeholder: 'Ask AI a question...',
    placeholderMac: 'Ask AI a question...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
        description: 'Analyzing requirements...',
      },
      analyzeContext: {
        name: 'Context Analysis',
        description: 'Processing context data...',
      },
      answerQuestion: {
        name: 'Question Answering',
        description: 'Generating answer...',
      },
    },
  },
  commonQnA: {
    name: 'Question Answering',
    description: 'Answer questions based on the context',
    placeholder: 'Ask AI a question...',
    placeholderMac: 'Ask AI a question...',
    steps: {
      analyzeQuery: {
        name: 'Query Analysis',
        description: 'Analyzing requirements...',
      },
      analyzeContext: {
        name: 'Context Analysis',
        description: 'Processing context data...',
      },
      answerQuestion: {
        name: 'Question Answering',
        description: 'Generating answer...',
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
        description: 'Analyzing requirements...',
      },
      analyzeContext: {
        name: 'Context Analysis',
        description: 'Processing context data...',
      },
      answerQuestion: {
        name: 'Question Answering',
        description: 'Generating answer...',
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
        description: 'Analyzing requirements...',
      },
      analyzeContext: {
        name: 'Context Analysis',
        description: 'Processing context data...',
      },
      generateTitle: {
        name: 'Generate Title',
        description: 'Determining code artifact title...',
      },
      generateCodeArtifact: {
        name: 'Generate Code Artifact',
        description: 'Generating code artifact...',
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
        description: 'Analyzing requirements...',
      },
      analyzeContext: {
        name: 'Context Analysis',
        description: 'Processing context data...',
      },
      generateTitle: {
        name: 'Generate Title',
        description: 'Determining document title...',
      },
      generateDocument: {
        name: 'Generate Document',
        description: 'Generating document...',
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
        description: 'Analyzing requirements...',
      },
      analyzeContext: {
        name: 'Context Analysis',
        description: 'Processing context data...',
      },
      webSearch: {
        name: 'Web Search',
        description: 'Searching the web...',
      },
      answerQuestion: {
        name: 'Answer Generation',
        description: 'Generating answer...',
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
        description: 'Analyzing requirements...',
      },
      analyzeContext: {
        name: 'Context Analysis',
        description: 'Processing context data...',
      },
      librarySearch: {
        name: 'Library Search',
        description: 'Searching the library...',
      },
      answerQuestion: {
        name: 'Answer Generation',
        description: 'Generating answer...',
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
        description: 'Analyzing requirements...',
      },
      recommendQuestions: {
        name: 'Generate Recommended Questions',
        description: 'Generating recommended questions...',
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
        description: 'Generating image...',
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
  generateMedia: {
    name: 'Media Generation',
    description: 'Generate multimedia content including images, videos, and audio using AI models',
    placeholder: 'Describe the media content you want to generate...',
    placeholderMac: 'Describe the media content you want to generate...',
    steps: {
      generateMedia: {
        name: 'Generate Media',
        description: 'Generating media...',
      },
    },
    config: {
      mediaType: {
        label: 'Media Type',
        description: 'Type of media to generate',
        options: {
          image: 'Image',
          video: 'Video',
          audio: 'Audio',
        },
      },
      provider: {
        label: 'Provider',
        description: 'AI service provider for media generation',
      },
      model: {
        label: 'Model',
        description: 'AI model to use for media generation',
      },
      quality: {
        label: 'Quality',
        description: 'Quality setting for generated content',
        options: {
          low: 'Low',
          medium: 'Medium',
          high: 'High',
        },
      },
    },
    ui: {
      generatedMedia: 'Generated Media',
      mediaType: 'Media Type',
      prompt: 'Prompt',
      resultId: 'Result ID',
      generating: 'Generating {{mediaType}}...',
      completed: '{{mediaType}} generation completed',
      failed: '{{mediaType}} generation failed',
      note: 'Note: If the media content is not displayed on the canvas, please check your network connection or refresh the page.',
    },
  },
};

export default translations;
