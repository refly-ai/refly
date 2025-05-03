import React, { useMemo, useCallback, useRef } from 'react';
import { Button, Empty, Row, Col, Card } from 'antd';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconTemplate } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { useCanvasTemplateModalShallow } from '@refly-packages/ai-workspace-common/stores/canvas-template-modal';
import { useUserStoreShallow } from '@refly-packages/ai-workspace-common/stores/user';
import { cn } from '@refly/utils/cn';
import { LaunchPad } from './launchpad';
import { useCanvasStoreShallow } from '@refly-packages/ai-workspace-common/stores/canvas';
import { SkillTemplateConfig } from '@refly/openapi-schema';
import { CanvasProvider } from '@refly-packages/ai-workspace-common/context/canvas';
import { ReactFlowProvider } from '@xyflow/react';

interface DashboardProps {
  title?: string;
  showTemplates?: boolean;
  showRecentCanvases?: boolean;
}

const DashboardComp = React.memo(
  ({ showTemplates = true, showRecentCanvases = true }: DashboardProps) => {
    const { t } = useTranslation();
    const { debouncedCreateCanvas, isCreating } = useCreateCanvas();
    const { setVisible: setShowCanvasTemplateModal } = useCanvasTemplateModalShallow((state) => ({
      setVisible: state.setVisible,
    }));
    const userProfile = useUserStoreShallow((state) => state.userProfile);
    const { tplConfig, setTplConfig } = useCanvasStoreShallow((state) => ({
      setShowReflyPilot: state.setShowReflyPilot,
      linearThreadMessages: state.linearThreadMessages,
      addLinearThreadMessage: state.addLinearThreadMessage,
      clearLinearThreadMessages: state.clearLinearThreadMessages,
      tplConfig: state.tplConfig,
      setTplConfig: state.setTplConfig,
    }));
    const tplConfigRef = useRef<SkillTemplateConfig | null>(null);

    // Sample template categories
    const templateCategories = useMemo(
      () => [
        { id: 'recent', name: t('home.templateCategories.recent', 'Recent') },
        { id: 'popular', name: t('home.templateCategories.popular', 'Popular') },
        { id: 'ai', name: t('home.templateCategories.ai', 'AI') },
        { id: 'business', name: t('home.templateCategories.business', 'Business') },
      ],
      [t],
    );

    // Username for greeting
    const username = useMemo(() => {
      if (!userProfile) return 'there';
      return userProfile.nickname ?? 'there';
    }, [userProfile]);

    // Generate message IDs for ChatPanel
    const handleGenerateMessageIds = useCallback(() => {
      return {
        resultId: `dashboard-${Date.now()}`,
        nodeId: `node-${Date.now()}`,
      };
    }, []);

    // Handler for updating tplConfig
    const handleUpdateTplConfig = useCallback(
      (config: SkillTemplateConfig | null) => {
        // Only update if config has changed
        if (JSON.stringify(config) !== JSON.stringify(tplConfigRef.current)) {
          tplConfigRef.current = config;
          setTplConfig(config);
        }
      },
      [setTplConfig],
    );

    return (
      <div className="w-full max-w-[800px] mx-auto mt-[100px]">
        <Row gutter={[24, 24]}>
          {/* Welcome Section with Chat Panel */}
          <Col span={24}>
            <div className="mb-6 rounded-lg p-6 shadow-sm">
              <h2 className="text-2xl font-semibold mb-4 p-[0.5em]">
                {t('home.welcomeMessage', 'Hello')} {username},{' '}
                {t('home.howCanIHelp', 'How can I help you today?')}
              </h2>

              <div className="border border-gray-200 rounded-lg mb-4">
                <LaunchPad
                  visible={true}
                  inReflyPilot={true}
                  onGenerateMessageIds={handleGenerateMessageIds}
                  onAddMessage={(message, queryText) => {
                    console.log('Message added:', message, 'Query:', queryText);
                  }}
                  tplConfig={tplConfig}
                  onUpdateTplConfig={handleUpdateTplConfig}
                />
              </div>

              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  '今天发生了什么新鲜事?',
                  '总结我昨天做了什么?',
                  '今天发生了什么新鲜事?',
                  '换一批',
                ].map((suggestion, index) => (
                  <Button
                    key={index}
                    size="middle"
                    className={cn(
                      'border border-gray-200 hover:border-gray-300',
                      'text-gray-600 hover:text-gray-800',
                    )}
                    onClick={() => {
                      // Set the query in the chat store since ChatPanel uses it
                      const {
                        useChatStore,
                      } = require('@refly-packages/ai-workspace-common/stores/chat');
                      useChatStore.getState().setNewQAText(suggestion);
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </div>
          </Col>

          {showTemplates && (
            <Col span={24}>
              <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-xl font-semibold">
                    {t('loggedHomePage.siderMenu.template', 'Templates')}
                  </h2>
                  <Button
                    type="text"
                    onClick={() => setShowCanvasTemplateModal(true)}
                    className="text-green-600 hover:text-green-700"
                  >
                    {t('common.viewAll', 'View All')}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {templateCategories.map((category) => (
                    <Card
                      key={category.id}
                      hoverable
                      className="cursor-pointer"
                      onClick={() => setShowCanvasTemplateModal(true)}
                    >
                      <div className="flex items-center gap-3">
                        <IconTemplate className="text-green-600" style={{ fontSize: 20 }} />
                        <span className="font-medium">{category.name}</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            </Col>
          )}

          {showRecentCanvases && (
            <Col span={24}>
              <div className="mb-6">
                <h2 className="text-xl font-semibold mb-4">
                  {t('home.recentCanvases', 'Recent Canvases')}
                </h2>
                <Empty
                  className="bg-gray-50 p-6 rounded-lg"
                  description={t('home.noRecentCanvases', 'No recent canvases')}
                >
                  <Button
                    type="primary"
                    onClick={debouncedCreateCanvas}
                    loading={isCreating}
                    icon={<IconPlus />}
                  >
                    {t('loggedHomePage.siderMenu.newCanvas', 'New Canvas')}
                  </Button>
                </Empty>
              </div>
            </Col>
          )}
        </Row>
      </div>
    );
  },
);

export const Dashboard = (props: DashboardProps) => {
  return (
    <ReactFlowProvider>
      <CanvasProvider readonly={false} canvasId={''}>
        <DashboardComp {...props} />
      </CanvasProvider>
    </ReactFlowProvider>
  );
};

Dashboard.displayName = 'Dashboard';
