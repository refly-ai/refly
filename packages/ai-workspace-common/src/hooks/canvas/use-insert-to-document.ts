import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { message } from 'antd';
import { useDocumentStore } from '@refly-packages/ai-workspace-common/stores/document';
import { useActionResultStore } from '@refly-packages/ai-workspace-common/stores/action-result';
import { parseMarkdownCitationsAndCanvasTags, safeParseJSON } from '@refly/utils/parse';
import { EditorOperation, editorEmitter } from '@refly/utils/event-emitter/editor';
import { Source } from '@refly/openapi-schema';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';

export const useInsertToDocument = (resultId: string) => {
  const { t } = useTranslation();

  const fetchActionResult = async (resultId: string) => {
    const { data, error } = await getClient().getActionResult({
      query: { resultId },
    });

    if (error || !data?.success) {
      return;
    }

    return data.data;
  };

  return useCallback(
    async (operation: EditorOperation = 'insertBelow', content?: string) => {
      const { activeDocumentId } = useDocumentStore.getState();

      if (!activeDocumentId) {
        message.warning(t('knowledgeBase.context.noActiveDocument'));
        return;
      }

      let parsedContent = '';

      // If content is provided directly, use it
      if (content) {
        parsedContent = parseMarkdownCitationsAndCanvasTags(content, []);
      } else {
        // Fallback to fetching from API if no content provided
        const { resultMap } = useActionResultStore.getState();
        const result = resultMap?.[resultId] || (await fetchActionResult(resultId));

        const answerQuestionStep = result?.steps?.find((step) => step?.name === 'answerQuestion');
        if (!answerQuestionStep?.content) {
          message.warning(t('knowledgeBase.context.noContent'));
          return;
        }

        const sources =
          typeof answerQuestionStep?.structuredData?.sources === 'string'
            ? safeParseJSON(answerQuestionStep?.structuredData?.sources)
            : (answerQuestionStep?.structuredData?.sources as Source[]);
        parsedContent = parseMarkdownCitationsAndCanvasTags(
          answerQuestionStep?.content || '',
          sources,
        );
      }

      editorEmitter.emit(operation, parsedContent);

      message.success(
        operation === 'insertBelow'
          ? t('knowledgeBase.context.insertSuccess')
          : t('knowledgeBase.context.replaceSuccess'),
      );
    },
    [t],
  );
};
