import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Button, Switch, message } from 'antd';
import {
  AppstoreOutlined,
  BranchesOutlined,
  CodeOutlined,
  CloseOutlined,
  SlidersOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { serverOrigin } from '@refly/ui-kit';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import { WebhookDocsTab } from './components/webhook-docs-tab';
import { ApiDocsTab } from './components/api-docs-tab';
import { SkillDocsTab } from './components/skill-docs-tab';
import { ApiKeyModal } from './components/api-key-modal';
import { ApiOutputModal } from './components/api-output-modal';
import { CopyAllDocsButton } from './components/copy-all-docs-button';
import { apiDocsData } from './data/api-docs.generated';
import type { IntegrationType } from './types';
import './integration-docs-modal.scss';

interface WebhookConfig {
  webhookId: string;
  webhookUrl: string;
  isEnabled: boolean;
}

interface IntegrationDocsModalProps {
  canvasId: string;
  open: boolean;
  onClose: () => void;
}

interface TocSection {
  id: string;
  label: string;
  children?: TocSection[];
}

export const IntegrationDocsModal = memo(
  ({ canvasId, open, onClose }: IntegrationDocsModalProps) => {
    const { t } = useTranslation();
    const [activeIntegration, setActiveIntegration] = useState<IntegrationType>('webhook');
    const [activeSection, setActiveSection] = useState('');
    const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
    const [outputModalOpen, setOutputModalOpen] = useState(false);
    const [webhookConfig, setWebhookConfig] = useState<WebhookConfig | null>(null);
    const [webhookLoading, setWebhookLoading] = useState(false);
    const [webhookToggling, setWebhookToggling] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Table of contents sections based on active integration
    const apiEndpointSections = useMemo(() => {
      return apiDocsData.endpoints
        .filter(
          (endpoint) =>
            endpoint.path.startsWith('/openapi/') && !endpoint.path.includes('/webhook/'),
        )
        .map((endpoint) => ({
          id: `api-endpoint-${endpoint.operationId || endpoint.id}`,
          label: endpoint.summaryKey
            ? t(endpoint.summaryKey)
            : endpoint.summary || endpoint.operationId,
        }));
    }, [t]);

    const sections = useMemo((): TocSection[] => {
      switch (activeIntegration) {
        case 'webhook':
          return [
            { id: 'webhook-url', label: t('integration.sections.url') },
            { id: 'webhook-examples', label: t('integration.sections.examples') },
            { id: 'webhook-instructions', label: t('integration.sections.instructions') },
          ];
        case 'api':
          return [
            { id: 'api-overview', label: t('integration.sections.overview') },
            { id: 'api-best-practices', label: t('integration.sections.bestPractices') },
            {
              id: 'api-endpoints',
              label: t('integration.sections.endpoints'),
              children: apiEndpointSections,
            },
            { id: 'api-errors', label: t('integration.sections.errors') },
          ];
        case 'skill':
          return [{ id: 'skill-coming-soon', label: t('integration.sections.comingSoon') }];
        default:
          return [];
      }
    }, [activeIntegration, t, apiEndpointSections]);

    const flatSections = useMemo(() => {
      const flattened: TocSection[] = [];
      for (const section of sections) {
        flattened.push(section);
        if (section.children?.length) {
          flattened.push(...section.children);
        }
      }
      return flattened;
    }, [sections]);

    // Fetch webhook config when switching to webhook tab
    useEffect(() => {
      if (open && activeIntegration === 'webhook') {
        fetchWebhookConfig();
      }
    }, [open, activeIntegration, canvasId]);

    const fetchWebhookConfig = async () => {
      try {
        setWebhookLoading(true);
        const response = await getClient().getWebhookConfig({
          query: { canvasId },
        });
        const result = response.data;
        if (result?.success && result.data) {
          const { apiId, isEnabled } = result.data;
          const apiOrigin = serverOrigin || window.location.origin;
          setWebhookConfig({
            webhookId: apiId,
            webhookUrl: `${apiOrigin}/v1/openapi/webhook/${apiId}/run`,
            isEnabled,
          });
        } else {
          // No webhook config yet, set default state
          setWebhookConfig({
            webhookId: '',
            webhookUrl: '',
            isEnabled: false,
          });
        }
      } catch (error) {
        console.error('Failed to fetch webhook config:', error);
        // Set default state on error
        setWebhookConfig({
          webhookId: '',
          webhookUrl: '',
          isEnabled: false,
        });
      } finally {
        setWebhookLoading(false);
      }
    };

    const handleToggleWebhook = async (enabled: boolean) => {
      setWebhookToggling(true);
      try {
        const response = enabled
          ? await getClient().enableWebhook({ body: { canvasId } })
          : await getClient().disableWebhook({
              body: { webhookId: webhookConfig?.webhookId || '' },
            });

        const result = response.data;
        if (result?.success) {
          // Refetch config to get updated webhook ID and URL
          await fetchWebhookConfig();
          message.success(enabled ? t('webhook.enableSuccess') : t('webhook.disableSuccess'));
        } else {
          message.error(enabled ? t('webhook.enableFailed') : t('webhook.disableFailed'));
        }
      } catch (error) {
        console.error('Failed to toggle webhook:', error);
        message.error(enabled ? t('webhook.enableFailed') : t('webhook.disableFailed'));
      } finally {
        setWebhookToggling(false);
      }
    };

    // Reset state when modal closes
    useEffect(() => {
      if (!open) {
        setActiveIntegration('webhook');
        setActiveSection('');
        setApiKeyModalOpen(false);
        setOutputModalOpen(false);
      }
    }, [open]);

    // Set initial active section
    useEffect(() => {
      if (flatSections.length > 0 && !activeSection) {
        setActiveSection(flatSections[0].id);
      }
    }, [flatSections, activeSection]);

    // IntersectionObserver for TOC highlighting
    useEffect(() => {
      if (!open || !contentRef.current) return;

      const elements = flatSections
        .map((section) => document.getElementById(section.id))
        .filter(Boolean) as HTMLElement[];

      if (elements.length === 0) return;

      const observer = new IntersectionObserver(
        (entries) => {
          const visible = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
          if (visible[0]?.target instanceof HTMLElement) {
            setActiveSection(visible[0].target.id);
          }
        },
        {
          root: contentRef.current,
          rootMargin: '0px 0px -60% 0px',
          threshold: [0.1, 0.4, 0.7],
        },
      );

      for (const element of elements) {
        observer.observe(element);
      }
      return () => observer.disconnect();
    }, [open, flatSections]);

    const handleSectionSelect = (sectionId: string) => {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveSection(sectionId);
      }
    };

    const handleIntegrationChange = (type: IntegrationType) => {
      setActiveIntegration(type);
      setActiveSection('');
      if (type !== 'api') {
        setOutputModalOpen(false);
      }
    };

    const getModalContainer = (): HTMLElement => {
      return (document.querySelector('.canvas-container') as HTMLElement) || document.body;
    };

    const renderContent = () => {
      switch (activeIntegration) {
        case 'webhook':
          return (
            <WebhookDocsTab
              canvasId={canvasId}
              webhookConfig={webhookConfig}
              onToggleWebhook={handleToggleWebhook}
              toggling={webhookToggling}
              onWebhookReset={fetchWebhookConfig}
            />
          );
        case 'api':
          return <ApiDocsTab canvasId={canvasId} />;
        case 'skill':
          return <SkillDocsTab />;
        default:
          return null;
      }
    };

    return (
      <>
        <Modal
          open={open}
          onCancel={onClose}
          footer={null}
          title={null}
          width="100%"
          destroyOnClose
          closable={false}
          className="integration-docs-modal"
          wrapClassName="integration-docs-modal-wrap"
          getContainer={getModalContainer}
          style={{ top: 0, padding: 0 }}
          styles={{
            body: { height: '100%', padding: 0 },
            mask: { background: 'var(--refly-modal-mask)' },
          }}
        >
          <div className="integration-docs-layout">
            {/* Left sidebar - Integration navigation */}
            <aside className="integration-docs-nav">
              <div className="integration-docs-nav-title">{t('integration.navTitle')}</div>
              <div className="integration-docs-nav-list">
                <button
                  type="button"
                  className={`integration-docs-nav-item ${activeIntegration === 'skill' ? 'is-active' : ''}`}
                  onClick={() => handleIntegrationChange('skill')}
                >
                  <AppstoreOutlined />
                  <span>{t('integration.navSkill')}</span>
                </button>
                <button
                  type="button"
                  className={`integration-docs-nav-item ${activeIntegration === 'api' ? 'is-active' : ''}`}
                  onClick={() => handleIntegrationChange('api')}
                >
                  <CodeOutlined />
                  <span>{t('integration.navApi')}</span>
                </button>
                <button
                  type="button"
                  className={`integration-docs-nav-item ${activeIntegration === 'webhook' ? 'is-active' : ''}`}
                  onClick={() => handleIntegrationChange('webhook')}
                >
                  <BranchesOutlined />
                  <span>{t('integration.navWebhook')}</span>
                </button>
              </div>
            </aside>

            {/* Right content area with toolbar, main content, and toc */}
            <div className="integration-docs-right-wrapper">
              {/* Toolbar */}
              <div className="integration-docs-toolbar">
                <div className="integration-docs-toolbar-left">
                  {activeIntegration === 'api' ? (
                    <>
                      <Button type="primary" onClick={() => setApiKeyModalOpen(true)}>
                        {t('integration.manageApiKeys')}
                      </Button>
                      <Button icon={<SlidersOutlined />} onClick={() => setOutputModalOpen(true)}>
                        {t('integration.outputModal.button')}
                      </Button>
                    </>
                  ) : activeIntegration === 'webhook' ? (
                    <div className="webhook-toolbar-toggle">
                      <span className="webhook-toolbar-label">{t('webhook.enableWebhook')}</span>
                      <Switch
                        checked={webhookConfig?.isEnabled || false}
                        loading={webhookToggling}
                        onChange={handleToggleWebhook}
                        disabled={webhookLoading}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="integration-docs-toolbar-right">
                  <CopyAllDocsButton activeIntegration={activeIntegration} canvasId={canvasId} />
                  <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
                </div>
              </div>

              {/* Content area with main and toc */}
              <div className="integration-docs-body-wrapper">
                {/* Main content area */}
                <main className="integration-docs-main">
                  {/* Scrollable content */}
                  <div ref={contentRef} className="integration-docs-content">
                    {renderContent()}
                  </div>
                </main>

                {/* Right sidebar - Table of contents */}
                <aside className="integration-docs-toc">
                  <div className="integration-docs-toc-title">{t('integration.contents')}</div>
                  <nav className="integration-docs-toc-list">
                    {sections.map((section) => {
                      const childActive = section.children?.some(
                        (child) => child.id === activeSection,
                      );
                      return (
                        <div key={section.id} className="integration-docs-toc-group">
                          <button
                            type="button"
                            onClick={() => handleSectionSelect(section.id)}
                            className={`integration-docs-toc-item ${
                              activeSection === section.id || childActive ? 'is-active' : ''
                            }`}
                          >
                            {section.label}
                          </button>
                          {section.children?.length ? (
                            <div className="integration-docs-toc-sublist">
                              {section.children.map((child) => (
                                <button
                                  key={child.id}
                                  type="button"
                                  onClick={() => handleSectionSelect(child.id)}
                                  className={`integration-docs-toc-subitem ${
                                    activeSection === child.id ? 'is-active' : ''
                                  }`}
                                >
                                  {child.label}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </nav>
                </aside>
              </div>
            </div>
          </div>
        </Modal>

        {/* API Key Management Modal */}
        <ApiKeyModal open={apiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} />
        <ApiOutputModal
          open={outputModalOpen}
          onClose={() => setOutputModalOpen(false)}
          canvasId={canvasId}
        />
      </>
    );
  },
);

IntegrationDocsModal.displayName = 'IntegrationDocsModal';
