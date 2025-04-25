# MCP 集成 Skill 高级功能扩展

## 三、高级功能扩展

### 1. 添加缓存和会话管理

为了优化性能，添加 MCP 客户端缓存和会话管理：

```typescript
// 在 MCPConnector 类中添加

// 添加会话清理方法
cleanupSessions() {
  // 关闭所有客户端连接
  Object.values(this.mcpClients).forEach(client => {
    try {
      client.disconnect();
    } catch (error) {
      this.engine.logger.warn(`Failed to disconnect client: ${error}`);
    }
  });
  
  // 清空缓存
  this.mcpClients = {};
}

// 重载 MCP 客户端
async reloadMCPClient(serverUrl: string): Promise<boolean> {
  // 先关闭现有连接
  const existingClient = this.mcpClients[serverUrl];
  if (existingClient) {
    try {
      await existingClient.disconnect();
    } catch (error) {
      this.engine.logger.warn(`Failed to disconnect client: ${error}`);
    }
    
    delete this.mcpClients[serverUrl];
  }
  
  // 重新连接
  const { client } = await this.connectToMCPServer(serverUrl);
  return !!client;
}
```

### 2. 添加 MCP 功能探索

添加对 MCP 服务器功能的详细探索：

```typescript
/**
 * 详细探索 MCP 服务器提供的功能
 */
private async exploreMCPServerCapabilities(
  serverUrl: string,
  client: Client
): Promise<any> {
  const capabilities = {};
  
  try {
    // 探索工具
    if (client.serverInfo?.capabilities?.tools) {
      const tools = await client.listTools();
      capabilities.tools = tools;
    }
    
    // 探索资源
    if (client.serverInfo?.capabilities?.resources) {
      const resources = await client.listResources();
      capabilities.resources = resources;
    }
    
    // 探索提示词
    if (client.serverInfo?.capabilities?.prompts) {
      const prompts = await client.listPrompts();
      capabilities.prompts = prompts;
    }
    
    return capabilities;
  } catch (error) {
    this.engine.logger.error(`Error exploring MCP server capabilities: ${error}`);
    return client.serverInfo?.capabilities || {};
  }
}

/**
 * 获取特定 MCP 功能的详细信息
 */
private async getMCPCapabilityDetails(
  client: Client,
  capability: 'tools' | 'resources' | 'prompts',
  functionName: string
): Promise<any> {
  try {
    switch (capability) {
      case 'tools':
        // 获取工具详情
        const toolDetail = await client.describeTool({ name: functionName });
        return toolDetail;
        
      case 'resources':
        // 获取资源详情
        const resourceDetail = await client.describeResource({ uri: functionName });
        return resourceDetail;
        
      case 'prompts':
        // 获取提示词详情
        const promptDetail = await client.getPrompt({ name: functionName });
        return promptDetail;
        
      default:
        return null;
    }
  } catch (error) {
    this.engine.logger.error(`Error getting MCP capability details: ${error}`);
    return null;
  }
}
```

### 3. 添加错误处理和重试机制

实现更强大的错误处理和重试机制：

```typescript
/**
 * 执行带有重试的 MCP 动作
 */
private async executeMCPActionWithRetry(
  action: {
    action: 'use_mcp';
    server: string;
    capability: 'tools' | 'resources' | 'prompts';
    function: string;
    parameters: any;
  },
  serverCapabilities: Record<string, any>,
  config: SkillRunnableConfig,
  maxRetries: number = 2
): Promise<{
  success: boolean;
  result?: any;
  error?: string;
}> {
  let lastError = '';
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // 如果不是第一次尝试，记录重试信息
      if (attempt > 0) {
        this.engine.logger.log(`Retry attempt ${attempt} for MCP action`);
        this.emitEvent({
          log: {
            message: `Retrying MCP call (attempt ${attempt}/${maxRetries})`,
            level: 'info'
          }
        }, config);
        
        // 如果前一次失败是连接问题，尝试刷新连接
        if (lastError.includes('connect') || lastError.includes('network')) {
          await this.reloadMCPClient(action.server);
        }
      }
      
      // 执行调用
      const result = await this.executeMCPAction(action, serverCapabilities, config);
      
      // 如果成功，返回结果
      if (result.success) {
        return result;
      }
      
      // 记录错误以备下次重试
      lastError = result.error || 'Unknown error';
      
      // 如果错误表明这是权限或参数问题，不再重试
      if (
        lastError.includes('permission') ||
        lastError.includes('unauthorized') ||
        lastError.includes('parameter') ||
        lastError.includes('invalid argument')
      ) {
        return result;
      }
    } catch (error) {
      lastError = error.message;
    }
    
    // 在重试之前短暂等待
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
  }
  
  // 所有重试失败
  return {
    success: false,
    error: `Failed after ${maxRetries + 1} attempts. Last error: ${lastError}`
  };
}
```

## 四、最终注册和使用

### 1. 完成 MCPConnector 类

最后，将所有部分组合在一起，完成整个 MCPConnector 类。确保：

1. 所有必要的方法都已实现
2. 错误处理覆盖所有关键场景
3. 日志记录和事件发送清晰明了
4. 工作流程逻辑完整

### 2. 注册到 Skill 库存

确保将 MCPConnector 导出和注册到 Skill 库存中：

```typescript
// packages/skill-template/src/skills/index.ts
export * from './mcp-connector';

// packages/skill-template/src/inventory.ts
import { MCPConnector } from './skills/mcp-connector';

export const createSkillInventory = (engine: SkillEngine): BaseSkill[] => {
  return [
    // ... 其他技能
    new MCPConnector(engine),
  ];
};
```

### 3. 优化点总结

1. **自动服务发现**：通过配置自动连接到可用的 MCP 服务器
2. **智能决策**：使用多阶段提示让模型做出更明智的决策
3. **错误处理**：实现全面的错误处理和重试机制
4. **结果处理**：使用模型处理和格式化 MCP 调用结果
5. **配置灵活性**：通过配置项提供灵活定制
6. **多语言支持**：支持中文和英文等多种语言
7. **事件通知**：发送进度和状态更新事件
8. **资源管理**：管理 MCP 客户端连接和会话

## 五、用法指南

### 1. 配置 MCP 服务器

用户需要提供逗号分隔的 MCP 服务器 URL 列表。例如：

```
https://mcp-server1.example.com,https://mcp-server2.example.com
```

### 2. 使用示例

用户可以通过以下方式使用 MCPConnector 技能：

1. **简单查询**：询问需要使用 MCP 服务的问题
   ```
   请帮我查询今天的天气数据
   ```

2. **特定服务查询**：指定希望使用的服务
   ```
   使用 code-execution 服务运行这段 Python 代码
   ```

3. **资源查询**：请求访问特定资源
   ```
   查找关于机器学习的最新研究论文
   ```

## 总结

这个 MCPConnector Skill 为 Refly 框架提供了与 MCP 服务无缝集成的能力。它使用了标准的 Skill 架构，并添加了特定于 MCP 的功能。通过智能决策、错误处理和结果处理，它能够有效地利用 MCP 服务来增强大模型的回答能力。

通过 MCP 集成，这个 Skill 极大地扩展了大模型的功能范围，使其能够访问最新数据、执行代码、调用特定工具和处理各种资源，同时保持了与现有 Skill 框架的兼容性。

此实现采用了 MCP TypeScript SDK 提供的最佳实践，包括连接管理、功能发现和请求处理。它也实现了向后兼容以支持不同版本的 MCP 服务器。 