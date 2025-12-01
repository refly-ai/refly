import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';
import { memo, useMemo, useState, useCallback, useEffect } from 'react';
import { useVariablesManagement } from '@refly-packages/ai-workspace-common/hooks/use-variables-management';
import { Divider, Button, Popconfirm, message, Typography } from 'antd';
import { Add, Edit, Delete, Image, Doc2, Video, Audio } from 'refly-icons';
import type { WorkflowVariable } from '@refly/openapi-schema';
import { Spin } from '@refly-packages/ai-workspace-common/components/common/spin';
import { useTranslation } from 'react-i18next';
import SVGX from '../../../assets/x.svg';
import { CreateVariablesModal } from '../workflow-variables';
import { locateToVariableEmitter } from '@refly-packages/ai-workspace-common/events/locateToVariable';
import { StartNodeHeader } from '@refly-packages/ai-workspace-common/components/canvas/nodes/shared/start-node-header';
import { BiText } from 'react-icons/bi';
import { VARIABLE_TYPE_ICON_MAP } from '../nodes/start';
import { useCanvasStoreShallow } from '@refly/stores';
const { Paragraph } = Typography;

type VariableType = 'string' | 'option' | 'resource';
export const MAX_VARIABLE_LENGTH = {
  string: 20,
  option: 20,
  resource: 50,
};

const RESOURCE_TYPE_ICON_MAP = {
  image: Image,
  document: Doc2,
  video: Video,
  audio: Audio,
};

const VariableItem = memo(
  ({
    canvasId,
    totalVariables,
    variable,
    onEdit,
    readonly,
    isHighlighted = false,
  }: {
    canvasId: string;
    totalVariables: WorkflowVariable[];
    variable: WorkflowVariable;
    onEdit?: (variable: WorkflowVariable) => void;
    readonly: boolean;
    isHighlighted?: boolean;
  }) => {
    const { name, variableType, required, isSingle } = variable;
    const { t } = useTranslation();
    const [isPopconfirmOpen, setIsPopconfirmOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const { setVariables } = useVariablesManagement(canvasId);

    const handleDeleteVariable = async (variable: WorkflowVariable) => {
      const newVariables = totalVariables.filter((v) => v.variableId !== variable.variableId);
      try {
        setIsDeleting(true);
        setVariables(newVariables);
        message.success(
          t('canvas.workflow.variables.deleteSuccess') || 'Variable deleted successfully',
        );
      } catch (error) {
        console.error('Failed to delete variable:', error);
      } finally {
        setIsDeleting(false);
      }
    };

    return (
      <div
        data-variable-id={variable.variableId}
        className={`group flex h-9 box-border gap-2 items-center justify-between py-1.5  px-3 rounded-xl border-[1px] border-solid border-refly-Card-Border cursor-pointer transition-all duration-300 ${
          isHighlighted ? 'bg-refly-Colorful-orange-light' : 'bg-refly-bg-body-z0'
        } ${isPopconfirmOpen ? 'bg-refly-tertiary-hover' : 'hover:bg-refly-tertiary-hover'}`}
      >
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <img src={SVGX} alt="x" className="w-[10px] h-[10px] flex-shrink-0" />
          <Divider type="vertical" className="bg-refly-Card-Border mx-2 my-0 flex-shrink-0" />
          <div className="text-sm font-medium text-refly-text-1 truncate max-w-full">{name}</div>
          {required && (
            <div className="h-4 px-1 flex items-center justify-center text-refly-text-2 text-[10px] leading-[14px] border-[1px] border-solid border-refly-Card-Border rounded-[4px] flex-shrink-0">
              {t('canvas.workflow.variables.required')}
            </div>
          )}
          {['option'].includes(variableType) && (
            <div className="h-4 px-1 flex items-center justify-center text-refly-text-2 text-[10px] leading-[14px] border-[1px] border-solid border-refly-Card-Border rounded-[4px] flex-shrink-0">
              {t(`canvas.workflow.variables.${isSingle ? 'singleSelect' : 'multipleSelect'}`)}
            </div>
          )}
        </div>

        {variableType === 'resource' && (
          <div className="flex items-center gap-1">
            {variable.resourceTypes?.map((type) => {
              const Icon = RESOURCE_TYPE_ICON_MAP[type];
              if (!Icon) {
                return null;
              }
              return <Icon size={16} key={type} color="var(--refly-text-3)" />;
            })}
          </div>
        )}

        {!readonly && (
          <div
            className={`items-center gap-1 flex-shrink-0 ${
              isPopconfirmOpen ? 'flex' : 'hidden group-hover:flex'
            }`}
          >
            <Button
              type="text"
              size="small"
              icon={<Edit size={16} />}
              onClick={() => onEdit?.(variable)}
            />
            <Popconfirm
              icon={null}
              title={
                <Paragraph
                  className="!m-0 text-[16px] font-semibold leading-[26px] p-3 max-w-[400px]"
                  ellipsis={{
                    rows: 1,
                    tooltip: (
                      <div className="max-h-[200px] overflow-y-auto">
                        {t('canvas.workflow.variables.deleteUserInput', { value: name })}
                      </div>
                    ),
                  }}
                >
                  {t('canvas.workflow.variables.deleteUserInput', { value: name })}
                </Paragraph>
              }
              description={
                <div className="w-[400px] leading-5 px-3 pt-1 pb-2">
                  {t('canvas.workflow.variables.deleteConfirm')}
                </div>
              }
              arrow={false}
              onConfirm={() => handleDeleteVariable(variable)}
              okText={t('common.confirm')}
              cancelText={t('common.cancel')}
              onOpenChange={setIsPopconfirmOpen}
              okButtonProps={{ loading: isDeleting, className: 'w-20 h-8 mb-3 mr-3' }}
              cancelButtonProps={{ className: 'w-20 h-8 mb-3' }}
              placement="topRight"
            >
              <Button
                type="text"
                size="small"
                icon={<Delete size={16} />}
                className={isPopconfirmOpen ? 'bg-refly-tertiary-hover' : ''}
              />
            </Popconfirm>
          </div>
        )}
      </div>
    );
  },
);

// Variable type section component
const VariableTypeSection = ({
  canvasId,
  type,
  variables,
  totalVariables,
  readonly,
  highlightedVariableId,
}: {
  canvasId: string;
  type: VariableType;
  variables: WorkflowVariable[];
  totalVariables: WorkflowVariable[];
  readonly: boolean;
  highlightedVariableId?: string;
}) => {
  const { t } = useTranslation();
  const Icon = VARIABLE_TYPE_ICON_MAP[type] ?? BiText;
  const [showCreateVariablesModal, setShowCreateVariablesModal] = useState(false);
  const [currentVariable, setCurrentVariable] = useState<WorkflowVariable | null>(null);

  const handleCloseModal = () => {
    setShowCreateVariablesModal(false);
    setCurrentVariable(null);
  };

  const handleAddVariable = useCallback(() => {
    setCurrentVariable(null);
    setShowCreateVariablesModal(true);
  }, []);

  const handleEditVariable = useCallback((variable: WorkflowVariable) => {
    setCurrentVariable(variable);
    setShowCreateVariablesModal(true);
  }, []);

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
            <VariableItem
              key={variable.name}
              canvasId={canvasId}
              totalVariables={totalVariables}
              variable={variable}
              onEdit={handleEditVariable}
              readonly={readonly}
              isHighlighted={highlightedVariableId === variable.variableId}
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

  useEffect(() => {
    const handleLocateToVariable = (event: {
      canvasId: string;
      nodeId: string;
      variableId: string;
      variableName: string;
    }) => {
      if (event.canvasId === canvasId) {
        // Set the highlighted variable
        setHighlightedVariableId(event.variableId);

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

        {/* <VariableTypeSection
          canvasId={canvasId}
          type="resource"
          variables={groupedVariables.resource}
          totalVariables={workflowVariables}
          readonly={readonly}
          highlightedVariableId={highlightedVariableId}
        /> */}

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
