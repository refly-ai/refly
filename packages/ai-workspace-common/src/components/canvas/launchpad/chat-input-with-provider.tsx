// packages/ai-workspace-common/src/components/canvas/launchpad/chat-input-with-provider.tsx
import React, { useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import { ChatInput } from './chat-input';
import {
  IContextItem,
  useContextPanelStoreShallow,
} from '@refly-packages/ai-workspace-common/stores/context-panel';
import { CanvasNodeType } from '@refly/openapi-schema';

// 导出原始 ChatInput 的 props 类型
import type { ChatInputProps } from './chat-input';

/**
 * 包装了 ReactFlowProvider 的 ChatInput 组件
 * 解决在没有 ReactFlow 上下文时使用 useCanvasData 的问题
 */
export const ChatInputWithProvider: React.FC<ChatInputProps> = (props) => {
  return <ChatInputWithCanvasData {...props} />;
};

/**
 * 内部组件，在 ReactFlowProvider 上下文中使用 useCanvasData
 * 并将节点数据传递给 UserMention 扩展
 */
const ChatInputWithCanvasData: React.FC<ChatInputProps> = (props) => {
  const { getNodes } = useReactFlow();

  const nodes = getNodes();

  // 获取上下文面板状态
  const contextPanelStore = useContextPanelStoreShallow((state) => ({
    addContextItem: state.addContextItem,
    contextItems: state.contextItems,
  }));

  // 获取未选择的节点数据
  const getUnselectedNodes = useCallback(() => {
    // 过滤出不是 skill 和 group 类型的节点
    const targetNodes = nodes.filter((node) => !['skill', 'group'].includes(node?.type));

    // 过滤出未选择的节点
    return targetNodes
      .filter(
        (node) =>
          !contextPanelStore.contextItems.some(
            (selected) => selected.entityId === node.data?.entityId,
          ),
      )
      .map((node) => ({
        title:
          node?.type === 'memo'
            ? node.data?.contentPreview
              ? `${node.data?.title} - ${node.data?.contentPreview?.slice(0, 10)}`
              : node.data?.title
            : node.data?.title,
        entityId: node.data?.entityId,
        type: node.type as CanvasNodeType,
        metadata: node.data?.metadata,
      }));
  }, [nodes, contextPanelStore.contextItems]);

  // 处理节点选择
  const handleNodeSelect = useCallback(
    (node: IContextItem) => {
      if (node?.entityId) {
        contextPanelStore.addContextItem(node);
      }
    },
    [contextPanelStore],
  );

  // 将 getUnselectedNodes 和 handleNodeSelect 作为自定义属性传递给 ChatInput
  return (
    <ChatInput
      {...props}
      // @ts-ignore - 添加自定义属性
      getUnselectedNodes={getUnselectedNodes}
      // @ts-ignore - 添加自定义属性
      handleNodeSelect={handleNodeSelect}
    />
  );
};

// 重新导出 ChatInput 的 displayName
ChatInputWithProvider.displayName = 'ChatInputWithProvider';

export default ChatInputWithProvider;
