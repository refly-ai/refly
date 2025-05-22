import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { PreviewContextManager } from './preview-context-manager';
import { useMemo, memo } from 'react';
import { cn } from '@refly-packages/ai-workspace-common/utils/cn';
import { SelectedSkillHeader } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/selected-skill-header';

interface PreviewChatInputProps {
  enabled: boolean;
  contextItems: IContextItem[];
  query: string;
  actionMeta?: {
    icon?: any;
    name?: string;
  };
  setEditMode: (mode: boolean) => void;
  readonly?: boolean;
}

const PreviewChatInputComponent = (props: PreviewChatInputProps) => {
  const { enabled, contextItems, query, readonly, actionMeta, setEditMode } = props;

  const hideSelectedSkillHeader = useMemo(
    () => !actionMeta || actionMeta?.name === 'commonQnA' || !actionMeta?.name,
    [actionMeta],
  );

  if (!enabled) {
    return null;
  }

  return (
    <div
      className={cn('border border-solid border-gray-200 rounded-lg dark:border-gray-700')}
      onClick={() => {
        if (!readonly) {
          setEditMode(true);
        }
      }}
    >
      {!hideSelectedSkillHeader && (
        <SelectedSkillHeader
          readonly={readonly}
          skill={{
            icon: actionMeta?.icon,
            name: actionMeta?.name,
          }}
          className="rounded-t-[7px]"
        />
      )}
      {contextItems?.length > 0 && <PreviewContextManager contextItems={contextItems} />}
      <div className="text-sm m-2 break-all dark:text-gray-300">{query}</div>
    </div>
  );
};

const arePropsEqual = (prevProps: PreviewChatInputProps, nextProps: PreviewChatInputProps) => {
  return (
    prevProps.enabled === nextProps.enabled &&
    prevProps.query === nextProps.query &&
    prevProps.readonly === nextProps.readonly &&
    prevProps.contextItems === nextProps.contextItems &&
    prevProps.actionMeta?.name === nextProps.actionMeta?.name
  );
};

export const PreviewChatInput = memo(PreviewChatInputComponent, arePropsEqual);
