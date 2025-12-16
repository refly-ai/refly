import React, { useCallback, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { MonacoEditorProps } from './types';

// Default maximum characters to show during generation
const DEFAULT_MAX_GENERATION_DISPLAY = 5000;

// Simple text editor for displaying content without syntax highlighting
// Used during content generation to improve performance
const SimpleTextEditor = React.memo(
  ({ content, onChange, readOnly, isGenerating, canvasReadOnly }: MonacoEditorProps) => {
    const { t } = useTranslation();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const handleChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onChange?.(e.target.value);
      },
      [onChange],
    );

    // Truncate content during generation if it's too long
    const displayContent = useMemo(() => {
      if (!isGenerating || !content || content.length <= DEFAULT_MAX_GENERATION_DISPLAY) {
        return content;
      }

      // Only show the last N characters during generation
      return content.slice(-DEFAULT_MAX_GENERATION_DISPLAY);
    }, [content, isGenerating]);

    // Check if content is truncated
    const isContentTruncated =
      isGenerating && content && content.length > DEFAULT_MAX_GENERATION_DISPLAY;

    return (
      <div className="h-full flex flex-col bg-white dark:bg-gray-900">
        {isGenerating && (
          <div className="bg-blue-50 text-blue-800 px-4 py-2 text-sm flex items-center justify-between dark:bg-blue-900 dark:text-blue-200">
            <div className="flex items-center">
              <div className="mr-2 w-3 h-3 bg-blue-500 rounded-full animate-pulse dark:bg-blue-400" />
              {t('codeArtifact.editor.generatingContent')}
            </div>
          </div>
        )}

        {isContentTruncated && (
          <div className="bg-yellow-50 text-yellow-800 px-4 py-2 text-sm dark:bg-yellow-50 dark:text-yellow-600">
            {t('codeArtifact.editor.contentTruncated', {
              chars: DEFAULT_MAX_GENERATION_DISPLAY,
              total: content.length,
            }) ||
              `Showing only the last ${DEFAULT_MAX_GENERATION_DISPLAY} characters of ${content.length} total. Full content will be displayed when generation completes.`}
          </div>
        )}

        <textarea
          ref={textareaRef}
          className="w-full flex-1 p-4 font-mono text-sm resize-none border-none focus:outline-none focus:ring-1 focus:ring-blue-500 bg-gray-50 dark:bg-gray-900 dark:focus:ring-blue-400 dark:text-gray-300"
          value={displayContent}
          onChange={handleChange}
          readOnly={readOnly || isGenerating || canvasReadOnly}
          style={{
            lineHeight: '1.5',
            fontFamily:
              'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
          placeholder={isGenerating ? t('codeArtifact.editor.generatingPlaceholder') : ''}
        />
      </div>
    );
  },
);

export default SimpleTextEditor;
