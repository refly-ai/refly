import { Typography } from 'antd';
import { IContextItem } from '@refly/common-types';
import { PreviewContextManager } from './preview-context-manager';
import { useMemo, memo } from 'react';
import { SelectedSkillHeader } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/selected-skill-header';
const { Paragraph } = Typography;

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
      className="rounded-lg bg-refly-bg-control-z0 p-2 hover:bg-refly-tertiary-hover cursor-pointer"
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
            name: actionMeta?.name ?? '',
          }}
          className="rounded-t-[7px]"
        />
      )}
      {contextItems?.length > 0 && <PreviewContextManager contextItems={contextItems} />}
      <Paragraph
        className="text-base break-all text-refly-text-0 font-semibold leading-[26px] !mb-0"
        ellipsis={{ rows: 4 }}
      >
        {query}
      </Paragraph>
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
