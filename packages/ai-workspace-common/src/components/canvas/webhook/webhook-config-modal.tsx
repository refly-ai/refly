import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Button, Typography } from 'antd';
import { AppstoreOutlined, BranchesOutlined, CodeOutlined, CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { WebhookConfigTab } from './webhook-config-tab';
import { ApiKeyManagementTab } from './api-key-management-tab';
import './webhook-config-modal.scss';

const { Title, Paragraph } = Typography;

interface WebhookConfigModalProps {
  canvasId: string;
  open: boolean;
  onClose: () => void;
}

type WebhookPanel = 'docs' | 'apiKeys';

export const WebhookConfigModal = memo(({ canvasId, open, onClose }: WebhookConfigModalProps) => {
  const { t } = useTranslation();
  const [activePanel, setActivePanel] = useState<WebhookPanel>('docs');
  const [activeSection, setActiveSection] = useState('webhook-status');
  const contentRef = useRef<HTMLDivElement>(null);

  const sections = useMemo(
    () => [
      { id: 'webhook-status', label: t('webhook.status') },
      { id: 'webhook-url', label: t('webhook.url') },
      { id: 'webhook-examples', label: t('webhook.examples') },
      { id: 'webhook-instructions', label: t('webhook.instructions') },
    ],
    [t],
  );

  useEffect(() => {
    if (!open) {
      setActivePanel('docs');
      setActiveSection(sections[0]?.id || 'webhook-status');
    }
  }, [open, sections]);

  useEffect(() => {
    if (!open || activePanel !== 'docs') return;
    if (!contentRef.current) return;

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
  }, [activePanel, open, sections]);

  const handleSectionSelect = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(sectionId);
    }
  };

  const getModalContainer = (): HTMLElement => {
    return (document.querySelector('.canvas-container') as HTMLElement) || document.body;
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={null}
      width="100%"
      destroyOnClose
      closable={false}
      className="webhook-integration-modal"
      wrapClassName="webhook-integration-modal-wrap"
      getContainer={getModalContainer}
      style={{ top: 0, padding: 0 }}
      styles={{
        body: { height: '100%', padding: 0 },
        mask: { background: 'rgba(15, 23, 42, 0.12)' },
      }}
    >
      <div className="webhook-integration-layout">
        <aside className="webhook-integration-nav">
          <div className="webhook-integration-nav-title">{t('webhook.navTitle')}</div>
          <div className="space-y-1">
            <button type="button" className="webhook-integration-nav-item" disabled>
              <AppstoreOutlined />
              <span>{t('webhook.navSkill')}</span>
            </button>
            <button type="button" className="webhook-integration-nav-item" disabled>
              <CodeOutlined />
              <span>{t('webhook.navApi')}</span>
            </button>
            <button type="button" className="webhook-integration-nav-item is-active">
              <BranchesOutlined />
              <span>{t('webhook.navWebhook')}</span>
            </button>
          </div>
        </aside>

        <main className="webhook-integration-main">
          <div className="webhook-integration-toolbar">
            <div className="flex items-center gap-2">
              <Button
                type={activePanel === 'apiKeys' ? 'primary' : 'default'}
                onClick={() => setActivePanel('apiKeys')}
              >
                {t('webhook.tabs.apiKeys')}
              </Button>
              <Button
                type={activePanel === 'docs' ? 'primary' : 'default'}
                onClick={() => setActivePanel('docs')}
              >
                {t('webhook.tabs.config')}
              </Button>
            </div>
            <Button type="text" icon={<CloseOutlined />} onClick={onClose} />
          </div>

          <div ref={contentRef} className="webhook-integration-content">
            {activePanel === 'docs' ? (
              <div className="webhook-integration-docs">
                <div className="webhook-docs-header">
                  <Title level={2}>{t('webhook.docsTitle')}</Title>
                  <Paragraph className="webhook-docs-subtitle">
                    {t('webhook.docsSubtitle')}
                  </Paragraph>
                </div>
                <WebhookConfigTab canvasId={canvasId} />
              </div>
            ) : (
              <div className="webhook-integration-api-keys">
                <ApiKeyManagementTab />
              </div>
            )}
          </div>
        </main>

        {activePanel === 'docs' && (
          <aside className="webhook-integration-toc">
            <div className="webhook-integration-toc-title">{t('webhook.contents')}</div>
            <nav className="webhook-integration-toc-list">
              {sections.map((section) => (
                <button
                  key={section.id}
                  type="button"
                  onClick={() => handleSectionSelect(section.id)}
                  className={
                    activeSection === section.id
                      ? 'webhook-integration-toc-item is-active'
                      : 'webhook-integration-toc-item'
                  }
                >
                  {section.label}
                </button>
              ))}
            </nav>
          </aside>
        )}
      </div>
    </Modal>
  );
});

WebhookConfigModal.displayName = 'WebhookConfigModal';
