import React, { useMemo } from 'react';
import { Collapse } from 'antd';
import { ArrowDown, MessageSmile } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import cn from 'classnames';
import type { WorkflowVariable } from '@refly/openapi-schema';
import { VariableTypeSection } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/start';
import type { RawCanvasData } from '@refly/openapi-schema';
import './user-input-collapse.scss';

interface UserInputCollapseProps {
  workflowVariables: WorkflowVariable[];
  canvasId?: string;
  /**
   * Keys of panels to expand by default.
   */
  defaultActiveKey?: string[];
  /**
   * Whether to render tools dependency checker section.
   */
  showToolsDependency?: boolean;
  workflowApp?: { canvasData?: RawCanvasData };
  ToolsDependencyChecker?: React.ComponentType<{ canvasData?: RawCanvasData }>;
  /**
   * Whether the input fields are readonly.
   */
  readonly?: boolean;
}

export const UserInputCollapse = React.memo(function UserInputCollapse({
  workflowVariables,
  canvasId,
  defaultActiveKey = ['input'],
  showToolsDependency = false,
  workflowApp,
  ToolsDependencyChecker,
  readonly = false,
}: UserInputCollapseProps): JSX.Element {
  const { t } = useTranslation();

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
        if (groups[type as 'string' | 'resource' | 'option']) {
          groups[type as 'string' | 'resource' | 'option'].push(variable);
        }
      }
    }

    return groups;
  }, [workflowVariables]);

  return (
    <div
      className="overflow-hidden bg-[#F6F6F6]"
      style={{
        borderRadius: '8px',
        width: 'calc(100%)',
        marginLeft: 'auto',
        marginRight: 'auto',
      }}
    >
      <Collapse
        defaultActiveKey={defaultActiveKey}
        ghost
        expandIcon={({ isActive }) => (
          <ArrowDown
            size={14}
            className={cn('transition-transform', {
              'rotate-180': isActive,
            })}
          />
        )}
        expandIconPosition="end"
        className="workflow-run-collapse"
        items={[
          {
            key: 'input',
            label: (
              <div className="flex items-center w-full min-w-0 gap-2">
                <MessageSmile size={20} className="flex-shrink-0" />
                <span
                  className="truncate"
                  style={{
                    fontFamily: 'Inter',
                    fontWeight: 500,
                    fontSize: '13px',
                    lineHeight: '1.5em',
                  }}
                >
                  {t('canvas.workflow.run.inputPanelTitle')}
                </span>
              </div>
            ),
            children: (
              <div className="p-2">
                <div className="space-y-5">
                  {groupedVariables.string.length > 0 && (
                    <VariableTypeSection
                      canvasId={canvasId ?? ''}
                      type="string"
                      variables={groupedVariables.string}
                      totalVariables={workflowVariables}
                      readonly={readonly}
                      highlightedVariableId={undefined}
                    />
                  )}

                  {groupedVariables.resource.length > 0 && (
                    <VariableTypeSection
                      canvasId={canvasId ?? ''}
                      type="resource"
                      variables={groupedVariables.resource}
                      totalVariables={workflowVariables}
                      readonly={readonly}
                      highlightedVariableId={undefined}
                    />
                  )}

                  {groupedVariables.option.length > 0 && (
                    <VariableTypeSection
                      canvasId={canvasId ?? ''}
                      type="option"
                      variables={groupedVariables.option}
                      totalVariables={workflowVariables}
                      readonly={readonly}
                      highlightedVariableId={undefined}
                    />
                  )}

                  {/* Tools Dependency Form */}
                  {showToolsDependency && workflowApp?.canvasData && ToolsDependencyChecker && (
                    <div className="mt-5">
                      <ToolsDependencyChecker canvasData={workflowApp?.canvasData} />
                    </div>
                  )}
                </div>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
});
