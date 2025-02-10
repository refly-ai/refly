const translations = {
  commonQnA: {
    name: 'Question Answering',
    description: 'Answer questions based on the context',
    placeholder: 'Ask AI a question, press / to select skill...',
    steps: {
      analyzeContext: {
        name: 'Context Analysis',
      },
      answerQuestion: {
        name: 'Question Answering',
      },
    },
  },
  generateDoc: {
    name: 'Document Writing',
    description: 'Generate documents based on the question and context',
    placeholder: 'Let AI help you generate a document...',
    steps: {
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
    steps: {
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
  deepResearch: {
    name: 'Deep Research',
    description: 'Perform comprehensive research on complex topics',
    placeholder: 'Enter your research topic or question...',
    steps: {
      analyzeContext: {
        name: 'Research Planning',
      },
      webSearch: {
        name: 'Web Search',
      },
      extract: {
        name: 'Content Extraction',
      },
      analyze: {
        name: 'Analysis & Synthesis',
      },
      synthesis: {
        name: 'Final Report Generation',
      },
    },
  },
  librarySearch: {
    name: 'Library Search',
    description: 'Search the library and get answers',
    placeholder: 'Search the library and get answers...',
    steps: {
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
    steps: {
      recommendQuestions: {
        name: 'Generate Recommended Questions',
      },
    },
  },
};

export default translations;
