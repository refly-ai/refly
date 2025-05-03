import React, { useMemo } from 'react';
import { Button, Empty, Row, Col, Card } from 'antd';
import { useTranslation } from 'react-i18next';
import { IconPlus, IconTemplate } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useCreateCanvas } from '@refly-packages/ai-workspace-common/hooks/canvas/use-create-canvas';
import { useCanvasTemplateModalShallow } from '@refly-packages/ai-workspace-common/stores/canvas-template-modal';

interface DashboardProps {
  title?: string;
  showTemplates?: boolean;
  showRecentCanvases?: boolean;
}

export const Dashboard = React.memo(
  ({ title, showTemplates = true, showRecentCanvases = true }: DashboardProps) => {
    const { t } = useTranslation();
    const { debouncedCreateCanvas, isCreating } = useCreateCanvas();
    const { setVisible: setShowCanvasTemplateModal } = useCanvasTemplateModalShallow((state) => ({
      setVisible: state.setVisible,
    }));

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

    return (
      <div className="p-8">
        <Row gutter={[24, 24]}>
          {title && (
            <Col span={24}>
              <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">{title}</h1>
                <Button
                  type="primary"
                  onClick={debouncedCreateCanvas}
                  loading={isCreating}
                  icon={<IconPlus />}
                  data-cy="dashboard-create-button"
                >
                  {t('loggedHomePage.siderMenu.newCanvas', 'New Canvas')}
                </Button>
              </div>
            </Col>
          )}

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

Dashboard.displayName = 'Dashboard';
