import { Position, NodeProps, useReactFlow } from '@xyflow/react';
import { CanvasNodeData, ToolNodeMeta } from '@refly/canvas-common';
import { Node } from '@xyflow/react';
import { Wrench, MoreHorizontal } from 'lucide-react';
import { CustomHandle } from './shared/custom-handle';
import { useState, useCallback } from 'react';
import { useCanvasData } from '@refly-packages/ai-workspace-common/hooks/canvas/use-canvas-data';
import { useEdgeStyles } from '../constants';
import { getNodeCommonStyles } from './index';

type ToolNode = Node<CanvasNodeData<ToolNodeMeta>, 'tool'>;

// 根据不同的工具类型返回不同的显示名称
const getToolTitle = (toolType: string | undefined) => {
  if (!toolType) return 'Unknown Tool';

  // 这里可以根据实际的工具类型添加更多的映射
  const toolTitles: Record<string, string> = {
    TextToSpeech: 'Text To Speech',
    SpeechToText: 'Speech To Text',
    CodeInterpreter: 'Code Interpreter',
    WebSearch: 'Web Search',
    // 添加更多工具类型的映射...
  };

  return toolTitles[toolType] || toolType.split(/(?=[A-Z])/).join(' ');
};

export const ToolNode = ({ data, selected, id }: NodeProps<ToolNode>) => {
  const [isHovered, setIsHovered] = useState(false);
  const { edges } = useCanvasData();
  const { setEdges } = useReactFlow();
  const edgeStyles = useEdgeStyles();

  // Check if node has any connections
  const isTargetConnected = edges?.some((edge) => edge.target === id);
  const isSourceConnected = edges?.some((edge) => edge.source === id);

  // Handle node hover events
  const handleMouseEnter = useCallback(() => {
    setIsHovered(true);
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.source === id || edge.target === id) {
          return {
            ...edge,
            style: edgeStyles.hover,
          };
        }
        return edge;
      }),
    );
  }, [id, setEdges, edgeStyles]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.source === id || edge.target === id) {
          return {
            ...edge,
            style: edgeStyles.default,
          };
        }
        return edge;
      }),
    );
  }, [id, setEdges, edgeStyles]);

  return (
    <div className="relative group" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
      {/* Action Button */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        className="
          absolute 
          -top-9 
          -right-0
          opacity-0 
          group-hover:opacity-100
          transition-opacity 
          duration-200 
          ease-in-out
          z-50
        "
      >
        <button
          type="button"
          className="
            p-1.5
            rounded-md 
            bg-white
            dark:bg-gray-900
            hover:bg-gray-50 
            dark:hover:bg-gray-950
            text-gray-600 
            dark:text-gray-300
            shadow-[0px_1px_2px_0px_rgba(16,24,60,0.05)]
            border border-[#EAECF0]
            dark:border-[#344054]
          "
        >
          <MoreHorizontal className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main Card Container */}
      <div
        className={`
          w-[170px]
          h-[71px]
          ${getNodeCommonStyles({ selected, isHovered })}
        `}
      >
        <CustomHandle
          id={`${id}-target`}
          type="target"
          position={Position.Left}
          isConnected={isTargetConnected}
          isNodeHovered={isHovered}
          nodeType="tool"
        />
        <CustomHandle
          id={`${id}-source`}
          type="source"
          position={Position.Right}
          isConnected={isSourceConnected}
          isNodeHovered={isHovered}
          nodeType="tool"
        />

        <div className="flex flex-col gap-2">
          {/* Header with Icon and Type */}
          <div className="flex items-center gap-2">
            <div
              className="
                w-6 
                h-6 
                rounded 
                bg-[#2E90FA]
                shadow-[0px_2px_4px_-2px_rgba(16,24,60,0.06),0px_4px_8px_-2px_rgba(16,24,60,0.1)]
                flex 
                items-center 
                justify-center
                flex-shrink-0
              "
            >
              <Wrench className="w-4 h-4 text-white" />
            </div>

            <span
              className="
                text-[13px]
                font-medium
                leading-normal
                text-[rgba(0,0,0,0.8)]
                font-['PingFang_SC']
                truncate
              "
            >
              {getToolTitle(data.metadata.toolType)}
            </span>
          </div>

          {/* Tool Title */}
          <div
            className="
              text-[13px]
              font-medium
              leading-normal
              text-[rgba(0,0,0,0.8)]
              font-['PingFang_SC']
              truncate
            "
          >
            {data.title}
          </div>
        </div>
      </div>
    </div>
  );
};
