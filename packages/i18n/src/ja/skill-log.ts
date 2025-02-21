const translations = {
  generateTitle: {
    title: 'タイトル生成',
    description: '生成されたタイトル: {{title}}, {{duration}}msで完了',
  },
  generateTitleFailed: {
    title: 'タイトル生成',
    description: 'モデルの能力によりタイトルの生成に失敗し、クエリをタイトルとして使用しました',
  },
  rewriteQuery: {
    title: '質問を分解',
    description: 'サブクエリ: {{rewrittenQueries}}, {{duration}}msで完了',
  },
  translateQuery: {
    title: 'クエリを翻訳',
    description: '翻訳されたクエリ: {{translatedQueries}}, {{duration}}msで完了',
  },
  webSearchCompleted: {
    title: 'ウェブ検索完了',
    description: '合計{{totalResults}}件の結果、{{duration}}msで完了',
  },
  translateResults: {
    title: '結果を翻訳',
    description: '合計{{totalResults}}件の結果、{{duration}}msで完了',
  },
  rerankResults: {
    title: '関連する結果を選択',
    description: '合計{{totalResults}}件の結果、{{duration}}msで完了',
  },
};

export default translations;
