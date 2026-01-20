import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { Button } from 'antd';
import { Add } from 'refly-icons';
import type { WorkflowVariable } from '@refly/openapi-schema';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useTranslation } from 'react-i18next';
import { CreateVariablesModal } from '../workflow-variables';
import { locateToVariableEmitter } from '@refly-packages/ai-workspace-common/events/locateToVariable';
import { StartNodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/start-node-header';
import { BiText } from 'react-icons/bi';
import { VARIABLE_TYPE_ICON_MAP, InputParameterRow } from '../nodes/shared/input-parameter-row';
import { useCanvasStoreShallow } from '@refly/stores';

type VariableType = 'string' | 'option' | 'resource';
export const MAX_VARIABLE_LENGTH = {
  string: 20,
  option: 20,
  resource: 50,
};

// Variable type section component
export const VariableTypeSection = ({
  canvasId,
  type,
  variables,
  totalVariables,
  readonly,
  highlightedVariableId,
  autoEditVariable,
  onAutoEditComplete,
}: {
  canvasId: string;
  type: VariableType;
  variables: WorkflowVariable[];
  totalVariables: WorkflowVariable[];
  readonly: boolean;
  highlightedVariableId?: string;
  autoEditVariable?: { variableId: string; showError: boolean } | null;
  onAutoEditComplete?: () => void;
}) => {
  const { t } = useTranslation();
  const Icon = VARIABLE_TYPE_ICON_MAP[type] ?? BiText;
  const [showCreateVariablesModal, setShowCreateVariablesModal] = useState(false);
  const [currentVariable, setCurrentVariable] = useState<WorkflowVariable | null>(null);
  const [showFileUploadError, setShowFileUploadError] = useState(false);
  const { setVariables } = useVariablesManagement(canvasId);

  // Handle auto-edit when variable is passed
  useEffect(() => {
    if (autoEditVariable) {
      const variable = variables.find((v) => v.variableId === autoEditVariable.variableId);
      if (variable) {
        setCurrentVariable(variable);
        setShowFileUploadError(autoEditVariable.showError);
        setShowCreateVariablesModal(true);
        onAutoEditComplete?.();
      }
    }
  }, [autoEditVariable, variables, onAutoEditComplete]);

  const handleCloseModal = () => {
    setShowCreateVariablesModal(false);
    setCurrentVariable(null);
    setShowFileUploadError(false);
  };

  const handleAddVariable = useCallback(() => {
    setCurrentVariable(null);
    setShowFileUploadError(false);
    setShowCreateVariablesModal(true);
  }, []);

  const handleEditVariable = useCallback((variable: WorkflowVariable) => {
    setCurrentVariable(variable);
    setShowFileUploadError(false);
    setShowCreateVariablesModal(true);
  }, []);

  const handleDeleteVariable = useCallback(
    (variable: WorkflowVariable) => {
      const newVariables = totalVariables.filter((v) => v.variableId !== variable.variableId);
      setVariables(newVariables);
    },
    [totalVariables, setVariables],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon size={18} color="var(--refly-text-0)" className="flex-shrink-0" />
          <div className="text-sm font-semibold text-refly-text-0 leading-6">
            {t(`canvas.workflow.variables.${type}`)}
          </div>
        </div>

        {!readonly && variables.length > 0 && variables.length < MAX_VARIABLE_LENGTH[type] && (
          <Button
            type="text"
            size="small"
            onClick={handleAddVariable}
            disabled={variables.length >= MAX_VARIABLE_LENGTH[type]}
            icon={<Add size={16} />}
          />
        )}
      </div>

      {/* Variables list */}
      {variables.length > 0 ? (
        <div className="space-y-2">
          {variables.map((variable) => (
            <InputParameterRow
              key={variable.name}
              variable={variable}
              onEdit={handleEditVariable}
              onDelete={handleDeleteVariable}
              readonly={readonly}
              isHighlighted={highlightedVariableId === variable.variableId}
              isPreview={true}
            />
          ))}
        </div>
      ) : (
        <div className="px-3 py-6 gap-0.5 flex items-center justify-center bg-refly-bg-control-z0 rounded-lg">
          <div className="text-[13px] text-refly-text-1 leading-5">
            {t('canvas.workflow.variables.empty')}
          </div>
          {!readonly && (
            <Button
              type="text"
              size="small"
              className="text-[13px] leading-5 font-semibold !text-refly-primary-default p-0.5 !h-5 box-border hover:bg-refly-tertiary-hover"
              onClick={handleAddVariable}
            >
              {t('canvas.workflow.variables.addVariable') || 'Add'}
            </Button>
          )}
        </div>
      )}

      <CreateVariablesModal
        visible={showCreateVariablesModal}
        onCancel={handleCloseModal}
        variableType={type}
        defaultValue={currentVariable}
        mode={currentVariable ? 'edit' : 'create'}
        onViewCreatedVariable={handleEditVariable}
        showFileUploadError={showFileUploadError}
      />
    </div>
  );
};

export const StartNodePreview = () => {
  const { canvasId, shareLoading, shareData, readonly } = useCanvasContext();
  const { data: variables, isLoading: variablesLoading } = useVariablesManagement(canvasId);
  const { setNodePreview } = useCanvasStoreShallow((state) => ({
    setNodePreview: state.setNodePreview,
  }));

  const workflowVariables = shareData?.variables ?? variables;
  const workflowVariablesLoading = shareLoading || variablesLoading;

  const [highlightedVariableId, setHighlightedVariableId] = useState<string | undefined>();
  const [autoEditVariable, setAutoEditVariable] = useState<{
    variableId: string;
    showError: boolean;
  } | null>(null);

  const handleAutoEditComplete = useCallback(() => {
    setAutoEditVariable(null);
  }, []);

  useEffect(() => {
    const handleLocateToVariable = (event: {
      canvasId: string;
      nodeId: string;
      variableId: string;
      variableName: string;
      autoOpenEdit?: boolean;
      showError?: boolean;
    }) => {
      if (event.canvasId === canvasId) {
        // Set the highlighted variable
        setHighlightedVariableId(event.variableId);

        // If autoOpenEdit is true, set the variable to auto-edit
        if (event.autoOpenEdit) {
          setAutoEditVariable({
            variableId: event.variableId,
            showError: event.showError ?? false,
          });
        }

        // Scroll to the variable section
        setTimeout(() => {
          const variableElement = document.querySelector(
            `[data-variable-id="${event.variableId}"]`,
          );
          if (variableElement) {
            variableElement.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
            });
          }
        }, 100);

        // Remove highlight after 5 seconds
        setTimeout(() => {
          setHighlightedVariableId(undefined);
        }, 5000);
      }
    };

    locateToVariableEmitter.on('locateToVariable', handleLocateToVariable);

    return () => {
      locateToVariableEmitter.off('locateToVariable', handleLocateToVariable);
    };
  }, [canvasId]);

  // Group variables by type
  const groupedVariables = useMemo(() => {
    const groups = {
      string: [] as WorkflowVariable[],
      resource: [] as WorkflowVariable[],
      option: [] as WorkflowVariable[],
    };

    if (workflowVariables) {
      for (const variable of workflowVariables) {
        const type = variable.variableType ?? 'string';
        if (groups[type]) {
          groups[type].push(variable);
        }
      }
    }

    return groups;
  }, [workflowVariables]);

  const handleClose = useCallback(() => {
    setNodePreview(canvasId, null);
  }, [canvasId, setNodePreview]);

  if (workflowVariablesLoading) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <Spin />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      <StartNodeHeader source="preview" onClose={handleClose} className="!h-14" />

      <div className="space-y-5 flex-1 overflow-y-auto p-4">
        <VariableTypeSection
          canvasId={canvasId}
          type="string"
          variables={groupedVariables.string}
          totalVariables={workflowVariables}
          readonly={readonly}
          highlightedVariableId={highlightedVariableId}
        />

        <VariableTypeSection
          canvasId={canvasId}
          type="resource"
          variables={groupedVariables.resource}
          totalVariables={workflowVariables}
          readonly={readonly}
          highlightedVariableId={highlightedVariableId}
          autoEditVariable={autoEditVariable}
          onAutoEditComplete={handleAutoEditComplete}
        />

        <VariableTypeSection
          canvasId={canvasId}
          type="option"
          variables={groupedVariables.option}
          totalVariables={workflowVariables}
          readonly={readonly}
          highlightedVariableId={highlightedVariableId}
        />
      </div>
    </div>
  );
};
