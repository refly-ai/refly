import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Button } from 'antd';
import { AppstoreOutlined, BranchesOutlined, CodeOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { WebhookDocsTab } from './components/webhook-docs-tab';
import { ApiDocsTab } from './components/api-docs-tab';
import { SkillDocsTab } from './components/skill-docs-tab';
import { ApiKeyModal } from './components/api-key-modal';
import { CopyAllDocsButton } from './components/copy-all-docs-button';
import type { IntegrationType } from './types';
import './integration-docs-modal.scss';

interface IntegrationDocsModalProps {
  canvasId: string;
  open: boolean;
  onClose: () => void;
}

interface TocSection {
  id: string;
  label: string;
}

export const IntegrationDocsModal = memo(
  ({ canvasId, open, onClose }: IntegrationDocsModalProps) => {
    const { t } = useTranslation();
    const [activeIntegration, setActiveIntegration] = useState<IntegrationType>('webhook');
    const [activeSection, setActiveSection] = useState('');
    const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Table of contents sections based on active integration
    const sections = useMemo((): TocSection[] => {
      switch (activeIntegration) {
        case 'webhook':
          return [
            { id: 'webhook-status', label: t('integration.sections.status') },
            { id: 'webhook-url', label: t('integration.sections.url') },
            { id: 'webhook-examples', label: t('integration.sections.examples') },
            { id: 'webhook-instructions', label: t('integration.sections.instructions') },
          ];
        case 'api':
          return [
            { id: 'api-overview', label: t('integration.sections.overview') },
            { id: 'api-authentication', label: t('integration.sections.authentication') },
            { id: 'api-endpoints', label: t('integration.sections.endpoints') },
            { id: 'api-errors', label: t('integration.sections.errors') },
          ];
        case 'skill':
          return [{ id: 'skill-coming-soon', label: t('integration.sections.comingSoon') }];
        default:
          return [];
      }
    }, [activeIntegration, t]);

    // Reset state when modal closes
    useEffect(() => {
      if (!open) {
        setActiveIntegration('webhook');
        setActiveSection('');
        setApiKeyModalOpen(false);
      }
    }, [open]);

    // Set initial active section
    useEffect(() => {
      if (sections.length > 0 && !activeSection) {
        setActiveSection(sections[0].id);
      }
    }, [sections, activeSection]);

    // IntersectionObserver for TOC highlighting
    useEffect(() => {
      if (!open || !contentRef.current) return;

      const elements = sections
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
    }, [open, sections]);

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
    };

    const getModalContainer = (): HTMLElement => {
      return (document.querySelector('.canvas-container') as HTMLElement) || document.body;
    };

    const renderContent = () => {
      switch (activeIntegration) {
        case 'webhook':
          return <WebhookDocsTab canvasId={canvasId} />;
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

            {/* Main content area */}
            <main className="integration-docs-main">
              {/* Toolbar */}
              <div className="integration-docs-toolbar">
                <div className="integration-docs-toolbar-left">
                  {activeIntegration === 'api' ? (
                    <Button onClick={() => setApiKeyModalOpen(true)}>
                      {t('integration.manageApiKeys')}
                    </Button>
                  ) : null}
                </div>
                <div className="integration-docs-toolbar-right">
                  <CopyAllDocsButton activeIntegration={activeIntegration} canvasId={canvasId} />
                  <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
                </div>
              </div>

              {/* Scrollable content */}
              <div ref={contentRef} className="integration-docs-content">
                {renderContent()}
              </div>
            </main>

            {/* Right sidebar - Table of contents */}
            <aside className="integration-docs-toc">
              <div className="integration-docs-toc-title">{t('integration.contents')}</div>
              <nav className="integration-docs-toc-list">
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => handleSectionSelect(section.id)}
                    className={`integration-docs-toc-item ${
                      activeSection === section.id ? 'is-active' : ''
                    }`}
                  >
                    {section.label}
                  </button>
                ))}
              </nav>
            </aside>
          </div>
        </Modal>

        {/* API Key Management Modal */}
        <ApiKeyModal open={apiKeyModalOpen} onClose={() => setApiKeyModalOpen(false)} />
      </>
    );
  },
);

IntegrationDocsModal.displayName = 'IntegrationDocsModal';
