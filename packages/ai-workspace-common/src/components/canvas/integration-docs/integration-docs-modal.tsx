import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Button, Switch, message } from 'antd';
import { AppstoreOutlined, BranchesOutlined, CodeOutlined, CloseOutlined } from '@ant-design/icons';
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
import { groupApiEndpoints } from './utils';
import ApiKeyIcon from '../../../assets/key-01.svg';
import OutputIcon from '../../../assets/target-04.svg';
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
    const pendingSectionRef = useRef<string | null>(null);
    const pendingIntegrationSectionRef = useRef<string | null>(null);
    const programmaticScrollRef = useRef(false);
    const scrollEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Table of contents sections based on active integration
    const apiEndpointSections = useMemo(() => {
      const publicEndpoints = apiDocsData.endpoints.filter(
        (endpoint) =>
          endpoint.path.startsWith('/openapi/') &&
          !endpoint.path.includes('/webhook/') &&
          !endpoint.path.startsWith('/openapi/config'),
      );
      const grouped = groupApiEndpoints(publicEndpoints);
      return grouped.map((group) => ({
        id: `api-endpoints-${group.key}`,
        label: t(`integration.api.endpointGroups.${group.key}`),
        children: group.endpoints.map((endpoint) => ({
          id: `api-endpoint-${endpoint.operationId || endpoint.id}`,
          label: endpoint.summaryKey
            ? t(endpoint.summaryKey)
            : endpoint.summary || endpoint.operationId,
        })),
      }));
    }, [t]);

    const sections = useMemo((): TocSection[] => {
      switch (activeIntegration) {
        case 'webhook':
          return [
            { id: 'webhook-url', label: t('integration.sections.url') },
            { id: 'webhook-request-body', label: t('integration.sections.requestBody') },
            { id: 'webhook-file-upload', label: t('integration.sections.fileUpload') },
            { id: 'webhook-examples', label: t('integration.sections.examples') },
            { id: 'webhook-instructions', label: t('integration.sections.instructions') },
            { id: 'webhook-errors', label: t('integration.sections.errors') },
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
          return [
            {
              id: 'skill-workflow',
              label: t('integration.sections.skillWorkflow'),
              children: [
                { id: 'skill-create', label: t('integration.skill.createSkillTitle') },
                { id: 'skill-update', label: t('integration.skill.updateSkillTitle') },
                { id: 'skill-publish', label: t('integration.skill.publishSkillTitle') },
                { id: 'skill-use', label: t('integration.skill.useSkillTitle') },
              ],
            },
            {
              id: 'skill-registry',
              label: t('integration.sections.skillRegistry'),
              children: [
                { id: 'skill-examples', label: t('integration.skill.examplesTitle') },
                { id: 'skill-install', label: t('integration.skill.installFromRepoTitle') },
                { id: 'skill-uninstall', label: t('integration.skill.uninstallSkillTitle') },
              ],
            },
          ];
        default:
          return [];
      }
    }, [activeIntegration, t, apiEndpointSections]);

    const flatSections = useMemo(() => {
      const flattened: TocSection[] = [];
      const walk = (items: TocSection[]) => {
        for (const item of items) {
          flattened.push(item);
          if (item.children?.length) {
            walk(item.children);
          }
        }
      };
      walk(sections);
      return flattened;
    }, [sections]);

    const getListClassName = (level: number) =>
      level === 0 ? 'flex flex-col gap-0.5' : 'flex flex-col gap-0.5 pl-2.5';

    const getItemClassName = (level: number) => {
      if (level === 0) {
        return 'text-left border-0 rounded-md cursor-pointer transition-colors duration-150 text-[var(--integration-docs-text-2)] hover:bg-[var(--integration-docs-hover-bg)] hover:text-[var(--integration-docs-text-1)] leading-[1.4] px-2.5 py-2 text-[13px]';
      }
      if (level === 1) {
        return 'text-left border-0 rounded-md cursor-pointer transition-colors duration-150 text-[var(--integration-docs-text-2)] hover:bg-[var(--integration-docs-hover-bg)] hover:text-[var(--integration-docs-text-1)] leading-[1.4] px-2.5 py-1.5 text-xs';
      }
      return 'text-left border-0 rounded-md cursor-pointer transition-colors duration-150 text-[var(--integration-docs-text-2)] hover:bg-[var(--integration-docs-hover-bg)] hover:text-[var(--integration-docs-text-1)] leading-[1.4] px-2.5 py-1 text-[11px]';
    };

    const getGroupClassName = (level: number) =>
      level === 0 ? 'flex flex-col gap-1' : 'flex flex-col gap-0.5';

    const renderTocList = (items: TocSection[], level = 0) => (
      <div className={getListClassName(level)}>
        {items.map((section) => {
          const isActive = section.id === activeSection;
          return (
            <div key={section.id} className={getGroupClassName(level)}>
              <button
                type="button"
                onClick={() => handleSectionSelect(section.id)}
                className={`${getItemClassName(level)} ${
                  isActive
                    ? 'bg-[var(--integration-docs-hover-bg)] text-[var(--integration-docs-text-1)] font-medium'
                    : ''
                }`}
              >
                {section.label}
              </button>
              {section.children?.length ? renderTocList(section.children, level + 1) : null}
            </div>
          );
        })}
      </div>
    );

    // Fetch webhook config when switching to webhook tab
    useEffect(() => {
      if (open && activeIntegration === 'webhook') {
        fetchWebhookConfig();
      }
    }, [open, activeIntegration, canvasId]);

    const clearScrollTimer = useCallback(() => {
      if (scrollEndTimeoutRef.current) {
        clearTimeout(scrollEndTimeoutRef.current);
        scrollEndTimeoutRef.current = null;
      }
    }, []);

    const finalizeProgrammaticScroll = useCallback(() => {
      programmaticScrollRef.current = false;
      if (pendingSectionRef.current) {
        setActiveSection(pendingSectionRef.current);
        pendingSectionRef.current = null;
      }
    }, []);

    const fetchWebhookConfig = async () => {
      try {
        setWebhookLoading(true);
        const response = await getClient().getWebhookConfig({
          query: { canvasId },
        });
        const result = response.data;
        if (result?.success && result.data) {
          const { webhookId, isEnabled } = result.data;
          const apiOrigin = serverOrigin || window.location.origin;
          setWebhookConfig({
            webhookId,
            webhookUrl: `${apiOrigin}/v1/openapi/webhook/${webhookId}/run`,
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
          if (programmaticScrollRef.current) {
            return;
          }
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

    useEffect(() => {
      const container = contentRef.current;
      if (!container) return;

      const handleScroll = () => {
        if (!programmaticScrollRef.current) return;
        clearScrollTimer();
        scrollEndTimeoutRef.current = setTimeout(() => {
          finalizeProgrammaticScroll();
          clearScrollTimer();
        }, 150);
      };

      container.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        container.removeEventListener('scroll', handleScroll);
        clearScrollTimer();
      };
    }, [clearScrollTimer, finalizeProgrammaticScroll]);

    const handleSectionSelect = useCallback(
      (sectionId: string) => {
        const element = document.getElementById(sectionId);
        if (element) {
          pendingSectionRef.current = sectionId;
          programmaticScrollRef.current = true;
          clearScrollTimer();
          setActiveSection(sectionId);
          element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          scrollEndTimeoutRef.current = setTimeout(() => {
            finalizeProgrammaticScroll();
            clearScrollTimer();
          }, 150);
        }
      },
      [clearScrollTimer, finalizeProgrammaticScroll, setActiveSection],
    );

    useEffect(() => {
      if (!open || !pendingIntegrationSectionRef.current) return;
      const targetId = pendingIntegrationSectionRef.current;
      pendingIntegrationSectionRef.current = null;
      let attempts = 0;
      const tryScroll = () => {
        const element = document.getElementById(targetId);
        if (element) {
          handleSectionSelect(targetId);
          return;
        }
        attempts += 1;
        if (attempts < 12) {
          requestAnimationFrame(tryScroll);
        }
      };
      requestAnimationFrame(tryScroll);
    }, [open, activeIntegration, sections, handleSectionSelect]);

    const handleIntegrationChange = (type: IntegrationType) => {
      setActiveIntegration(type);
      setActiveSection('');
      if (type !== 'api') {
        setOutputModalOpen(false);
      }
    };

    const handleNavigateToIntegrationSection = (type: IntegrationType, sectionId: string) => {
      pendingIntegrationSectionRef.current = sectionId;
      handleIntegrationChange(type);
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
              onNavigateToApiSection={(sectionId) =>
                handleNavigateToIntegrationSection('api', sectionId)
              }
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
          className="integration-docs-modal !max-w-none !w-full !h-[calc(100vh-50px)] !p-0"
          wrapClassName="integration-docs-modal-wrap !top-[50px] left-0 right-0 bottom-0 !h-[calc(100vh-50px)] !overflow-hidden"
          getContainer={getModalContainer}
          style={{ top: 0, padding: 0, height: 'calc(100vh - 50px)' }}
          styles={{
            content: {
              height: 'calc(100vh - 50px)',
              width: '100%',
              padding: 0,
              borderRadius: 0,
              overflow: 'hidden',
              boxShadow: 'none',
            },
            body: { height: 'calc(100vh - 50px)', padding: 0, overflow: 'hidden' },
            mask: {
              background: 'var(--refly-modal-mask)',
              top: 50,
              height: 'calc(100% - 50px)',
            },
          }}
        >
          <div className="flex flex-row h-full w-full bg-[var(--integration-docs-bg)] overflow-hidden">
            {/* Left sidebar - Integration navigation */}
            <aside className="hidden lg:flex w-[220px] py-5 px-4 border-r border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg-subtle)] flex-shrink-0 flex-col overflow-y-auto overflow-x-hidden">
              <div className="text-xs font-medium text-[var(--integration-docs-text-3)] uppercase tracking-wide mb-4 px-2.5">
                {t('integration.navTitle')}
              </div>
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-0 text-sm text-[var(--integration-docs-text-2)] text-left cursor-pointer transition-colors duration-150 hover:bg-[var(--integration-docs-hover-bg)] hover:text-[var(--integration-docs-text-1)] ${
                    activeIntegration === 'skill'
                      ? 'bg-[var(--integration-docs-hover-bg)] text-[var(--integration-docs-text-1)] font-medium'
                      : ''
                  }`}
                  onClick={() => handleIntegrationChange('skill')}
                >
                  <AppstoreOutlined className="text-base" />
                  <span>{t('integration.navSkill')}</span>
                </button>
                <button
                  type="button"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-0 text-sm text-[var(--integration-docs-text-2)] text-left cursor-pointer transition-colors duration-150 hover:bg-[var(--integration-docs-hover-bg)] hover:text-[var(--integration-docs-text-1)] ${
                    activeIntegration === 'api'
                      ? 'bg-[var(--integration-docs-hover-bg)] text-[var(--integration-docs-text-1)] font-medium'
                      : ''
                  }`}
                  onClick={() => handleIntegrationChange('api')}
                >
                  <CodeOutlined className="text-base" />
                  <span>{t('integration.navApi')}</span>
                </button>
                <button
                  type="button"
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border-0 text-sm text-[var(--integration-docs-text-2)] text-left cursor-pointer transition-colors duration-150 hover:bg-[var(--integration-docs-hover-bg)] hover:text-[var(--integration-docs-text-1)] ${
                    activeIntegration === 'webhook'
                      ? 'bg-[var(--integration-docs-hover-bg)] text-[var(--integration-docs-text-1)] font-medium'
                      : ''
                  }`}
                  onClick={() => handleIntegrationChange('webhook')}
                >
                  <BranchesOutlined className="text-base" />
                  <span>{t('integration.navWebhook')}</span>
                </button>
              </div>
            </aside>

            {/* Right content area with toolbar, main content, and toc */}
            <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
              {/* Toolbar */}
              <div className="flex items-center justify-between py-3 px-4 md:px-6 border-b border-[var(--integration-docs-border)] bg-[var(--integration-docs-toolbar-bg)] backdrop-blur-[8px] flex-shrink-0 z-[3]">
                <div className="flex items-center gap-3">
                  {activeIntegration === 'api' ? (
                    <>
                      <Button type="primary" onClick={() => setApiKeyModalOpen(true)}>
                        <img
                          src={ApiKeyIcon}
                          alt=""
                          className="w-4 h-4 mr-2 inline-block align-middle"
                        />
                        {t('integration.manageApiKeys')}
                      </Button>
                      <Button onClick={() => setOutputModalOpen(true)}>
                        <img
                          src={OutputIcon}
                          alt=""
                          className="w-4 h-4 mr-2 inline-block align-middle"
                        />
                        {t('integration.outputModal.button')}
                      </Button>
                    </>
                  ) : activeIntegration === 'webhook' ? (
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-[var(--integration-docs-text-1)]">
                        {t('webhook.enableWebhook')}
                      </span>
                      <Switch
                        checked={webhookConfig?.isEnabled || false}
                        loading={webhookToggling}
                        onChange={handleToggleWebhook}
                        disabled={webhookLoading}
                      />
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <CopyAllDocsButton activeIntegration={activeIntegration} canvasId={canvasId} />
                  <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
                </div>
              </div>

              {/* Content area with main and toc */}
              <div className="flex flex-1 min-h-0 overflow-hidden">
                {/* Main content area */}
                <main className="flex-1 min-w-0 flex flex-col min-h-0 overflow-hidden bg-[linear-gradient(180deg,var(--integration-docs-bg)_0%,var(--integration-docs-bg-subtle)_100%)]">
                  {/* Scrollable content */}
                  <div
                    ref={contentRef}
                    className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden scroll-smooth"
                  >
                    {renderContent()}
                  </div>
                </main>

                {/* Right sidebar - Table of contents */}
                <aside className="hidden lg:flex flex-col w-[240px] py-5 px-4 border-l border-[var(--integration-docs-border)] bg-[var(--integration-docs-bg)] flex-shrink-0 overflow-y-auto overflow-x-hidden">
                  <div className="text-xs font-medium text-[var(--integration-docs-text-3)] uppercase tracking-wide mb-4 px-2.5">
                    {t('integration.contents')}
                  </div>
                  <nav>{renderTocList(sections)}</nav>
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
