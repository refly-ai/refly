import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiCode } from 'react-icons/fi';
import { MarkdownElementProps } from '../../types/index';
import { MarkdownMode } from '../../types';
import { nodeOperationsEmitter } from '@refly-packages/ai-workspace-common/events/nodeOperations';

interface CanvasProps extends MarkdownElementProps {
  identifier: string;
  title: string;
  type: string;
  language: string;
  mode?: MarkdownMode;
  handleClick?: () => void;
}

const Render = memo<CanvasProps>((props: CanvasProps) => {
  const { title, id, mode = 'interactive' } = props;
  const { t } = useTranslation();

  const isInteractive = mode === 'interactive';

  const handleClick = useCallback(() => {
    nodeOperationsEmitter.emit('jumpToDescendantNode', {
      entityId: id,
      descendantNodeType: 'codeArtifact',
      shouldPreview: true,
    });
  }, [id]);

  // Determine the cursor style based on mode
  const cursorStyle = isInteractive ? 'cursor-pointer' : 'cursor-default';

  return (
    <div className="my-3 rounded-lg overflow-hidden border border-solid border-gray-300 bg-white hover:shadow-sm hover:bg-gray-50 transition-all duration-200">
      <div className={`flex ${cursorStyle} transition-colors`} onClick={handleClick}>
        {/* Left section with gray background */}
        <div className="flex items-center justify-center bg-gray-50 p-3">
          <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center">
            <FiCode className="text-gray-500 text-sm" />
          </div>
        </div>

        {/* Right section with content */}
        <div className="flex-1 flex items-center p-3">
          <div className="flex-1 flex flex-col">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-800">{title || 'Code Artifact'}</span>
            </div>

            <div className="flex items-center text-xs text-gray-500 mt-0.5">
              <span className="mr-2">
                {handleClick && isInteractive
                  ? t('artifact.openComponent', 'Click to view code component')
                  : t('artifact.codeArtifact', 'Code artifact')}
              </span>
              {/* {isGenerating && <IconLoading className="w-2.5 h-2.5 text-gray-500 animate-spin" />} */}
            </div>
          </div>

          {/* Arrow indicator */}
          <div className="flex-shrink-0 text-gray-400 ml-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
});

export default Render;
