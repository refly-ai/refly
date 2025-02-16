import { memo, useEffect, useRef, useState, useCallback } from 'react';
import { Editor, useEditor } from '../../../core/components';
import { addAIHighlight } from '../../../core/extensions';
import CrazySpinner from '../../ui/icons/crazy-spinner';
import Magic from '../../ui/icons/magic';
import { InPlaceEditType, CanvasEditConfig } from '@refly/utils/event-emitter/editor';
import { Input } from '@arco-design/web-react';
import { Button, message } from 'antd';
import { cn } from '@refly/utils/cn';
import { getOsType } from '@refly/utils/env';
import { AddBaseMarkContext } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager/components/add-base-mark-context';

import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { useInvokeAction } from '@refly-packages/ai-workspace-common/hooks/canvas/use-invoke-action';
import { useTranslation } from 'react-i18next';
import { ActionResult, ActionStatus, ConfigScope, Skill } from '@refly/openapi-schema';
import { useChatStore, useChatStoreShallow } from '@refly-packages/ai-workspace-common/stores/chat';
import { genActionResultID } from '@refly-packages/utils/index';
import { useUserStore } from '@refly-packages/ai-workspace-common/stores/user';
import { HiCheck, HiXMark } from 'react-icons/hi2';
import { actionEmitter } from '@refly-packages/ai-workspace-common/events/action';
import { useDocumentContext } from '@refly-packages/ai-workspace-common/context/document';
import {
  useContextPanelStore,
  useContextPanelStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/context-panel';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import { IconCopy } from '@arco-design/web-react/icon';
import { ModelSelector } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions/model-selector';
import { useDocumentStore } from '@refly-packages/ai-workspace-common/stores/document';

interface AISelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  handleBubbleClose?: () => void;
  inPlaceEditType: InPlaceEditType;
}

const getShortcutSymbols = (osType: string) => {
  if (osType === 'OSX') {
    return {
      edit: '↵', // Enter symbol
      chat: '⌘↵', // Command + Enter symbols
    };
  }
  return {
    edit: '↵',
    chat: 'Ctrl+↵',
  };
};

const CONTEXT_CHAR_LIMIT = 500;

const getCompleteBlock = (editor: Editor, doc: any, pos: number, isPrefix = true): string => {
  if (!doc) return '';

  // Get document range based on direction
  const start = isPrefix ? 0 : pos;
  const end = isPrefix ? pos : doc.content.size;

  try {
    // Get slice of document content
    const slice = doc.slice(start, end);

    // Convert to markdown using editor's markdown serializer
    // Note: You'll need to access the markdown serializer from the editor instance
    const mdText = editor.storage.markdown.serializer.serialize(slice.content);

    // Trim and limit the content if needed
    if (mdText.length > CONTEXT_CHAR_LIMIT) {
      return isPrefix ? mdText.slice(-CONTEXT_CHAR_LIMIT) : mdText.slice(0, CONTEXT_CHAR_LIMIT);
    }

    return mdText.trim();
  } catch (e) {
    console.error('Error getting document content:', e);
    return '';
  }
};

export const AISelector = memo(({ onOpenChange, inPlaceEditType }: AISelectorProps) => {
  const { t } = useTranslation();
  const { editor } = useEditor();
  const [inputValue, setInputValue] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  const osType = getOsType();
  const shortcutSymbols = getShortcutSymbols(osType);

  const [resultId, setResultId] = useState('');
  const [resultContent, setResultContent] = useState('');
  const [resultStatus, setResultStatus] = useState<ActionStatus>('waiting');
  const { docId } = useDocumentContext();
  const { invokeAction } = useInvokeAction();

  const { selectedModel, setSelectedModel } = useChatStoreShallow((state) => ({
    selectedModel: state.selectedModel,
    setSelectedModel: state.setSelectedModel,
  }));

  const { contextItems, setContextItems } = useContextPanelStoreShallow((state) => ({
    contextItems: state.contextItems,
    setContextItems: state.setContextItems,
  }));

  const handleEdit = () => {
    const selection = editor.state.selection;
    const startIndex = selection.from;
    const endIndex = selection.to;
    const doc = editor.state.doc;

    const slice = editor.state.selection.content();
    const selectedMdText = editor.storage.markdown.serializer.serialize(slice.content);

    // Get content before and after selection using document positions
    const beforeHighlight = getCompleteBlock(editor, doc, startIndex, true);
    const afterHighlight = getCompleteBlock(editor, doc, endIndex, false);

    const canvasEditConfig: CanvasEditConfig = {
      inPlaceEditType,
      selectedRange: {
        startIndex,
        endIndex,
      },
      selection: {
        beforeHighlight,
        highlightedText: selectedMdText,
        afterHighlight,
      },
    };

    const { data } = useDocumentStore.getState();
    const { document } = data[docId] ?? {};

    const { localSettings } = useUserStore.getState();
    const { uiLocale = 'en' } = localSettings;

    const { selectedModel } = useChatStore.getState();
    const resultId = genActionResultID();
    setResultId(resultId);

    // TODO: maybe use independent context panel store
    const { contextItems } = useContextPanelStore.getState();

    const hasCurrentDoc = contextItems.findIndex((item) => item.entityId === docId);

    if (hasCurrentDoc === -1) {
      contextItems.push({
        type: 'document',
        entityId: docId,
        title: document?.title ?? '',
        isCurrentContext: true,
      });
    } else {
      contextItems[hasCurrentDoc].isCurrentContext = true;
    }

    const currentSkill: Skill = {
      name: 'editDoc',
      icon: {
        type: 'emoji',
        value: '🖊️',
      },
      description: 'Edit document',
      configSchema: {
        items: [],
      },
    };

    setIsLoading(true);
    invokeAction(
      {
        query: inputValue,
        resultId,
        modelInfo: selectedModel,
        contextItems,
        selectedSkill: currentSkill,
        tplConfig: {
          canvasEditConfig: {
            value: canvasEditConfig as { [key: string]: unknown },
            configScope: 'runtime' as unknown as ConfigScope,
            displayValue: uiLocale === 'zh-CN' ? '编辑文档配置' : 'Edit Document Config', // TODO: check if need to use i18n
            label: uiLocale === 'zh-CN' ? '编辑文档配置' : 'Edit Document Config',
          },
        },
      },
      {
        entityType: 'document',
        entityId: docId,
      },
    );
  };

  const updateResult = useCallback(
    (update: { resultId: string; payload: ActionResult }) => {
      if (update?.resultId === resultId) {
        if (isLoading) {
          setIsLoading(false);
        }
        const { steps, status } = update?.payload ?? {};
        setResultStatus(status);
        setResultContent(steps?.map((step) => step?.content).join('\n\n'));
      }
    },
    [resultId, isLoading],
  );

  useEffect(() => {
    actionEmitter.on('updateResult', updateResult);

    return () => {
      actionEmitter.off('updateResult', updateResult);
    };
  }, [updateResult]);

  useEffect(() => {
    return () => {
      setResultId('');
      setResultContent('');
      setResultStatus('waiting');
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.keyCode === 13 && e.shiftKey) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        e.preventDefault();

        // Get cursor position
        const cursorPos = e.target.selectionStart;
        // Create new value with newline
        const newValue = `${inputValue.slice(0, cursorPos as number)}\n${inputValue.slice(cursorPos as number)}`;

        // Update state to trigger re-render and autoSize calculation
        setInputValue(newValue);

        // Need to restore cursor position after state update
        setTimeout(() => {
          if (e.target instanceof HTMLTextAreaElement) {
            e.target.selectionStart = e.target.selectionEnd = (cursorPos as number) + 1;
          }
        }, 0);
      }
    }

    if (e.keyCode === 13 && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleEdit();
    }

    if (e.keyCode === 13 && !e.ctrlKey && !e.shiftKey && !e.metaKey) {
      e.preventDefault();
      handleEdit();
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onOpenChange(false);
        // Focus editor after closing AI selector
        setTimeout(() => {
          editor?.commands.focus();
        }, 0);
      }
    };

    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onOpenChange, editor]);

  const handleReplace = () => {
    const selection = editor.view.state.selection;

    editor.chain().focus().insertContentAt(selection, resultContent).run();
  };

  return (
    <div className="w-[405px] z-50" ref={ref}>
      {(resultId && ['waiting', 'executing'].includes(resultStatus)) || isLoading ? (
        <div className="flex items-center px-4 w-full h-12 text-sm font-medium text-primary-600 text-muted-foreground">
          <Magic className="mr-2 w-4 h-4 shrink-0" />
          {t('editor.aiSelector.thinking')}
          <div className="mt-1 ml-2">
            <CrazySpinner />
          </div>
        </div>
      ) : null}
      {resultId && !isLoading && (
        <div className="flex flex-col">
          <>
            <div className="max-h-[400px] overflow-y-auto prose p-2 px-4 prose-sm">
              <Markdown content={resultContent} />
            </div>
            {resultStatus === 'finish' && (
              <div className="flex flex-row gap-1 px-4">
                <Button
                  size="small"
                  icon={<HiCheck className="text-primary-600" />}
                  onClick={handleReplace}
                >
                  {t('copilot.chatActions.replace')}
                </Button>
                <Button
                  size="small"
                  icon={<HiXMark className="text-red-600" />}
                  onClick={() => onOpenChange(false)}
                >
                  {t('copilot.chatActions.reject')}
                </Button>
                <Button
                  size="small"
                  icon={<IconCopy />}
                  onClick={() => {
                    copyToClipboard(resultContent);
                    message.success(t('components.markdown.copySuccess'));
                  }}
                >
                  {t('copilot.chatActions.copy')}
                </Button>
              </div>
            )}
          </>
        </div>
      )}

      {!isLoading && (
        <div className="flex relative flex-row items-center" cmdk-input-wrapper="">
          <div className="flex flex-1 items-center pl-4 border-b" cmdk-input-wrapper="">
            <Button size="small" type="default" className="rounded border text-gray-500 mr-1">
              <ModelSelector
                model={selectedModel}
                setModel={setSelectedModel}
                placement="bottom"
                briefMode={true}
                trigger={['click']}
                contextItems={contextItems}
              />
            </Button>
            <AddBaseMarkContext contextItems={contextItems} setContextItems={setContextItems} />
            <Input.TextArea
              value={inputValue}
              autoSize={{
                minRows: 1,
                maxRows: 5,
              }}
              ref={(input) => {
                if (input?.dom && inPlaceEditType === 'block') {
                  setTimeout(() => {
                    input.dom.focus();
                  }, 0);
                }
              }}
              onChange={(val) => {
                setInputValue(val);
              }}
              style={{
                borderRadius: 8,
                resize: 'none',
              }}
              onKeyDown={handleKeyDown}
              autoFocus
              className={cn(
                'flex py-3 mx-0.5 w-full h-11 text-sm border-none outline-none calc-width-64px important-outline-none important-box-shadow-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50 !bg-transparent',
              )}
              placeholder={t('copilot.chatInput.editPlaceholder')}
              onFocus={() => {
                addAIHighlight(editor);
              }}
            />
          </div>
          <div className="flex flex-row gap-1 mr-2">
            <Button
              type="primary"
              size="small"
              disabled={!inputValue}
              onClick={() => {
                handleEdit();
              }}
            >
              <span>{t('copilot.chatActions.send')}</span> <span>{shortcutSymbols.edit}</span>
            </Button>
          </div>
        </div>
      )}
    </div>
  );
});
