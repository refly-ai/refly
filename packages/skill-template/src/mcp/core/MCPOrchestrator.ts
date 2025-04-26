import { nanoid } from 'nanoid';

import { MCPClient } from './MCPClient';
import {
  MCPCallToolResponse,
  MCPServerConfig,
  WorkflowContext,
  WorkflowResult,
  WorkflowStep,
} from './types';

/**
 * MCP服务编排器
 * 用于管理多个MCP服务器之间的工作流
 */
export class MCPOrchestrator {
  private client: MCPClient;
  private serverConfigs: Map<string, MCPServerConfig> = new Map();

  /**
   * 创建MCP服务编排器
   * @param client MCP客户端实例（可选）
   */
  constructor(client?: MCPClient) {
    this.client = client || new MCPClient();
  }

  /**
   * 添加服务器配置
   * @param config 服务器配置
   */
  addServer(config: MCPServerConfig): void {
    this.serverConfigs.set(config.id, config);
  }

  /**
   * 添加多个服务器配置
   * @param configs 服务器配置数组
   */
  addServers(configs: MCPServerConfig[]): void {
    for (const config of configs) {
      this.addServer(config);
    }
  }

  /**
   * 获取服务器配置
   * @param idOrName 服务器ID或名称
   * @returns 服务器配置
   */
  getServer(idOrName: string): MCPServerConfig | undefined {
    // 尝试通过ID查找
    if (this.serverConfigs.has(idOrName)) {
      return this.serverConfigs.get(idOrName);
    }

    // 尝试通过名称查找
    for (const config of this.serverConfigs.values()) {
      if (config.name === idOrName) {
        return config;
      }
    }

    return undefined;
  }

  /**
   * 初始化所有服务器连接
   * @returns 连接成功的服务器数量
   */
  async initializeAll(): Promise<number> {
    let successCount = 0;

    for (const config of this.serverConfigs.values()) {
      if (config.isActive !== false) {
        const success = await this.client.connect(config);
        if (success) {
          successCount++;
        }
      }
    }

    return successCount;
  }

  /**
   * 执行单个工作流步骤
   * @param step 工作流步骤
   * @param context 上下文
   * @returns 工作流步骤结果
   */
  private async executeStep(
    step: WorkflowStep,
    context: Record<string, any>,
  ): Promise<{
    success: boolean;
    result: MCPCallToolResponse;
  }> {
    try {
      // 检查条件
      if (step.condition) {
        const condition = step.condition.replace(/\{\{([^}]+)\}\}/g, (_, key) => {
          const value = context[key.trim()];
          return typeof value === 'string' ? `"${value}"` : JSON.stringify(value);
        });

        // 评估条件
        try {
          const shouldExecute = eval(condition);
          if (!shouldExecute) {
            console.log(`[MCPOrchestrator] Skipping step due to condition: ${step.condition}`);
            return {
              success: true,
              result: {
                content: [{ type: 'text', text: 'Step skipped due to condition' }],
              },
            };
          }
        } catch (error) {
          console.error(`[MCPOrchestrator] Error evaluating condition: ${condition}`, error);
          return {
            success: false,
            result: {
              isError: true,
              content: [{ type: 'text', text: `Error evaluating condition: ${error}` }],
            },
          };
        }
      }

      // 获取服务器配置
      const server = this.getServer(step.server);
      if (!server) {
        throw new Error(`Unknown server: ${step.server}`);
      }

      // 替换参数中的模板变量
      const processedArgs = Object.fromEntries(
        Object.entries(step.args).map(([key, value]) => {
          if (typeof value === 'string') {
            return [
              key,
              value.replace(/\{\{([^}]+)\}\}/g, (_, path) => {
                const pathParts = path.trim().split('.');
                let current = context;

                for (const part of pathParts) {
                  if (current === undefined || current === null) {
                    return '';
                  }
                  current = current[part];
                }

                return current === undefined || current === null ? '' : current;
              }),
            ];
          }
          return [key, value];
        }),
      );

      // 调用工具
      const result = await this.client.callTool({
        server,
        name: step.tool,
        args: processedArgs,
      });

      return { success: !result.isError, result };
    } catch (error) {
      console.error(`[MCPOrchestrator] Error executing step:`, error);
      return {
        success: false,
        result: {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error executing step: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
        },
      };
    }
  }

  /**
   * 执行工作流
   * @param steps 工作流步骤数组
   * @param options 工作流上下文和选项
   * @returns 工作流执行结果
   */
  async executeWorkflow(
    steps: WorkflowStep[],
    options: WorkflowContext = {},
  ): Promise<WorkflowResult> {
    const workflowId = options.workflowId || `workflow-${nanoid(8)}`;
    const recordHistory = options.recordHistory !== false;
    const context = { ...(options.initialContext || {}) };
    const history: Array<{
      step: WorkflowStep;
      result: MCPCallToolResponse;
      timestamp: number;
    }> = [];

    console.log(`[MCPOrchestrator] Starting workflow ${workflowId} with ${steps.length} steps`);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(
        `[MCPOrchestrator] Executing step ${i + 1}/${steps.length}: ${step.server}.${step.tool}`,
      );

      const { success, result } = await this.executeStep(step, context);

      // 记录历史
      if (recordHistory) {
        history.push({
          step,
          result,
          timestamp: Date.now(),
        });
      }

      // 处理结果
      if (success) {
        // 提取内容并保存到上下文
        if (step.outputVar) {
          if (result.content && result.content.length > 0) {
            const textContent = result.content
              .filter((item) => item.type === 'text' && item.text)
              .map((item) => item.text)
              .join('\n');

            context[step.outputVar] = textContent;
          } else {
            context[step.outputVar] = '';
          }
        }
      } else {
        // 处理错误
        if (step.onError === 'continue') {
          console.warn(`[MCPOrchestrator] Step failed but continuing: ${step.server}.${step.tool}`);
          continue;
        } else if (step.onError === 'abort' || step.onError === undefined) {
          console.error(
            `[MCPOrchestrator] Workflow aborted due to step failure: ${step.server}.${step.tool}`,
          );
          return {
            success: false,
            context,
            history: recordHistory ? history : undefined,
            error: result.content?.[0]?.text || 'Step failed',
          };
        } else if (typeof step.onError === 'object') {
          // 执行错误处理步骤
          console.log(
            `[MCPOrchestrator] Executing error handler for step: ${step.server}.${step.tool}`,
          );
          const { success: errorHandlerSuccess, result: errorHandlerResult } =
            await this.executeStep(step.onError, context);

          if (recordHistory) {
            history.push({
              step: step.onError,
              result: errorHandlerResult,
              timestamp: Date.now(),
            });
          }

          if (!errorHandlerSuccess && step.onError.onError !== 'continue') {
            console.error(
              `[MCPOrchestrator] Error handler failed: ${step.onError.server}.${step.onError.tool}`,
            );
            return {
              success: false,
              context,
              history: recordHistory ? history : undefined,
              error: errorHandlerResult.content?.[0]?.text || 'Error handler failed',
            };
          }

          // 提取错误处理器的结果
          if (step.onError.outputVar) {
            if (errorHandlerResult.content && errorHandlerResult.content.length > 0) {
              const textContent = errorHandlerResult.content
                .filter((item) => item.type === 'text' && item.text)
                .map((item) => item.text)
                .join('\n');

              context[step.onError.outputVar] = textContent;
            } else {
              context[step.onError.outputVar] = '';
            }
          }
        }
      }
    }

    console.log(`[MCPOrchestrator] Workflow ${workflowId} completed successfully`);

    return {
      success: true,
      context,
      history: recordHistory ? history : undefined,
    };
  }

  /**
   * 关闭编排器和所有连接
   */
  async close(): Promise<void> {
    await this.client.disconnectAll();
  }
}
