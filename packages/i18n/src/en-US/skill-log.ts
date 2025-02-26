const translations = {
  generateTitle: {
    title: 'Generate Title',
    description: 'Title generated: {{title}}, completed in {{duration}}ms',
  },
  generateTitleFailed: {
    title: 'Generate Title',
    description: 'Failed to generate title due to model capability, fallback to use query as title',
  },
  rewriteQuery: {
    title: 'Break Down Question',
    description: 'Sub queries: {{rewrittenQueries}}, completed in {{duration}}ms',
  },
  translateQuery: {
    title: 'Translate Query',
    description: 'Translated queries: {{translatedQueries}}, completed in {{duration}}ms',
  },
  webSearchCompleted: {
    title: 'Web Search Completed',
    description: 'Total of {{totalResults}} results, completed in {{duration}}ms',
  },
  librarySearchCompleted: {
    title: 'Library Search Completed',
    description: 'Total of {{totalResults}} results, completed in {{duration}}ms',
  },
  translateResults: {
    title: 'Translate Results',
    description: 'Total of {{totalResults}} results, completed in {{duration}}ms',
  },
  rerankResults: {
    title: 'Select Related Results',
    description: 'Total of {{totalResults}} results, completed in {{duration}}ms',
  },
  generateAnswer: {
    title: 'Generate Answer',
    description: 'Start to generate answer...',
  },
};

export default translations;
