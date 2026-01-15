import { Collapse } from 'antd';
import { ArrowDown, MessageSmile } from 'refly-icons';
import { useTranslation } from 'react-i18next';
import cn from 'classnames';
import type { WorkflowVariable } from '@refly/openapi-schema';
import { VariableTypeSection } from '@refly-packages/ai-workspace-common/components/canvas/node-preview/start';
import { useMemo } from 'react';

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
  workflowApp?: any;
  ToolsDependencyChecker?: React.ComponentType<{ canvasData: any }>;
}

export const UserInputCollapse = ({
  workflowVariables,
  canvasId,
  defaultActiveKey = ['input'],
  showToolsDependency = false,
  workflowApp,
  ToolsDependencyChecker,
}: UserInputCollapseProps) => {
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
    <>
      <style>
        {`
        .workflow-run-collapse .ant-collapse-item {
          border: none !important;
          margin-bottom: 0 !important;
        }
        .workflow-run-collapse .ant-collapse-item + .ant-collapse-item {
          margin-top: 2px !important;
        }
        .workflow-run-collapse .ant-collapse-item:first-child .ant-collapse-header {
          border-radius: 6px 6px 6px 6px !important;
        }
        .workflow-run-collapse .ant-collapse-header {
          background-color: #F9EDD2 !important;
          height: 40px !important;
          min-height: 40px !important;
          padding: 0 12px !important;
          margin: 0 !important;
          color: #1C1F23 !important;
          font-weight: 500 !important;
          border-radius: 0 !important;
          border: none !important;
          display: flex !important;
          align-items: center !important;
        }
        .workflow-run-collapse .ant-collapse-expand-icon {
          padding-right: 0 !important;
          padding-left: 0 !important;
          margin-left: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          height: 100% !important;
        }
        .workflow-run-collapse .ant-collapse-content {
          background-color: #FFFFFF !important;
          padding: 0 !important;
          border: none !important;
        }
        .workflow-run-collapse .ant-collapse-content-box {
          padding: 0 !important;
        }
      `}
      </style>

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
                    {t('canvas.workflow.run.inputPanelTitle', 'User Input')}
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
                        readonly={true}
                        highlightedVariableId={undefined}
                      />
                    )}

                    {groupedVariables.resource.length > 0 && (
                      <VariableTypeSection
                        canvasId={canvasId ?? ''}
                        type="resource"
                        variables={groupedVariables.resource}
                        totalVariables={workflowVariables}
                        readonly={true}
                        highlightedVariableId={undefined}
                      />
                    )}

                    {groupedVariables.option.length > 0 && (
                      <VariableTypeSection
                        canvasId={canvasId ?? ''}
                        type="option"
                        variables={groupedVariables.option}
                        totalVariables={workflowVariables}
                        readonly={true}
                        highlightedVariableId={undefined}
                      />
                    )}

                    {/* Tools Dependency Form */}
                    {showToolsDependency && workflowApp?.canvasData && ToolsDependencyChecker && (
                      <div className="mt-5 ">
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
    </>
  );
};
