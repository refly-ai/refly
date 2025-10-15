import React, { useEffect } from 'react';
import { useReactFlow } from '@xyflow/react';
import { StepNodeStatus } from '@refly/common-types';
import { DAILY_AI_NEWS_WORKFLOW_STEPS, DAILY_AI_NEWS_CONFIG } from '@refly/ai-workspace-common';
import { useWorkflowStepStore, useCopilotStore } from '@refly/stores';
import { useAddNode } from '../../hooks/canvas/use-add-node';
import { useUpdateWorkflowVariables } from '../../queries/queries';

interface DailyNewsWorkflowPanelProps {
  canvasId: string;
  currentStepId?: string;
  onExecuteStep?: (stepId: string) => void;
}

// Enhanced step status indicator with proper styling
const StepStatusIndicator: React.FC<{ status: StepNodeStatus; isActive?: boolean }> = ({
  status,
  isActive = false,
}) => {
  const getStatusDisplay = () => {
    switch (status) {
      case StepNodeStatus.PENDING:
        return (
          <div
            className={`w-8 h-8 rounded-full border-2 flex items-center justify-center ${
              isActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-white'
            }`}
          >
            <div className="w-3 h-3 rounded-full bg-gray-300" />
          </div>
        );
      case StepNodeStatus.RUNNING:
        return (
          <div className="w-8 h-8 rounded-full border-2 border-green-500 bg-green-500 flex items-center justify-center animate-pulse">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      case StepNodeStatus.COMPLETED:
        return (
          <div className="w-8 h-8 rounded-full border-2 border-green-500 bg-green-500 flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className="w-8 h-8 rounded-full border-2 border-gray-300 bg-white flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-gray-300" />
          </div>
        );
    }
  };

  return getStatusDisplay();
};

export const DailyNewsWorkflowPanel: React.FC<DailyNewsWorkflowPanelProps> = ({
  canvasId,
  currentStepId,
  onExecuteStep,
}) => {
  const {
    stepStates,
    currentExecutingStep,
    executeStep,
    setWorkflowMode,
    setWorkflowTitle,
    canExecuteStep,
  } = useWorkflowStepStore();

  const { workflowSteps, setWorkflowSteps, workflowTitle } = useCopilotStore();
  const { addNode } = useAddNode();
  const { getNodes } = useReactFlow();

  // Mutation for updating workflow variables
  const updateWorkflowVariablesMutation = useUpdateWorkflowVariables();

  // Initialize workflow steps and states
  useEffect(() => {
    if (workflowSteps.length === 0) {
      const stepsWithDynamicStatus = DAILY_AI_NEWS_WORKFLOW_STEPS.map((step) => ({
        id: step.id,
        title: step.title,
        description: step.description,
        status: stepStates.get(step.nodeId) || StepNodeStatus.PENDING,
        estimatedTime: step.estimatedTime,
      }));

      setWorkflowSteps(stepsWithDynamicStatus);
      setWorkflowMode(true);
      setWorkflowTitle('Daily AI News Digest with Perplexity and Gmail');
    }
  }, [stepStates, workflowSteps, setWorkflowSteps, setWorkflowMode, setWorkflowTitle]);

  // Get current dynamic steps with live status
  const currentSteps = DAILY_AI_NEWS_WORKFLOW_STEPS.map((step) => ({
    ...step,
    status: stepStates.get(step.nodeId) || StepNodeStatus.PENDING,
  }));

  const completedCount = currentSteps.filter(
    (step) => step.status === StepNodeStatus.COMPLETED,
  ).length;

  const progressPercent = (completedCount / DAILY_AI_NEWS_WORKFLOW_STEPS.length) * 100;

  // 创建画布节点的函数 - 串联结构，并为开始节点预设变量
  const createCanvasWorkflowNodes = () => {
    try {
      console.log('开始创建Daily AI News工作流节点...');

      // 获取现有的开始节点
      const existingNodes = getNodes();
      const startNode = existingNodes.find((node) => node.type === 'start');

      if (!startNode) {
        console.error('未找到开始节点，无法创建工作流');
        return;
      }

      console.log('找到开始节点:', startNode.id, startNode.data?.entityId);

      // 首先通过API为开始节点预设Daily AI News工作流所需的变量
      console.log('为开始节点预设工作流变量...');

      // 立即设置工作流变量，为用户预设好所需的参数
      const setupWorkflowVariables = async () => {
        try {
          // 转换变量定义为API格式
          const workflowVariables = DAILY_AI_NEWS_CONFIG.variables.map((variable) => ({
            variableId: variable.name, // 添加必需的variableId字段
            name: variable.name,
            type: variable.type,
            description: variable.description,
            required: variable.required,
            value: [
              {
                type: 'text' as const,
                text:
                  variable.name === 'scheduleTime'
                    ? '09:00'
                    : variable.name === 'newsCategories'
                      ? 'AI research, machine learning, LLM, robotics, AI safety'
                      : variable.name === 'websiteUrl'
                        ? 'https://api.perplexity.ai'
                        : variable.name === 'recipientEmail'
                          ? 'your-email@gmail.com'
                          : '',
              },
            ],
          }));

          // 调用API设置工作流变量
          await updateWorkflowVariablesMutation.mutateAsync({
            body: {
              canvasId,
              variables: workflowVariables,
            },
          });

          console.log('工作流变量预设完成，用户可以修改这些默认值');
        } catch (error) {
          console.error('设置工作流变量失败:', error);
        }
      };

      // 立即执行变量设置
      setupWorkflowVariables();

      // 创建8个工作流步骤节点 - 串联布局和连接
      DAILY_AI_NEWS_WORKFLOW_STEPS.forEach((step, index) => {
        const skillResponseNode = {
          id: step.nodeId,
          type: 'skillResponse',
          position: {
            x: 400, // 统一x坐标，确保垂直对齐
            y: 300 + index * 200, // 步骤间距200px，确保充足间隔
          },
          data: {
            createdAt: new Date().toISOString(),
            title: `${step.order}. ${step.title}`, // 显示步骤序号
            entityId: step.nodeId,
            metadata: {
              sizeMode: 'compact',
              status: 'ready',
              version: 0,
              contextItems: [],
              stepOrder: step.order, // 添加步骤顺序信息
              dependencies: step.dependencies || [], // 明确依赖关系
              structuredData: {
                query: step.prompt,
                workflowStep: true,
                stepId: step.id,
              },
              selectedToolsets:
                step.id.includes('fetch') ||
                step.id.includes('gmail') ||
                step.id.includes('extract')
                  ? [
                      {
                        type: 'regular',
                        id: 'builtin',
                        name: 'Builtin',
                        toolset: {
                          toolsetId: 'builtin',
                          name: 'Builtin',
                        },
                      },
                    ]
                  : [],
            },
            content: '',
            modelConfig: {
              model: '@kimi',
              temperature: 0.2,
              maxTokens: 4000,
            },
            updatedAt: new Date().toISOString(),
          },
        };

        // 定义连接关系 - 串联结构
        let connectTo = [];
        if (index === 0) {
          // 第一个节点连接到开始节点
          connectTo = [
            {
              type: 'start',
              entityId: startNode.data?.entityId || startNode.id,
              handleType: 'source',
            },
          ];
        } else {
          // 后续节点连接到前一个节点
          const previousStep = DAILY_AI_NEWS_WORKFLOW_STEPS[index - 1];
          connectTo = [
            {
              type: 'skillResponse',
              entityId: previousStep.nodeId,
              handleType: 'source',
            },
          ];
        }

        // 串行创建节点，确保顺序正确和连接关系
        setTimeout(() => {
          console.log(
            `创建步骤节点 ${step.order}: ${step.title}，连接到: ${index === 0 ? '开始节点' : DAILY_AI_NEWS_WORKFLOW_STEPS[index - 1].title}`,
          );
          addNode(skillResponseNode, connectTo);
        }, index * 200); // 增加延迟间隔确保顺序创建和连接
      });

      console.log('所有工作流节点创建完成，形成串联结构');
    } catch (error) {
      console.error('Failed to create canvas nodes:', error);
    }
  };

  const handleExecuteStep = async (stepId: string) => {
    const step = DAILY_AI_NEWS_WORKFLOW_STEPS.find((s) => s.id === stepId);
    if (step) {
      try {
        // Execute the workflow step with enhanced configuration
        await executeStep(step.nodeId, {
          modelConfig: {
            model: '@kimi',
            temperature: 0.7,
            maxTokens: 2000,
          },
          prompt: step.prompt,
          contextData: {
            stepId: step.id,
            stepTitle: step.title,
            dependencies: step.dependencies || [],
          },
        });

        // Call original execute callback
        if (onExecuteStep) {
          onExecuteStep(stepId);
        }
      } catch (error) {
        console.error('Failed to execute step:', error);
      }
    }
  };

  return (
    <div className="daily-news-workflow-panel bg-white rounded-lg border border-gray-200 h-full min-h-[400px] max-h-[calc(100vh-100px)] flex flex-col overflow-y-auto resize-y scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 hover:scrollbar-thumb-gray-400">
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <h3 className="font-semibold text-gray-900 text-lg">
          {workflowTitle || 'Daily AI News Digest with Perplexity and Gmail'}
        </h3>
        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
          This enhanced workflow provides quality-assured daily AI news delivery through an 8-step
          process: scheduling, Perplexity news fetching, content extraction, quality filtering,
          professional formatting, Gmail draft composition, manual approval, and confirmed delivery.
        </p>
      </div>

      {/* How It Works Section */}
      <div className="p-4 flex-1">
        <div className="flex items-center gap-2 mb-4">
          <h4 className="font-medium text-gray-900">How It Works</h4>
          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
            {completedCount}/{DAILY_AI_NEWS_WORKFLOW_STEPS.length} completed
          </span>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-6">
          <div
            className="bg-green-500 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Steps */}
        <div className="space-y-4">
          {currentSteps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-3 group">
              {/* Step Indicator */}
              <div className="flex flex-col items-center flex-shrink-0">
                <StepStatusIndicator
                  status={step.status}
                  isActive={currentStepId === step.id || currentExecutingStep === step.nodeId}
                />
                {/* Connector Line */}
                {index < currentSteps.length - 1 && <div className="w-0.5 h-6 bg-gray-200 mt-2" />}
              </div>

              {/* Step Content */}
              <div className="flex-1 min-w-0 pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h5 className="font-medium text-gray-900 text-sm leading-tight">
                      {step.order}. {step.title}
                    </h5>
                    <p className="text-sm text-gray-600 mt-1 leading-relaxed">{step.description}</p>

                    {/* Status and Actions */}
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-500">Est. {step.estimatedTime}</span>

                      {step.status === StepNodeStatus.PENDING && (
                        <button
                          type="button"
                          onClick={() => handleExecuteStep(step.id)}
                          className={`text-xs px-3 py-1 rounded transition-colors ${
                            canExecuteStep(step.nodeId, step.dependencies) &&
                            (currentExecutingStep === null || currentExecutingStep === step.nodeId)
                              ? 'bg-blue-600 text-white hover:bg-blue-700'
                              : 'bg-gray-400 text-gray-200 cursor-not-allowed'
                          }`}
                          disabled={
                            !canExecuteStep(step.nodeId, step.dependencies) ||
                            (currentExecutingStep !== null && currentExecutingStep !== step.nodeId)
                          }
                          title={
                            !canExecuteStep(step.nodeId, step.dependencies)
                              ? `Dependencies required: ${step.dependencies?.join(', ') || 'None'}`
                              : ''
                          }
                        >
                          Run Step
                        </button>
                      )}

                      {step.status === StepNodeStatus.RUNNING && (
                        <span className="text-xs text-green-600 font-medium">Running...</span>
                      )}

                      {step.status === StepNodeStatus.COMPLETED && (
                        <span className="text-xs text-green-600 font-medium">✓ Completed</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <div className="mt-6 pt-4 border-t border-gray-100">
          {completedCount === 0 ? (
            <button
              type="button"
              onClick={() => {
                // 创建画布节点并引导用户到开始节点填写变量
                createCanvasWorkflowNodes();
              }}
              className="w-full bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors font-medium"
              disabled={currentExecutingStep !== null}
            >
              {currentExecutingStep ? 'Running...' : 'Start Daily AI News Workflow'}
            </button>
          ) : completedCount === currentSteps.length ? (
            <button
              type="button"
              className="w-full bg-gray-500 text-white py-2 px-4 rounded-lg font-medium cursor-not-allowed"
            >
              Workflow Completed ✓
            </button>
          ) : (
            <div className="text-sm text-gray-600 text-center">
              {currentExecutingStep
                ? 'Step running...'
                : `${completedCount}/${currentSteps.length} steps completed`}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DailyNewsWorkflowPanel;
