import { memo, useCallback, useMemo, type CSSProperties } from 'react';
import { BaseEdge, EdgeProps, getBezierPath, useReactFlow, Position } from '@xyflow/react';
import { useEdgeStyles } from '../constants';
import { Delete } from 'refly-icons';
import { useCanvasStoreShallow } from '@refly/stores';
import { useCanvasContext } from '@refly-packages/ai-workspace-common/context/canvas';

type DeleteButtonProps = {
  handleDelete: (event: React.MouseEvent) => void;
};

const DeleteButton = memo(({ handleDelete }: DeleteButtonProps) => {
  return (
    <div
      className="flex items-center justify-center w-6 h-6 rounded-full bg-refly-bg-body-z0 border-[1px] border-solid border-refly-func-danger-active hover:bg-refly-fill-hover"
      onClick={handleDelete}
    >
      <Delete size={12} />
    </div>
  );
});

DeleteButton.displayName = 'DeleteButton';

export const CustomEdge = memo(
  ({ sourceX, sourceY, targetX, targetY, selected, data, id, source, target }: EdgeProps) => {
    const { canvasId } = useCanvasContext();
    const edgeStyles = useEdgeStyles();
    const { setEdges, getNode } = useReactFlow();
    const sourceNode = getNode(source);
    const targetNode = getNode(target);
    const { nodePreviewId } = useCanvasStoreShallow((state) => ({
      nodePreviewId: state.config[canvasId]?.nodePreviewId,
    }));

    const highlight = useMemo(() => {
      return nodePreviewId === source || nodePreviewId === target;
    }, [nodePreviewId, source, target]);

    const isConnectedToStartNode = sourceNode?.type === 'start' || targetNode?.type === 'start';

    const targetNodeType = targetNode?.type;
    const targetMetadata = (targetNode?.data as { metadata?: { status?: string } } | undefined)
      ?.metadata;
    const targetStatus = targetMetadata?.status;

    const isSkillResponseTarget = targetNodeType === 'skillResponse';
    const isRunningStatus =
      isSkillResponseTarget && (targetStatus === 'executing' || targetStatus === 'waiting');
    const isFinishedStatus = isSkillResponseTarget && targetStatus === 'finish';
    const isFailedStatus = isSkillResponseTarget && targetStatus === 'failed';

    const [edgePath, labelX, labelY] = getBezierPath({
      sourceX: sourceX - 30,
      sourceY,
      targetX: targetX + 30 - (isRunningStatus ? 8 : 0),
      targetY,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      curvature: 0.35,
    });

    const selectedStyle: CSSProperties = {
      stroke: 'var(--refly-primary-default)',
      strokeWidth: 1.5,
      transition: 'stroke 0.2s, stroke-width 0.2s',
    };

    const defaultEdgeStyle: CSSProperties = (edgeStyles?.default ?? {}) as CSSProperties;
    const hoverEdgeStyle: CSSProperties = (edgeStyles?.hover ?? defaultEdgeStyle) as CSSProperties;
    const edgeStyle: CSSProperties = (
      data?.hover ? hoverEdgeStyle : defaultEdgeStyle
    ) as CSSProperties;

    const markerId = useMemo(() => `custom-edge-arrow-${id}`, [id]);

    const {
      baseEdgeStyle,
      isRunningEdge,
    }: {
      baseEdgeStyle: CSSProperties;
      isRunningEdge: boolean;
    } = useMemo(() => {
      const style: CSSProperties = {
        ...(edgeStyle ?? {}),
      };

      const isTempEdge = id?.startsWith?.('temp-edge-') ?? false;

      // Default dashed edge style
      style.strokeDasharray = '6 6';
      if (style.stroke && style.stroke !== 'transparent') {
        style.stroke = 'var(--refly-line)';
      }

      if (isFinishedStatus) {
        style.strokeDasharray = undefined;
        style.stroke = 'var(--refly-line)';
      }

      // Edge color when connected nodes are selected (keep dash or solid)
      if (highlight) {
        style.stroke = 'var(--refly-bg-dark)';
        style.strokeWidth = style.strokeWidth ?? 2;
      }

      // Temporary edges always use dashed default style
      if (isTempEdge) {
        style.strokeDasharray = '6 6';
        style.stroke = 'var(--refly-line)';
      }

      // Edge selected color (highest priority, keep dash or solid)
      // Override for skill response target status
      if (isRunningStatus) {
        style.strokeDasharray = undefined;
        style.stroke = '#0DB8AD';
        style.strokeWidth = 2;
      } else if (isFailedStatus) {
        style.strokeDasharray = '6 6';
        // style.stroke = 'var(--refly-func-danger-active)';
      }

      const mergedStyle: CSSProperties = {
        ...style,
      };

      if (selected) {
        mergedStyle.strokeWidth = selectedStyle.strokeWidth;
        if (!isRunningStatus) {
          mergedStyle.stroke = selectedStyle.stroke;
        }
      }

      return {
        baseEdgeStyle: mergedStyle,
        isRunningEdge: isRunningStatus,
      };
    }, [
      edgeStyle,
      selected,
      selectedStyle,
      id,
      sourceNode?.selected,
      targetNode?.selected,
      targetNode?.data?.metadata,
      targetNode?.type,
    ]);

    const markerColor = useMemo(() => {
      const strokeColor = baseEdgeStyle?.stroke;
      if (typeof strokeColor === 'string' && strokeColor.length > 0) {
        return strokeColor;
      }
      return 'var(--refly-primary-default)';
    }, [baseEdgeStyle]);

    const runningHighlightStrokeWidth = useMemo(() => {
      const widthValue = baseEdgeStyle?.strokeWidth;
      if (typeof widthValue === 'number') {
        return widthValue + 0.5;
      }
      const numericWidth = Number(widthValue ?? 0);
      const safeWidth = Number.isFinite(numericWidth) && numericWidth > 0 ? numericWidth : 2;
      return safeWidth + 0.5;
    }, [baseEdgeStyle?.strokeWidth]);

    const markerEndUrl = useMemo(() => `url(#${markerId})`, [markerId]);

    const handleDelete = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();
        if (!id) {
          return;
        }
        setEdges((currentEdges) => {
          if (!Array.isArray(currentEdges)) {
            return currentEdges;
          }
          return currentEdges.filter((edgeItem) => edgeItem?.id !== id);
        });
      },
      [id, setEdges],
    );

    return (
      <>
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerUnits="strokeWidth"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill={markerColor} />
          </marker>
        </defs>
        <g>
          <path
            className="react-flow__edge-path-selector"
            d={edgePath}
            fill="none"
            strokeWidth={20}
            stroke="transparent"
          />
          {/* Base edge path without marker */}
          <BaseEdge path={edgePath} style={baseEdgeStyle} />
          {/* Running animation path - above base edge */}
          {isRunningEdge ? (
            <path
              className="fill-none"
              d={edgePath}
              stroke="#81E9B5"
              strokeWidth={runningHighlightStrokeWidth}
              strokeLinecap="round"
              strokeDasharray="120 220"
              strokeDashoffset={0}
            >
              <animate
                attributeName="stroke-dashoffset"
                values="0;-340"
                dur="1s"
                repeatCount="indefinite"
              />
              <animate
                attributeName="stroke-opacity"
                values="0;1;0"
                keyTimes="0;0.4;1"
                dur="1s"
                repeatCount="indefinite"
              />
            </path>
          ) : null}
          {/* Marker path - above running animation */}
          <path
            d={edgePath}
            fill="none"
            stroke="transparent"
            strokeWidth={baseEdgeStyle?.strokeWidth ?? 1.5}
            markerEnd={markerEndUrl}
          />
        </g>

        {/* Only show delete button if selected and not connected to start node */}
        {selected && !isConnectedToStartNode && !isRunningEdge && (
          <foreignObject
            width={24}
            height={24}
            x={(labelX ?? targetX) - 12}
            y={(labelY ?? targetY) - 12}
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
