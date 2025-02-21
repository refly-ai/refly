const translations = {
  commonQnA: {
    name: '질문 답변',
    description: '컨텍스트를 기반으로 질문에 답합니다',
    placeholder: 'AI에게 질문을 하고, /를 눌러 기술을 선택하세요...',
    steps: {
      analyzeContext: {
        name: '컨텍스트 분석',
      },
      answerQuestion: {
        name: '질문 답변',
      },
    },
  },
  generateDoc: {
    name: '문서 작성',
    description: '질문과 컨텍스트를 기반으로 문서를 생성합니다',
    placeholder: 'AI가 문서를 생성해 드릴게요...',
    steps: {
      analyzeContext: {
        name: '컨텍스트 분석',
      },
      generateTitle: {
        name: '제목 생성',
      },
      generateDocument: {
        name: '문서 생성',
      },
    },
  },
  editDoc: {
    name: '문서 편집',
    placeholder: 'AI가 문서를 편집해 드릴게요...',
    steps: {},
  },
  rewriteDoc: {
    name: '문서 재작성',
    steps: {},
  },
  webSearch: {
    name: '웹 검색',
    description: '웹을 검색하고 답변을 얻습니다',
    placeholder: '웹을 검색하고 답변을 얻으세요...',
    steps: {
      analyzeContext: {
        name: '컨텍스트 분석',
      },
      webSearch: {
        name: '웹 검색',
      },
      answerQuestion: {
        name: '답변 생성',
      },
    },
  },
  librarySearch: {
    name: '도서관 검색',
    description: '도서관을 검색하고 답변을 얻습니다',
    placeholder: '도서관을 검색하고 답변을 얻으세요...',
    steps: {
      librarySearch: {
        name: '도서관 검색',
      },
      answerQuestion: {
        name: '답변 생성',
      },
    },
  },
  recommendQuestions: {
    name: '질문 추천',
    description: '컨텍스트를 기반으로 질문을 브레인스토밍합니다',
    placeholder: 'AI가 질문을 추천해 드릴게요...',
    steps: {
      recommendQuestions: {
        name: '추천 질문 생성',
      },
    },
  },
};

export default translations;
