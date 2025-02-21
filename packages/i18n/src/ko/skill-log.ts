const translations = {
  generateTitle: {
    title: '제목 생성',
    description: '생성된 제목: {{title}}, {{duration}}ms 소요',
  },
  generateTitleFailed: {
    title: '제목 생성',
    description: '모델 능력으로 인해 제목 생성에 실패하여 쿼리를 제목으로 사용함',
  },
  rewriteQuery: {
    title: '질문 분해',
    description: '서브 쿼리: {{rewrittenQueries}}, {{duration}}ms 소요',
  },
  translateQuery: {
    title: '쿼리 번역',
    description: '번역된 쿼리: {{translatedQueries}}, {{duration}}ms 소요',
  },
  webSearchCompleted: {
    title: '웹 검색 완료',
    description: '총 {{totalResults}}개의 결과, {{duration}}ms 소요',
  },
  translateResults: {
    title: '결과 번역',
    description: '총 {{totalResults}}개의 결과, {{duration}}ms 소요',
  },
  rerankResults: {
    title: '관련 결과 선택',
    description: '총 {{totalResults}}개의 결과, {{duration}}ms 소요',
  },
};

export default translations;
