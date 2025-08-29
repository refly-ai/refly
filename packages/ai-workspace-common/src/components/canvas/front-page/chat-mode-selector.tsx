import { Segmented, Tooltip } from 'antd';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { Agent, Chat, Media } from 'refly-icons';
import { ChatMode } from '@refly/stores';
import cn from 'classnames';

interface ChatModeSelectorProps {
  chatMode: ChatMode;
  setChatMode: (mode: ChatMode) => void;
  className?: string;
}

interface ModeOptionLabelProps {
  icon: React.ReactNode;
  mode: ChatMode;
  currentMode: ChatMode;
  tooltipKey: string;
  labelKey: string;
}

const ModeOptionLabel = memo(
  ({ icon, mode, currentMode, tooltipKey, labelKey }: ModeOptionLabelProps) => {
    const { t } = useTranslation();

    return (
      <Tooltip title={t(tooltipKey)} placement="bottom">
        <div className="flex items-center gap-[2px]">
          {icon}
          {currentMode === mode && <span className="font-semibold leading-5">{t(labelKey)}</span>}
        </div>
      </Tooltip>
    );
  },
);

ModeOptionLabel.displayName = 'ModeOptionLabel';

export const ChatModeSelector = memo(
  ({ chatMode, setChatMode, className }: ChatModeSelectorProps) => {
    return (
      <Segmented
        shape="round"
        value={chatMode}
        onChange={(value) => setChatMode(value as ChatMode)}
        options={[
          {
            label: (
              <ModeOptionLabel
                icon={<Agent size={20} />}
                mode="agent"
                currentMode={chatMode}
                tooltipKey="mode.agentDescription"
                labelKey="mode.agent"
              />
            ),
            value: 'agent',
          },
          {
            label: (
              <ModeOptionLabel
                icon={<Chat size={20} />}
                mode="ask"
                currentMode={chatMode}
                tooltipKey="mode.askDescription"
                labelKey="mode.ask"
              />
            ),
            value: 'ask',
          },
          {
            label: (
              <ModeOptionLabel
                icon={<Media size={20} />}
                mode="media"
                currentMode={chatMode}
                tooltipKey="mode.mediaDescription"
                labelKey="mode.media"
              />
            ),
            value: 'media',
          },
        ]}
        className={cn('p-0.5', className)}
      />
    );
  },
);

ChatModeSelector.displayName = 'ChatModeSelector';
