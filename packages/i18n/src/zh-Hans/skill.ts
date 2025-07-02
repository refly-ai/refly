const translations = {
  agent: {
    name: '智能代理',
    description: '基于上下文回答问题',
    placeholder: '向 AI 提问，按 Ctrl + / 选择技能...',
    placeholderMac: '向 AI 提问，按 ⌘ + / 选择技能...',
    steps: {
      analyzeQuery: {
        name: '查询分析',
      },
      analyzeContext: {
        name: '上下文分析',
      },
      answerQuestion: {
        name: '问题回答',
      },
    },
  },
  commonQnA: {
    name: '通用问答',
    description: '基于上下文回答问题',
    placeholder: '向 AI 提问，输入 Ctrl + / 选择技能...',
    placeholderMac: '向 AI 提问，输入 ⌘ + / 选择技能...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      analyzeContext: {
        name: '上下文分析',
      },
      answerQuestion: {
        name: '问题回答',
      },
    },
  },
  customPrompt: {
    name: '自定义提示',
    description: '基于自定义系统提示和上下文回答问题',
    placeholder: '让 AI 基于自定义系统提示回答问题...',
    placeholderMac: '让 AI 基于自定义系统提示回答问题...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      analyzeContext: {
        name: '上下文分析',
      },
      answerQuestion: {
        name: '问题回答',
      },
    },
  },
  codeArtifacts: {
    name: '小组件生成',
    description: '根据需求和上下文生成小组件',
    placeholder: '让 AI 帮您生成一个小组件...',
    placeholderMac: '让 AI 帮您生成一个小组件...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      analyzeContext: {
        name: '上下文分析',
      },
      generateTitle: {
        name: '生成标题',
      },
      generateCodeArtifact: {
        name: '生成小组件',
      },
    },
  },
  generateDoc: {
    name: '文档写作',
    description: '根据需求和上下文进行写作',
    placeholder: '让 AI 帮您生成一篇文档...',
    placeholderMac: '让 AI 帮您生成一篇文档...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
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
    placeholder: '让 AI 帮您编辑文档...',
    placeholderMac: '让 AI 帮您编辑文档...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      analyzeContext: {
        name: '上下文分析',
      },
    },
  },
  rewriteDoc: {
    name: '重写文档',
    steps: {},
  },
  webSearch: {
    name: '网络搜索',
    description: '搜索网络并获取答案',
    placeholder: '搜索网络并获取答案...',
    placeholderMac: '搜索网络并获取答案...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      analyzeContext: {
        name: '上下文分析',
      },
      webSearch: {
        name: '网络搜索',
      },
      answerQuestion: {
        name: '生成答案',
      },
    },
  },
  librarySearch: {
    name: '知识库搜索',
    description: '搜索知识库并获取答案',
    placeholder: '搜索知识库并获取答案...',
    placeholderMac: '搜索知识库并获取答案...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      analyzeContext: {
        name: '上下文分析',
      },
      librarySearch: {
        name: '知识库搜索',
      },
      answerQuestion: {
        name: '生成答案',
      },
    },
  },
  recommendQuestions: {
    name: '推荐问题',
    description: '基于上下文脑暴问题',
    placeholder: '让 AI 为您生成推荐问题...',
    placeholderMac: '让 AI 为您生成推荐问题...',
    steps: {
      analyzeQuery: {
        name: '分析需求',
      },
      recommendQuestions: {
        name: '生成推荐问题',
      },
    },
  },
  imageGeneration: {
    name: '图像生成',
    description: '使用AI模型根据文本提示生成图像',
    placeholder: '描述您想要生成的图像...',
    placeholderMac: '描述您想要生成的图像...',
    steps: {
      generateImage: {
        name: '生成图像',
      },
    },
    config: {
      apiUrl: {
        label: 'API 地址',
        description: '图像生成API接口地址',
      },
      apiKey: {
        label: 'API 密钥',
        description: '图像生成服务的API密钥',
      },
      imageRatio: {
        label: '图像比例',
        description: '生成图像的宽高比',
        options: {
          '1:1': '1:1 (正方形)',
          '16:9': '16:9 (横向)',
          '9:16': '9:16 (纵向)',
        },
      },
      model: {
        label: '模型',
        description: '用于图像生成的模型',
        options: {
          'gpt-4o-image-vip': 'GPT-4o-image-vip',
          'gpt-4o-image': 'GPT-4o-image',
        },
      },
    },
    ui: {
      generatedImage: '生成的图像',
      prompt: '提示词',
      imageId: '图像ID',
      note: '注意: 如果图像未显示在画板中，请检查网络连接或刷新页面。如果问题仍然存在，可以尝试使用"图像ID"重新生成。',
    },
  },
};

export default translations;
