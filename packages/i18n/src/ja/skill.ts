const translations = {
  commonQnA: {
    name: '質問回答',
    description: 'コンテキストに基づいて質問に答えます',
    placeholder: 'AIに質問をして、/を押してスキルを選択してください...',
    steps: {
      analyzeContext: {
        name: 'コンテキスト分析',
      },
      answerQuestion: {
        name: '質問回答',
      },
    },
  },
  generateDoc: {
    name: 'ドキュメント作成',
    description: '質問とコンテキストに基づいてドキュメントを生成します',
    placeholder: 'AIがあなたのドキュメントを作成します...',
    steps: {
      analyzeContext: {
        name: 'コンテキスト分析',
      },
      generateTitle: {
        name: 'タイトル生成',
      },
      generateDocument: {
        name: 'ドキュメント生成',
      },
    },
  },
  editDoc: {
    name: 'ドキュメント編集',
    placeholder: 'AIがあなたのドキュメントを編集します...',
    steps: {},
  },
  rewriteDoc: {
    name: 'ドキュメントの書き直し',
    steps: {},
  },
  webSearch: {
    name: 'ウェブ検索',
    description: 'ウェブを検索して答えを得ます',
    placeholder: 'ウェブを検索して答えを得ましょう...',
    steps: {
      analyzeContext: {
        name: 'コンテキスト分析',
      },
      webSearch: {
        name: 'ウェブ検索',
      },
      answerQuestion: {
        name: '答えの生成',
      },
    },
  },
  librarySearch: {
    name: '図書館検索',
    description: '図書館を検索して答えを得ます',
    placeholder: '図書館を検索して答えを得ましょう...',
    steps: {
      librarySearch: {
        name: '図書館検索',
      },
      answerQuestion: {
        name: '答えの生成',
      },
    },
  },
  recommendQuestions: {
    name: '質問の推薦',
    description: 'コンテキストに基づいて質問をブレインストーミングします',
    placeholder: 'AIがあなたに質問を推薦します...',
    steps: {
      recommendQuestions: {
        name: '推薦質問の生成',
      },
    },
  },
};

export default translations;
