import { memo, useState, useCallback } from 'react';
import { BaseEdge, EdgeProps, getBezierPath, useReactFlow, Position } from '@xyflow/react';
import { useEdgeStyles } from '../constants';
import { IconDelete } from '@refly-packages/ai-workspace-common/components/common/icon';
import { useThrottledCallback } from 'use-debounce';
import { Input } from 'antd';
const { TextArea } = Input;
interface CustomEdgeData {
  label?: string;
  hover?: boolean;
}

const DeleteButton = ({ handleDelete }: { handleDelete: (e: React.MouseEvent) => void }) => {
  return (
    <div
      className="flex items-center justify-center w-5 h-5 rounded-full bg-white border border-gray-200 dark:bg-gray-900 dark:border-gray-700 cursor-pointer hover:bg-gray-50"
      onClick={handleDelete}
    >
      <IconDelete className="w-3 h-3 text-red-500" />
    </div>
  );
};

export const CustomEdge = memo(
  ({ sourceX, sourceY, targetX, targetY, selected, data, id }: EdgeProps) => {
    const edgeStyles = useEdgeStyles();

    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      curvature: 0.35,
    });
    const [isEditing, setIsEditing] = useState(false);

    const selectedStyle = {
      stroke: isEditing ? 'rgba(0, 150, 143, 0.2)' : '#00968F',
      strokeWidth: 2,
      transition: 'stroke 0.2s, stroke-width 0.2s',
    };
    const edgeStyle = data?.hover ? edgeStyles.hover : edgeStyles.default;

    const [label, setLabel] = useState((data as CustomEdgeData)?.label ?? '');
    const reactFlowInstance = useReactFlow();
    const { setEdges } = reactFlowInstance;
    const handleLabelClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        if (label) {
          setIsEditing(true);
        }
      },
      [label],
    );

    const handleEdgeDoubleClick = useCallback(
      (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsEditing(true);
      },
      [label],
    );

    const updateEdgeData = useCallback(
      (edgeId: string, label: string) => {
        setEdges((eds) =>
          eds.map((edge) =>
            edge.id === edgeId ? { ...edge, data: { ...edge.data, label } } : edge,
          ),
        );
      },
      [setEdges],
    );

    const throttledUpdateEdgeData = useThrottledCallback(updateEdgeData, 300, {
      leading: true,
      trailing: true,
    });

    const handleLabelChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setLabel(e.target.value);
      throttledUpdateEdgeData(id, e.target.value);
    }, []);

    const handleLabelBlur = useCallback(() => {
      setIsEditing(false);
    }, []);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          setIsEditing(false);
          if (id) {
            updateEdgeData(id, label);
          }
        }
      },
      [id, label, updateEdgeData],
    );

    const handleDelete = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (id) {
        setEdges((eds) => eds.filter((e) => e.id !== id));
      }
    };

    return (
      <>
        <g onDoubleClick={handleEdgeDoubleClick}>
          <path
            className="react-flow__edge-path-selector"
            d={edgePath}
            fill="none"
            strokeWidth={20}
            stroke="transparent"
          />
          <BaseEdge
            path={edgePath}
            style={
              id.startsWith('temp-edge-')
                ? { ...edgeStyle, stroke: '#94a3b8', strokeDasharray: '10,10' }
                : selected
                  ? selectedStyle
                  : edgeStyle
            }
          />
        </g>

        {label || isEditing ? (
          <foreignObject
            width={120}
            height={80}
            x={labelX - 60}
            y={labelY - 40}
            className="edge-label"
            requiredExtensions="http://www.w3.org/1999/xhtml"
          >
            <div
              className={
                'w-full h-full overflow-y-scroll [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
              }
            >
              {isEditing ? (
                <TextArea
                  value={label}
                  onChange={handleLabelChange}
                  onBlur={handleLabelBlur}
                  onKeyDown={handleKeyDown}
                  className="nowheel text-[10px] w-full h-full bg-white resize-none overflow-y-scroll"
                  autoFocus
                  autoSize={{ minRows: 1, maxRows: 4 }}
                />
              ) : (
                label && (
                  <div
                    className="nowheel px-2 py-1 text-[10px] text-center text-gray-700 bg-opacity-0 rounded cursor-pointer break-all dark:text-gray-200"
                    onClick={handleLabelClick}
                  >
                    {label}
                  </div>
                )
              )}
            </div>
          </foreignObject>
        ) : null}

        {selected && (
          <foreignObject
            width={20}
            height={20}
            x={targetX - 20}
            y={targetY - 20}
            className="edge-delete-button"
            requiredExtensions="http://www.w3.org/1999/xhtml"
          >
            <DeleteButton handleDelete={handleDelete} />
          </foreignObject>
        )}
      </>
    );
  },
);
