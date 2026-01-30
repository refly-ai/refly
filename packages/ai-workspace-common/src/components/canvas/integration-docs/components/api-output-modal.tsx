import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Checkbox, Modal, message } from 'antd';
import { useTranslation } from 'react-i18next';
import { useRealtimeCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-realtime-canvas-data';
import getClient from '@refly-packages/ai-workspace-common/requests/proxiedRequest';
import type { CanvasNode } from '@refly/canvas-common';
import './api-output-modal.scss';

interface ApiOutputModalProps {
  open: boolean;
  canvasId: string;
  onClose: () => void;
}

interface OutputConfig {
  webhookId: string;
  resultNodeIds?: string[] | null;
}

const filterAgentNodes = (nodes: CanvasNode[]) =>
  nodes.filter((node) => node?.type === 'skillResponse' && Boolean(node?.id));

export const ApiOutputModal = memo(({ open, canvasId, onClose }: ApiOutputModalProps) => {
  const { t } = useTranslation();
  const { nodes } = useRealtimeCanvasData();
  const agentNodes = useMemo(() => filterAgentNodes(nodes), [nodes]);
  const [config, setConfig] = useState<OutputConfig | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasTouchedRef = useRef(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await getClient().getWebhookConfig({ query: { canvasId } });
      const result = response.data;
      if (result?.success && result.data) {
        setConfig({
          webhookId: result.data.apiId,
          resultNodeIds: result.data.resultNodeIds ?? null,
        });
      } else {
        setConfig(null);
      }
    } catch (error) {
      console.error('Failed to fetch output config:', error);
      setConfig(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) {
      setSelectedNodeIds([]);
      setConfig(null);
      hasTouchedRef.current = false;
      return;
    }
    hasTouchedRef.current = false;
    fetchConfig();
  }, [open, canvasId]);

  useEffect(() => {
    if (!open || loading || hasTouchedRef.current) return;
    const allNodeIds = agentNodes.map((node) => node.id).filter(Boolean);
    const savedNodeIds = Array.isArray(config?.resultNodeIds)
      ? config?.resultNodeIds.filter((id) => allNodeIds.includes(id))
      : [];
    setSelectedNodeIds(savedNodeIds.length > 0 ? savedNodeIds : allNodeIds);
  }, [open, loading, agentNodes, config?.resultNodeIds]);

  const handleSelectionChange = (ids: string[]) => {
    hasTouchedRef.current = true;
    setSelectedNodeIds(ids);
  };

  const saveSelection = async (nextSelected: string[], rollbackSelection: string[]) => {
    if (!config?.webhookId) {
      message.error(t('integration.outputModal.requireWebhook'));
      return;
    }
    const allNodeIds = agentNodes.map((node) => node.id).filter(Boolean);
    const normalizedIds = nextSelected.filter((id) => allNodeIds.includes(id));
    const resultNodeIds = normalizedIds.length >= allNodeIds.length ? [] : normalizedIds;
    setSaving(true);
    try {
      const response = await getClient().updateWebhook({
        body: { webhookId: config.webhookId, resultNodeIds },
      });
      if (response.data?.success) {
        message.success(t('integration.outputModal.saveSuccess'));
        setConfig((prev) => (prev ? { ...prev, resultNodeIds } : prev));
      } else {
        throw new Error('updateWebhook failed');
      }
    } catch (error) {
      console.error('Failed to save output config:', error);
      message.error(t('integration.outputModal.saveFailed'));
      setSelectedNodeIds(rollbackSelection);
    } finally {
      setSaving(false);
    }
  };

  const hasConfig = Boolean(config?.webhookId);
  const hasAgents = agentNodes.length > 0;
  const controlsDisabled = !hasConfig || !hasAgents || loading || saving;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={t('integration.outputModal.title')}
      width={520}
      destroyOnClose
      className="api-output-modal"
    >
      <div className="api-output-modal-content">
        <p className="api-output-modal-description">{t('integration.outputModal.description')}</p>

        {!hasConfig && !loading && (
          <div className="api-output-modal-warning">
            {t('integration.outputModal.requireWebhook')}
          </div>
        )}

        <div className="api-output-modal-section">
          <div className="api-output-modal-label">{t('integration.outputModal.selectorLabel')}</div>
          {hasAgents ? (
            <div className="api-output-node-list">
              {agentNodes.map((node) => {
                const title = node.data?.title || t('common.agent', { defaultValue: 'Agent' });
                const checked = selectedNodeIds.includes(node.id);
                return (
                  <label key={node.id} className="api-output-node-item" htmlFor={node.id}>
                    <Checkbox
                      id={node.id}
                      checked={checked}
                      disabled={controlsDisabled}
                      onChange={() => {
                        const nextSelected = checked
                          ? selectedNodeIds.filter((id) => id !== node.id)
                          : [...selectedNodeIds, node.id];
                        handleSelectionChange(nextSelected);
                        saveSelection(nextSelected, selectedNodeIds);
                      }}
                    />
                    <span className="api-output-node-title">{title}</span>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="api-output-modal-empty">{t('integration.outputModal.empty')}</div>
          )}
          <div className="api-output-modal-hint">{t('integration.outputModal.hint')}</div>
        </div>

        <div className="api-output-modal-footer">
          <Button onClick={onClose}>{t('common.close')}</Button>
        </div>
      </div>
    </Modal>
  );
});

ApiOutputModal.displayName = 'ApiOutputModal';
