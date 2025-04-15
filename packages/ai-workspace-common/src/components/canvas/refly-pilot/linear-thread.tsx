import { memo, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Avatar, Divider } from 'antd';
import { SkillResponseNodePreview } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/skill-response';
import { LinearThreadMessage } from '@refly-packages/ai-workspace-common/stores/canvas';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { AiOutlineUser } from 'react-icons/ai';

interface LinearThreadContentProps {
  messages: LinearThreadMessage[];
  contentHeight: string | number;
  className?: string;
}

// Optimize SkillResponseNodePreview with memo
const MemoizedSkillResponseNodePreview = memo(SkillResponseNodePreview, (prevProps, nextProps) => {
  return (
    prevProps.resultId === nextProps.resultId &&
    prevProps.node.data?.entityId === nextProps.node.data?.entityId
  );
});

MemoizedSkillResponseNodePreview.displayName = 'MemoizedSkillResponseNodePreview';

const EmptyThreadWelcome = memo(() => {
  const { t } = useTranslation();
  const { userProfile } = useUserStoreShallow((state) => ({
    userProfile: state.userProfile,
  }));

  return (
    <div className="flex flex-col items-center justify-center h-full px-6 py-8 text-gray-700">
      <div className="w-full max-w-lg mx-auto rounded-xl overflow-hidden p-6">
        <div className="flex items-center justify-center mb-6">
          <div className="relative">
            <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-primary-300 to-primary-600 opacity-75 blur-sm" />
            <Avatar
              size={64}
              src={userProfile?.avatar}
              className="relative border-2 border-white shadow-md"
              icon={<AiOutlineUser />}
            />
          </div>
        </div>

        <h3 className="text-xl font-semibold text-center text-gray-800 mb-1">
          {t('canvas.reflyPilot.welcome.title', { name: userProfile?.nickname || '' })}
        </h3>

        <p className="text-base text-center text-gray-600 mb-6">
          {t('canvas.reflyPilot.welcome.subtitle')}
        </p>
      </div>
    </div>
  );
});

EmptyThreadWelcome.displayName = 'EmptyThreadWelcome';

export const LinearThreadContent = memo(
  ({ messages, contentHeight, className = '' }: LinearThreadContentProps) => {
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Scroll to bottom effect
    useEffect(() => {
      if (messagesContainerRef.current) {
        setTimeout(() => {
          if (messagesContainerRef.current) {
            messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
          }
        }, 100);
      }
    }, [messages]);

    return (
      <div
        ref={messagesContainerRef}
        className={`flex-grow overflow-auto message-container ${className}`}
        style={{ height: contentHeight, width: '100%' }}
      >
        {messages.length === 0 ? (
          <EmptyThreadWelcome key={'empty-thread-welcome'} />
        ) : (
          <div className="flex flex-col divide-y max-w-[1024px] mx-auto">
            {messages.map((message, index) => (
              <div key={`message-wrapper-${message.id}`}>
                <div key={`message-content-${message.id}`}>
                  <MemoizedSkillResponseNodePreview
                    node={{
                      id: message.nodeId,
                      type: 'skillResponse',
                      position: { x: 0, y: 0 },
                      data: message.data,
                    }}
                    resultId={message.resultId}
                  />
                </div>
                {index !== messages.length - 1 && (
                  <Divider key={`divider-${message.id}`} className="max-w-[1024px] mx-auto" />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);

LinearThreadContent.displayName = 'LinearThreadContent';
