import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Form } from '@arco-design/web-react';
import { Button } from 'antd';
import { IconClose } from '@arco-design/web-react/icon';

import { ChatInput } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-input';
import { getSkillIcon } from '@refly-packages/ai-workspace-common/components/common/icon';
import { ModelInfo, Skill, SkillRuntimeConfig, SkillTemplateConfig } from '@refly/openapi-schema';
import { ChatActions } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/chat-actions';
import { ContextManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/context-manager';
import { ConfigManager } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/config-manager';
import { IContextItem } from '@refly-packages/ai-workspace-common/stores/context-panel';
import { useTranslation } from 'react-i18next';
import { IoClose } from 'react-icons/io5';
import { SelectedSkillHeader } from '@refly-packages/ai-workspace-common/components/canvas/launchpad/selected-skill-header';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { useSubscriptionStoreShallow } from '@refly-packages/ai-workspace-common/stores/subscription';
import { useLaunchpadStoreShallow } from '@refly-packages/ai-workspace-common/stores/launchpad';
import { subscriptionEnabled } from '@refly-packages/ai-workspace-common/utils/env';
import { cn } from '@refly-packages/utils/cn';
import classNames from 'classnames';

// Memoized Premium Banner Component
const PremiumBanner = memo(() => {
  const { t } = useTranslation();
  const { showPremiumBanner, setShowPremiumBanner } = useLaunchpadStoreShallow((state) => ({
    showPremiumBanner: state.showPremiumBanner,
    setShowPremiumBanner: state.setShowPremiumBanner,
  }));
  const setSubscribeModalVisible = useSubscriptionStoreShallow(
    (state) => state.setSubscribeModalVisible,
  );

  if (!showPremiumBanner) return null;

  const handleUpgrade = () => {
    setSubscribeModalVisible(true);
  };

  return (
    <div className="flex items-center justify-between px-3 py-0.5 bg-gray-100 border-b">
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="text-xs text-gray-600 flex-1 whitespace-nowrap">
          {t('copilot.premiumBanner.message')}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            type="text"
            size="small"
            className="text-xs text-green-600 px-2"
            onClick={handleUpgrade}
          >
            {t('copilot.premiumBanner.upgrade')}
          </Button>
          <Button
            type="text"
            size="small"
            icon={<IoClose size={14} className="flex items-center justify-center" />}
            onClick={() => setShowPremiumBanner(false)}
            className="text-gray-400 hover:text-gray-500 flex items-center justify-center w-5 h-5 min-w-0 p-0"
          />
        </div>
      </div>
    </div>
  );
});

PremiumBanner.displayName = 'PremiumBanner';

// Memoized Header Component
const NodeHeader = memo(
  ({
    selectedSkillName,
    setSelectedSkill,
    readonly,
  }: {
    selectedSkillName?: string;
    setSelectedSkill: (skill: Skill | null) => void;
    readonly: boolean;
  }) => {
    const { t } = useTranslation();
    return (
      <div className="flex justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-[#6172F3] shadow-lg flex items-center justify-center flex-shrink-0">
            {getSkillIcon(selectedSkillName, 'w-4 h-4 text-white')}
          </div>
          <span className="text-sm font-medium leading-normal text-[rgba(0,0,0,0.8)] truncate">
            {selectedSkillName
              ? t(`${selectedSkillName}.name`, { ns: 'skill' })
              : t('canvas.skill.askAI')}
          </span>
        </div>
        {selectedSkillName && !readonly && (
          <Button
            type="text"
            size="small"
            className="p-0"
            icon={<IconClose />}
            onClick={() => {
              setSelectedSkill?.(null);
            }}
          />
        )}
      </div>
    );
  },
);

NodeHeader.displayName = 'NodeHeader';

export interface ChatPanelProps {
  readonly?: boolean;
  query: string;
  setQuery: (query: string) => void;
  selectedSkill: Skill | null;
  setSelectedSkill: (skill: Skill | null) => void;
  contextItems: IContextItem[];
  setContextItems: (items: IContextItem[]) => void;
  modelInfo: ModelInfo | null;
  setModelInfo: (modelInfo: ModelInfo | null) => void;
  runtimeConfig: SkillRuntimeConfig;
  setRuntimeConfig: (config: SkillRuntimeConfig) => void;
  tplConfig?: SkillTemplateConfig;
  setTplConfig?: (config: SkillTemplateConfig) => void;
  handleSendMessage: () => void;
  handleAbortAction: () => void;
  handleUploadImage: (file: File) => Promise<any>;
  onInputHeightChange?: () => void;
  className?: string;
  mode?: 'node' | 'list'; // Added mode prop to differentiate between node and list display
}

export const ChatPanel = memo(
  ({
    readonly = false,
    query,
    setQuery,
    selectedSkill,
    setSelectedSkill,
    contextItems = [],
    setContextItems,
    modelInfo,
    setModelInfo,
    runtimeConfig = {},
    setRuntimeConfig,
    tplConfig,
    setTplConfig,
    handleSendMessage,
    handleAbortAction,
    handleUploadImage,
    onInputHeightChange,
    className = '',
    mode = 'node', // Default to node mode
  }: ChatPanelProps) => {
    const [form] = Form.useForm();
    const [formErrors, setFormErrors] = useState<Record<string, string>>({});
    const chatInputRef = useRef<HTMLDivElement>(null);
    const userProfile = useUserStoreShallow((state) => state.userProfile);
    const isList = mode === 'list';

    // Reset form when skill changes
    useEffect(() => {
      if (selectedSkill) {
        form.resetFields();
        setFormErrors({});
      }
    }, [selectedSkill, form, setFormErrors]);

    // Memoize initialTplConfig to prevent unnecessary recalculations
    const initialTplConfig = useMemo(() => {
      return tplConfig || selectedSkill?.tplConfig || {};
    }, [tplConfig, selectedSkill?.tplConfig]);

    const handleTplConfigChange = useCallback(
      (config: SkillTemplateConfig) => {
        if (setTplConfig && JSON.stringify(config) !== JSON.stringify(initialTplConfig)) {
          console.log('Config changed:', { old: initialTplConfig, new: config });
          setTplConfig(config);
        }
      },
      [setTplConfig, initialTplConfig],
    );

    const handleImageUpload = useCallback(
      async (file: File) => {
        const nodeData = await handleUploadImage(file);
        if (nodeData) {
          setContextItems([
            ...contextItems,
            {
              type: 'image',
              ...nodeData,
            },
          ]);
        }
      },
      [contextItems, handleUploadImage, setContextItems],
    );

    // Add useEffect for auto focus
    useEffect(() => {
      if (!readonly) {
        setTimeout(() => {
          if (chatInputRef.current) {
            const textArea = chatInputRef.current.querySelector('textarea');
            if (textArea) {
              textArea.focus();
            }
          }
        }, 100);
      }
    }, [readonly]);

    const configManagerComponent = useMemo(() => {
      if (!selectedSkill?.configSchema?.items?.length || !setTplConfig) {
        return null;
      }

      // Create a stable key based on skill and config content
      const configKey = `${selectedSkill?.name}-${Object.keys(initialTplConfig).length}`;

      return (
        <ConfigManager
          key={configKey}
          form={form}
          formErrors={formErrors}
          setFormErrors={setFormErrors}
          schema={selectedSkill?.configSchema}
          tplConfig={initialTplConfig}
          fieldPrefix="tplConfig"
          configScope="runtime"
          onExpandChange={(_expanded) => {
            if (onInputHeightChange) {
              setTimeout(onInputHeightChange, 0);
            }
          }}
          resetConfig={() => {
            // Use setTimeout to move outside of React's render cycle
            setTimeout(() => {
              const defaultConfig = selectedSkill?.tplConfig ?? {};
              form.setFieldValue('tplConfig', defaultConfig);
            }, 0);
          }}
          onFormValuesChange={(_, allValues) => {
            // Debounce form value changes to prevent cascading updates
            const newConfig = allValues.tplConfig;
            if (JSON.stringify(newConfig) !== JSON.stringify(initialTplConfig)) {
              handleTplConfigChange(newConfig);
            }
          }}
        />
      );
    }, [
      selectedSkill?.configSchema,
      selectedSkill?.name,
      selectedSkill?.tplConfig,
      form,
      formErrors,
      initialTplConfig,
      setTplConfig,
      onInputHeightChange,
      handleTplConfigChange,
    ]);

    const renderContent = () => (
      <>
        <ContextManager
          className={classNames({
            'py-2': isList,
          })}
          contextItems={contextItems}
          setContextItems={setContextItems}
        />

        <ChatInput
          ref={chatInputRef}
          query={query}
          setQuery={(value) => {
            setQuery(value);
            if (onInputHeightChange) {
              setTimeout(onInputHeightChange, 0);
            }
          }}
          selectedSkillName={selectedSkill?.name}
          inputClassName="px-1 py-0"
          maxRows={20}
          handleSendMessage={handleSendMessage}
          handleSelectSkill={(skill) => {
            setQuery(query?.slice(0, -1));
            setSelectedSkill(skill);
          }}
          onUploadImage={handleImageUpload}
        />

        {configManagerComponent}

        <ChatActions
          className={classNames({
            'py-2': isList,
          })}
          query={query}
          model={modelInfo}
          setModel={setModelInfo}
          handleSendMessage={handleSendMessage}
          handleAbort={handleAbortAction}
          onUploadImage={handleImageUpload}
          contextItems={contextItems}
          runtimeConfig={runtimeConfig}
          setRuntimeConfig={setRuntimeConfig}
        />
      </>
    );

    if (isList) {
      return (
        <div className="relative w-full p-2" data-cy="launchpad-chat-panel">
          <div
            className={cn(
              'ai-copilot-chat-container chat-input-container rounded-[7px] overflow-hidden',
              'border border-gray-100 border-solid',
            )}
          >
            <SelectedSkillHeader
              skill={selectedSkill}
              setSelectedSkill={setSelectedSkill}
              onClose={() => setSelectedSkill(null)}
            />
            {subscriptionEnabled && !userProfile?.subscription && <PremiumBanner />}
            <div className={cn('px-3')}>{renderContent()}</div>
          </div>
        </div>
      );
    }

    return (
      <div
        className={`flex flex-col gap-3 h-full p-3 box-border ${className} max-w-[1024px] mx-auto`}
      >
        <NodeHeader
          readonly={readonly}
          selectedSkillName={selectedSkill?.name}
          setSelectedSkill={setSelectedSkill}
        />
        {renderContent()}
      </div>
    );
  },
);

ChatPanel.displayName = 'ChatPanel';
