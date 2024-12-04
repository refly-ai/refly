const translations = {
  commonQnA: {
    name: '通用问答',
    steps: {
      analyzeContext: {
        name: '上下文分析',
      },
      answerQuestion: {
        name: '问题回答',
      },
    },
  },
  generateDoc: {
    name: '生成文档',
    steps: {
      analyzeContext: {
        name: '上下文分析',
      },
      generateTitle: {
        name: '生成标题',
      },
      generateDocument: {
        name: '生成文档',
      },
    },
  },
  editDoc: {
    name: '编辑文档',
    steps: {},
  },
  rewriteDoc: {
    name: '重写文档',
    steps: {},
  },
  webSearch: {
    name: '网络搜索',
    steps: {
      webSearch: {
        name: '网络搜索',
      },
      answerGeneration: {
        name: '生成答案',
      },
    },
  },
  librarySearch: {
    name: '知识库搜索',
    steps: {
      librarySearch: {
        name: '知识库搜索',
      },
      answerGeneration: {
        name: '生成答案',
      },
    },
  },
  recommendQuestions: {
    name: '推荐问题',
    steps: {
      recommendQuestions: {
        name: '生成推荐问题',
      },
    },
  },
};

export default translations;
