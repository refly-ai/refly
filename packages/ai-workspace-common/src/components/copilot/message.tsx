import { useNavigate } from 'react-router-dom';
import { Markdown } from '@refly-packages/ai-workspace-common/components/markdown';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { ChatMessage, Source } from '@refly/openapi-schema';
import { copyToClipboard } from '@refly-packages/ai-workspace-common/utils';
import {
  Avatar,
  Button,
  Spin,
  Message,
  Dropdown,
  Menu,
  Skeleton,
  Collapse,
  Divider,
  Typography,
} from '@arco-design/web-react';
import { IconBook, IconCaretDown, IconCheckCircle, IconCopy, IconImport } from '@arco-design/web-react/icon';
import { MdOutlineToken } from 'react-icons/md';
import { useTranslation } from 'react-i18next';
// 自定义组件
import { SkillAvatar } from '@refly-packages/ai-workspace-common/components/skill/skill-avatar';
import { SourceList } from '@refly-packages/ai-workspace-common/components/source-list';
import { safeParseJSON } from '../../utils/parse';
import { EditorOperation, editorEmitter } from '@refly-packages/utils/event-emitter/editor';
import { useSkillStoreShallow } from '@refly-packages/ai-workspace-common/stores/skill';
import { ContextItem } from '@refly-packages/ai-workspace-common/components/copilot/copilot-operation-module/context-manager/context-item';
import { ContextPreview } from '@refly-packages/ai-workspace-common/components/copilot/copilot-operation-module/context-manager/context-preview';

import { ClientChatMessage, Mark } from '@refly/common-types';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { memo } from 'react';
import classNames from 'classnames';
import { parseMarkdownCitationsAndCanvasTags } from '@refly/utils/parse';
import { useState, useEffect } from 'react';
import { getRuntime } from '@refly-packages/ai-workspace-common/utils/env';
import { useProcessContextItems } from '@refly-packages/ai-workspace-common/components/copilot/copilot-operation-module/context-manager/hooks/use-process-context-items';

// utils
import { processWithCanvas } from './utils';

export const HumanMessage = memo(
  (props: { message: Partial<ChatMessage>; profile: { avatar: string; name: string }; disable?: boolean }) => {
    const { message, profile } = props;
    const context = message?.invokeParam?.context || {};
    const [activeItem, setActiveItem] = useState<Mark | null>(null);

    const { processContextItemsFromMessage } = useProcessContextItems();
    const contextItems = processContextItemsFromMessage(context);

    return (
      <div className="ai-copilot-message human-message-container">
        <div className="human-message">
          <div className="message-name-and-content">
            <span className="message-name">{profile?.name}</span>
            <div className="human-message-content">
              <Markdown content={message?.content as string} msgId={message?.msgId} />
            </div>

            {contextItems.length > 0 && (
              <div className="context-items-container">
                {contextItems.map((item) => (
                  <ContextItem
                    canNotRemove={true}
                    key={item.id}
                    item={item}
                    isLimit={false}
                    isActive={activeItem && activeItem.id === item.id}
                    onToggle={() => {
                      setActiveItem(activeItem?.id === item.id ? null : item);
                    }}
                  />
                ))}
              </div>
            )}

            {activeItem && (
              <ContextPreview
                canNotRemove={true}
                item={activeItem}
                onClose={() => setActiveItem(null)}
                onOpenUrl={(url) => {
                  if (typeof url === 'function') {
                    url(); // 执行跳转函数
                  } else {
                    window.open(url, '_blank'); // 打开外部链接
                  }
                }}
              />
            )}
          </div>
          <div className="message-avatar">
            <Avatar size={32}>
              <img src={profile?.avatar} />
            </Avatar>
          </div>
        </div>
      </div>
    );
  },
);

const CollapseItem = Collapse.Item;

export const AssistantMessage = memo(
  (props: {
    message: Partial<ClientChatMessage>;
    humanMessage?: Partial<ClientChatMessage>;
    isPendingFirstToken: boolean;
    isPending: boolean;
    isLastSession: boolean;
    disable?: boolean;
    handleAskFollowing: (question?: string) => void;
  }) => {
    const {
      message,
      isPendingFirstToken = false,
      isPending,
      isLastSession = false,
      disable,
      humanMessage,
      handleAskFollowing,
    } = props;
    const runtime = getRuntime();
    const isWeb = runtime === 'web';

    const editorActionList = [
      {
        icon: <IconImport style={{ fontSize: 14 }} />,
        key: 'insertBlow',
      },
      {
        icon: <IconCheckCircle style={{ fontSize: 14 }} />,
        key: 'replaceSelection',
      },
      {
        icon: <IconBook style={{ fontSize: 14 }} />,
        key: 'createNewNote',
      },
    ];

    const { t } = useTranslation();
    const { editor: noteStoreEditor, isCreatingNewCanvasOnHumanMessage } = useCanvasStoreShallow((state) => ({
      editor: state.editor,
      isCreatingNewCanvasOnHumanMessage: state.isCreatingNewCanvasOnHumanMessage,
    }));

    let sources =
      typeof message?.structuredData?.['sources'] === 'string'
        ? safeParseJSON(message?.structuredData?.['sources'])
        : (message?.structuredData?.['sources'] as Source[]);
    let relatedQuestions =
      typeof message?.structuredData?.['relatedQuestions'] === 'string'
        ? safeParseJSON(message?.structuredData?.['relatedQuestions'])
        : (message?.structuredData?.['relatedQuestions'] as Array<string>);

    const profile = {
      name: message?.skillMeta?.displayName,
      avatar: message?.skillMeta?.displayName,
      icon: message?.skillMeta?.icon,
    };

    const handleEditorOperation = (type: EditorOperation, content: string) => {
      const parsedContent = parseMarkdownCitationsAndCanvasTags(content, sources);

      if (type === 'insertBlow' || type === 'replaceSelection') {
        const editor = noteStoreEditor;

        if (!editor) return;

        const selection = editor.view?.state?.selection;

        if (selection) {
          editor
            .chain()
            .focus()
            .insertContentAt(
              {
                from: selection.from,
                to: selection.to,
              },
              parsedContent,
            )
            .run();
        }
      } else if (type === 'createNewNote') {
        editorEmitter.emit('createNewNote', parsedContent);
      }
    };

    const tokenUsageDropdownList = (
      <Menu>
        {message?.tokenUsage?.map((item, index) => (
          <Menu.Item key={'token-usage-' + index}>
            <div className="flex items-center">
              <span>
                {item?.modelName}:{' '}
                {t('copilot.tokenUsage', {
                  inputCount: item?.inputTokens,
                  outputCount: item?.outputTokens,
                })}
              </span>
            </div>
          </Menu.Item>
        ))}
      </Menu>
    );
    const [tokenUsage, setTokenUsage] = useState(0);

    useEffect(() => {
      let total = 0;
      (message?.tokenUsage || []).forEach((item) => {
        total += (item?.inputTokens || 0) + (item?.outputTokens || 0);
      });
      setTokenUsage(total);
    }, [message.tokenUsage]);

    return (
      <div className="ai-copilot-message assistant-message-container">
        <div className="assistant-message">
          <>
            <div className="message-avatar">
              <SkillAvatar
                icon={profile?.icon}
                size={32}
                shape="circle"
                displayName={profile?.name || t('copilot.reflyAssistant')}
              />
            </div>
            <div className="message-name-and-content">
              <span className="message-name">{profile?.name || t('copilot.reflyAssistant')}</span>
              <div className="assistant-message-content">
                <Collapse bordered={false} expandIconPosition="right">
                  <CollapseItem
                    className={classNames('message-log-collapse-container')}
                    header={
                      message?.pending ? (
                        <div className="message-log-collapse-header">
                          <Spin size={12} />
                          <Typography.Ellipsis className="message-log-content">
                            {message?.logs?.length > 0
                              ? message?.logs?.[message?.logs?.length - 1]
                              : t('copilot.message.skillRunning')}
                          </Typography.Ellipsis>
                        </div>
                      ) : (
                        <div className="message-log-collapse-header">
                          <IconCheckCircle style={{ fontSize: 12, color: 'green' }} />
                          <Typography.Ellipsis className={classNames('message-log-content')}>
                            {t('copilot.message.skillRunSuccess', {
                              count: message?.logs?.length || 0,
                            })}
                          </Typography.Ellipsis>
                        </div>
                      )
                    }
                    name="1"
                  >
                    {message?.logs?.length > 0 ? (
                      <div className="message-log-container">
                        {message?.logs?.map((log, index) => (
                          <div className="message-log-item" key={index}>
                            <IconCheckCircle style={{ fontSize: 12, color: 'green' }} />
                            <Typography.Ellipsis className="message-log-content">{log}</Typography.Ellipsis>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </CollapseItem>
                </Collapse>
                <div className="session-source">
                  {(sources || [])?.length > 0 ? (
                    <div className="session-title-icon">
                      <p>{t('threadDetail.item.session.source')}</p>
                    </div>
                  ) : null}
                  <SourceList
                    isPendingFirstToken={isPendingFirstToken}
                    sources={sources || []}
                    isLastSession={isLastSession}
                    humanMessage={humanMessage}
                    aiMessage={message}
                  />
                </div>
                {(sources || [])?.length > 0 ? (
                  <Divider
                    style={{
                      borderBottomStyle: 'dashed',
                      margin: '12px 0',
                    }}
                  />
                ) : null}
                {isLastSession && isPendingFirstToken ? (
                  <Skeleton animation text={{ width: '90%' }}></Skeleton>
                ) : (
                  <Markdown
                    content={processWithCanvas(message?.content as string)}
                    sources={sources}
                    msgId={message?.msgId}
                  />
                )}
                {(relatedQuestions || [])?.length > 0 ? (
                  <Divider
                    style={{
                      borderBottomStyle: 'dashed',
                      margin: '12px 0',
                    }}
                  />
                ) : null}
                {(relatedQuestions || []).length > 0 ? (
                  <div className="ai-copilot-related-question-container">
                    {(relatedQuestions || [])?.length > 0 ? (
                      <div className="session-title-icon">
                        <p>{t('copilot.message.relatedQuestion')}</p>
                      </div>
                    ) : null}
                    <div className="ai-copilot-related-question-list">
                      {relatedQuestions?.map((item, index) => (
                        <div
                          className="ai-copilot-related-question-item"
                          key={index}
                          onClick={() => handleAskFollowing(item)}
                        >
                          <p className="ai-copilot-related-question-title">{item}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="ai-copilot-answer-action-container">
                {tokenUsage > 0 ? (
                  <div className="ai-copilot-answer-token-usage">
                    <Dropdown droplist={tokenUsageDropdownList}>
                      <Button
                        type="text"
                        icon={<MdOutlineToken style={{ fontSize: 14 }} />}
                        className={'assist-action-item'}
                      >
                        {tokenUsage} Tokens
                      </Button>
                    </Dropdown>
                  </div>
                ) : null}
                {!disable && (!isPending || !isLastSession) && (
                  <div className="session-answer-actionbar">
                    <div className="session-answer-actionbar-left">
                      <Button
                        type="text"
                        icon={<IconCopy style={{ fontSize: 14 }} />}
                        style={{ color: '#64645F' }}
                        className={'assist-action-item'}
                        onClick={() => {
                          const parsedText = parseMarkdownCitationsAndCanvasTags(message?.content, sources);
                          copyToClipboard(parsedText || '');
                          Message.success(t('copilot.message.copySuccess'));
                        }}
                      >
                        <span className="action-text">{t('copilot.message.copy')}</span>
                      </Button>
                      {isWeb
                        ? editorActionList.map((item) => (
                            <Button
                              loading={item.key === 'createNewNote' && isCreatingNewCanvasOnHumanMessage}
                              type="text"
                              className={'assist-action-item'}
                              icon={item.icon}
                              style={{ color: '#64645F' }}
                              onClick={() => {
                                const parsedText = parseMarkdownCitationsAndCanvasTags(message?.content, sources);
                                handleEditorOperation(item.key as EditorOperation, parsedText || '');
                              }}
                            >
                              <span className="action-text">{t(`copilot.message.${item.key}`)}</span>
                            </Button>
                          ))
                        : null}
                    </div>
                    <div className="session-answer-actionbar-right"></div>
                  </div>
                )}
              </div>
            </div>
          </>
        </div>
      </div>
    );
  },
);

export const PendingMessage = () => {
  return (
    <div className="ai-copilot-message assistant-message-container">
      <div className="assistant-message">
        <Spin dot size={4} />
      </div>
    </div>
  );
};

export const WelcomeMessage = () => {
  const navigate = useNavigate();
  const userStore = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));
  const skillStore = useSkillStoreShallow((state) => ({
    skillInstances: state.skillInstances,
    isFetchingSkillInstances: state.isFetchingSkillInstances,
    setSkillManagerModalVisible: state.setSkillManagerModalVisible,
  }));

  const { skillInstances = [] } = skillStore;
  // const needInstallSkillInstance = skillInstances?.length === 0 && !skillStore?.isFetchingSkillInstances;
  const needInstallSkillInstance = false; // hide skill install hint

  const { t } = useTranslation();

  return (
    <div className="ai-copilot-message welcome-message-container">
      <div className="welcome-message">
        <div className="welcome-message-user-container">
          {userStore?.userProfile?.avatar ? (
            <div className="user-container-avatar" style={{ marginRight: 12 }}>
              <Avatar>
                <img src={userStore?.userProfile?.avatar || ''} />
              </Avatar>
            </div>
          ) : null}
          {userStore?.userProfile?.nickname ? (
            <div className="user-container-title">
              {t('copilot.greeting', { name: userStore?.userProfile?.nickname })}
            </div>
          ) : null}
        </div>
        <div className="welcome-message-text">{t('welcomeMessage')}</div>
        {needInstallSkillInstance && (
          <div className="skill-onboarding">
            {skillInstances?.length === 0 ? (
              <div className="install-skill-hint">
                <div className="install-skill-hint-container">
                  <div className="install-skill-hint-title">
                    {t('copilot.message.installSkillHint')}
                    <Button
                      type="text"
                      onClick={() => {
                        navigate('/skill?tab=template');
                      }}
                    >
                      {t('copilot.message.installSkillHintTitle')}
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
