import { SelectedSkillHeader } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/selected-skill-header';
import { Input } from 'antd';
import { useTranslation } from 'react-i18next';
import { NodeItem } from '@refly-packages/ai-workspace-common/stores/context-panel';

import { PreviewContextManager } from './preview-context-manager';
import { useEffect, useState } from 'react';

const TextArea = Input.TextArea;

interface PreviewChatInputProps {
  contextItems: NodeItem[];
  historyItems: NodeItem[];
  chatHistoryOpen: boolean;
  setChatHistoryOpen: (open: boolean) => void;
  query: string;
  actionMeta?: {
    icon?: any;
    name?: string;
  };
  readonly?: boolean;
}

export const PreviewChatInput = (props: PreviewChatInputProps) => {
  const { contextItems, historyItems, chatHistoryOpen, setChatHistoryOpen, query, actionMeta, readonly } = props;
  const { t } = useTranslation();
  const [userQuery, setUserQuery] = useState(query);

  useEffect(() => {
    setUserQuery(query);
  }, [query]);

  const hideSelectedSkillHeader = !actionMeta || actionMeta?.name === 'commonQnA' || !actionMeta?.name;

  return (
    <div className="ai-copilot-chat-container">
      <div className="chat-input-container">
        {!hideSelectedSkillHeader && (
          <SelectedSkillHeader
            readonly={readonly}
            skill={{
              icon: actionMeta?.icon,
              displayName: actionMeta?.name,
            }}
          />
        )}
        {contextItems?.length === 0 && historyItems?.length === 0 ? null : (
          <PreviewContextManager
            contextItems={contextItems}
            historyItems={historyItems}
            chatHistoryOpen={chatHistoryOpen}
            setChatHistoryOpen={setChatHistoryOpen}
          />
        )}
        <div className="chat-input-body">
          <div className="ai-copilot-chat-input-container">
            <div className="ai-copilot-chat-input-body">
              <TextArea
                value={userQuery}
                onChange={(event) => {
                  setUserQuery(event.target.value);
                }}
                style={{
                  borderRadius: 8,
                  resize: 'none',
                }}
                placeholder={t('copilot.chatInput.placeholder')}
                autoSize={{
                  minRows: 1,
                  maxRows: 3,
                }}
              ></TextArea>
            </div>
          </div>
        </div>

        {/* {skillStore.selectedSkill?.configSchema?.items?.length > 0 && (
      <ConfigManager
        form={form}
        formErrors={formErrors}
        setFormErrors={setFormErrors}
        schema={skillStore.selectedSkill?.configSchema}
        tplConfig={skillStore.selectedSkill?.config}
        fieldPrefix="tplConfig"
        configScope="runtime"
        resetConfig={() => {
          form.setFieldValue('tplConfig', skillStore.selectedSkill?.tplConfig || {});
        }}
      />
    )} */}
      </div>
    </div>
  );
};
