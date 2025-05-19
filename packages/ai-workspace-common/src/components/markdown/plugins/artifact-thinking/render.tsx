import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useActionResultStoreShallow } from '@refly-packages/ai-workspace-common/stores/action-result';
import { ARTIFACT_THINKING_TAG } from '@refly/utils/artifact';
import {
  IconThinking,
  IconLoading,
} from '@refly-packages/ai-workspace-common/components/common/icon';

export const isReflyThinkingClosed = (input = '') => {
  // More robust check - look for both the opening tag (anywhere) and the closing tag (after the opening)
  const openTagPos = input.indexOf(`<${ARTIFACT_THINKING_TAG}`);
  if (openTagPos === -1) return false;

  // Find the end of the opening tag
  const openTagEndPos = input.indexOf('>', openTagPos);
  if (openTagEndPos === -1) return false;

  // Check for closing tag after the opening tag
  const closeTagPos = input.indexOf(`</${ARTIFACT_THINKING_TAG}>`, openTagEndPos);
  return closeTagPos !== -1;
};

const Render = memo((props: { id: string }) => {
  const { id } = props;
  const { t } = useTranslation();

  const isThinking = useActionResultStoreShallow((state) => {
    // Look for the result with this ID
    const result = state.resultMap[id];

    // If no result found, return false
    if (!result) {
      return false;
    }

    // Combine all step contents into one string
    const combinedContent =
      result.steps?.reduce((acc, step) => {
        return acc + (step.content ?? '');
      }, '') ?? '';

    // Check if the combined content has closed thinking tags
    const hasClosedThinking = isReflyThinkingClosed(combinedContent);

    // Return false if thinking is closed or if not in executing/waiting state
    if (hasClosedThinking || !['executing', 'waiting'].includes(result?.status ?? '')) {
      return false;
    }

    // Otherwise, we are thinking
    return true;
  });

  if (!isThinking) return null;

  return (
    <div className="my-3 p-3 bg-gray-50 rounded-lg border border-gray-200 transition-all dark:bg-gray-900 dark:border-gray-700">
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-2">
          <IconThinking className="w-4 h-4" />
          <span className="text-sm text-gray-700 font-medium dark:text-gray-200">
            {t('artifact.thinking', 'Thinking...')}
          </span>
        </div>
        <IconLoading className="w-3 h-3 ml-1 text-gray-500 animate-spin dark:text-gray-400" />
      </div>
    </div>
  );
});

export default Render;
