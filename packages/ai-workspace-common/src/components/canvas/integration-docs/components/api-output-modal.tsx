import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Checkbox, Modal, message } from 'antd';
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
  const [localControlsDisabled, setLocalControlsDisabled] = useState(false);
  const hasTouchedRef = useRef(false);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await getClient().getOpenapiConfig({ query: { canvasId } });
      const result = response.data;
      if (result?.success && result.data) {
        setConfig({
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
    let selectedIds: string[] = [];
    if (Array.isArray(config?.resultNodeIds)) {
      selectedIds = config.resultNodeIds.filter((id) => allNodeIds.includes(id));
    } else {
      selectedIds = allNodeIds;
    }
    setSelectedNodeIds(selectedIds);
  }, [open, loading, agentNodes, config?.resultNodeIds]);

  const handleSelectionChange = (ids: string[]) => {
    hasTouchedRef.current = true;
    setSelectedNodeIds(ids);
  };

  const saveSelection = async (nextSelected: string[], rollbackSelection: string[]) => {
    const allNodeIds = agentNodes.map((node) => node.id).filter(Boolean);
    const normalizedIds = nextSelected.filter((id) => allNodeIds.includes(id));
    const resultNodeIds =
      normalizedIds.length === 0
        ? []
        : normalizedIds.length >= allNodeIds.length
          ? null
          : normalizedIds;
    setSaving(true);
    try {
      const response = await getClient().updateOpenapiConfig({
        body: { canvasId, resultNodeIds },
      });
      if (response.data?.success) {
        message.success(t('integration.outputModal.saveSuccess'));
        setConfig({ resultNodeIds });
      } else {
        const errMsg = response.data?.errMsg || response.data?.errCode;
        throw new Error(
          errMsg ? `updateOpenApiConfig failed: ${errMsg}` : 'updateOpenApiConfig failed',
        );
      }
    } catch (error) {
      console.error('Failed to save output config:', error);
      message.error(t('integration.outputModal.saveFailed'));
      setSelectedNodeIds(rollbackSelection);
    } finally {
      setSaving(false);
      setLocalControlsDisabled(false);
    }
  };

  const hasAgents = agentNodes.length > 0;
  const controlsDisabled = !hasAgents || loading || saving || localControlsDisabled;

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      title={t('integration.outputModal.title')}
      width={550}
      destroyOnClose
      centered
      className="api-output-modal"
    >
      <div>
        {hasAgents ? (
          <div className="flex flex-col gap-2 max-h-[376px] overflow-y-auto">
            {agentNodes.map((node) => {
              const title = node.data?.title || t('common.agent', { defaultValue: 'Agent' });
              const checked = selectedNodeIds.includes(node.id);
              return (
                <label
                  key={node.id}
                  htmlFor={node.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[var(--refly-line)] bg-transparent cursor-pointer"
                >
                  <Checkbox
                    id={node.id}
                    checked={checked}
                    disabled={controlsDisabled}
                    onChange={() => {
                      if (controlsDisabled) return;
                      const nextSelected = checked
                        ? selectedNodeIds.filter((id) => id !== node.id)
                        : [...selectedNodeIds, node.id];
                      handleSelectionChange(nextSelected);
                      setLocalControlsDisabled(true);
                      saveSelection(nextSelected, selectedNodeIds);
                    }}
                  />
                  <span className="text-sm text-[var(--refly-text-0)]">{title}</span>
                </label>
              );
            })}
          </div>
        ) : (
          <div className="text-[13px] text-[var(--refly-text-3)] bg-[var(--refly-bg-control-z0)] border border-dashed border-[var(--refly-line)] rounded-lg p-3">
            {t('integration.outputModal.empty')}
          </div>
        )}
      </div>
    </Modal>
  );
});

ApiOutputModal.displayName = 'ApiOutputModal';
