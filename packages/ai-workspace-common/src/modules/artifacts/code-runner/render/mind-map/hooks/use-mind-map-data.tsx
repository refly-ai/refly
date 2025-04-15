import { useMemo } from 'react';
import { Node, Edge } from '@xyflow/react';
import { NodeData } from '../types';
import { getLayoutedElements } from '../utils/layout';

interface MindMapDataProps {
  mindMapData: NodeData;
  expandedNodes: Set<string>;
  handleToggleExpand: (nodeId: string) => void;
  handleLabelChange: (nodeId: string, label: string) => void;
  handleContentChange?: (nodeId: string, markdown: string, jsonContent: any) => void;
  handleColorChange?: (nodeId: string, colors: { bg: string; border: string }) => void;
  handleAddChild: (nodeId: string) => void;
  handleAddSibling: (nodeId: string) => void;
  handleDeleteNode: (nodeId: string) => void;
  nodeHeights?: Map<string, number>;
  onNodeResize?: (nodeId: string, width: number, height: number) => void;
  operatingNodeId?: string | null;
  hoveredNodeId?: string | null;
  readonly?: boolean;
}

const DEFAULT_NODE_HEIGHT = 60;
const DEFAULT_NODE_WITH_CHILDREN_HEIGHT = 80;
const DEFAULT_NODE_WIDTH = 400;
const DEFAULT_COLORS = { bg: 'rgb(239 246 255)', border: 'rgb(96 165 250)' };

// Node colors for different levels (for visual hierarchy)
const NODE_COLORS = [
  { bg: 'rgb(239 246 255)', border: 'rgb(96 165 250)' }, // blue-50, blue-400
  { bg: 'rgb(240 253 244)', border: 'rgb(74 222 128)' }, // green-50, green-400
  { bg: 'rgb(254 249 195)', border: 'rgb(250 204 21)' }, // yellow-50, yellow-400
  { bg: 'rgb(254 242 242)', border: 'rgb(248 113 113)' }, // red-50, red-400
  { bg: 'rgb(240 237 255)', border: 'rgb(139 92 246)' }, // purple-50, purple-400
];

// Default edge style - make lines more visible
const DEFAULT_EDGE_STYLE = {
  stroke: '#94a3b8', // More visible slate-400 color
  strokeWidth: 1.5,
};

// Dagre layout options for consistent mind map layout
const LAYOUT_OPTIONS = {
  direction: 'LR', // Left to right layout
  nodeSep: 10, // Node separation distance
  rankSep: 250, // Rank separation distance (between levels)
  ranker: 'network-simplex', // Use network-simplex for better hierarchical layouts
};

export const useMindMapData = ({
  mindMapData,
  expandedNodes = new Set(),
  handleToggleExpand,
  handleLabelChange,
  handleContentChange,
  handleColorChange,
  handleAddChild,
  handleAddSibling,
  handleDeleteNode,
  nodeHeights = new Map(),
  onNodeResize,
  operatingNodeId = null,
  hoveredNodeId = null,
  readonly = false,
}: MindMapDataProps) => {
  const { nodes, edges } = useMemo(() => {
    if (!mindMapData) {
      return { nodes: [], edges: [] };
    }

    try {
      const nodes: Node[] = [];
      const edges: Edge[] = [];
      const nodeMap = new Map<string, Node>();

      // Get node color based on level (for visual hierarchy)
      const getNodeColor = (level: number, isRoot: boolean) => {
        if (isRoot) return { ...DEFAULT_COLORS };
        return NODE_COLORS[level % NODE_COLORS.length] ?? DEFAULT_COLORS;
      };

      // Wrap callback functions with try/catch for error handling
      const safeToggleExpand = (nodeId: string) => {
        try {
          handleToggleExpand?.(nodeId);
        } catch (error) {
          console.error('Error toggling node expansion:', error);
        }
      };

      const safeLabelChange = (nodeId: string, label: string) => {
        try {
          handleLabelChange?.(nodeId, label || '');
        } catch (error) {
          console.error('Error changing node label:', error);
        }
      };

      const safeContentChange = (nodeId: string, markdown: string, jsonContent: any) => {
        try {
          handleContentChange?.(nodeId, markdown || '', jsonContent);
        } catch (error) {
          console.error('Error changing node content:', error);
        }
      };

      const safeColorChange = (nodeId: string, colors: { bg: string; border: string }) => {
        try {
          handleColorChange?.(nodeId, colors || DEFAULT_COLORS);
        } catch (error) {
          console.error('Error changing node color:', error);
        }
      };

      const safeAddChild = (nodeId: string) => {
        try {
          handleAddChild?.(nodeId);
        } catch (error) {
          console.error('Error adding child node:', error);
        }
      };

      const safeAddSibling = (nodeId: string) => {
        try {
          handleAddSibling?.(nodeId);
        } catch (error) {
          console.error('Error adding sibling node:', error);
        }
      };

      const safeDeleteNode = (nodeId: string) => {
        try {
          handleDeleteNode?.(nodeId);
        } catch (error) {
          console.error('Error deleting node:', error);
        }
      };

      const safeResizeNode = (nodeId: string, width: number, height: number) => {
        try {
          onNodeResize?.(nodeId, width, height);
        } catch (error) {
          console.error('Error resizing node:', error);
        }
      };

      // Process nodes recursively
      const processNode = (node: NodeData, level: number, parentId?: string) => {
        if (!node || typeof node !== 'object' || !node.id) {
          console.warn('Invalid node data:', node);
          return;
        }

        const hasChildren = Array.isArray(node.children) && node.children.length > 0;
        const isExpanded = expandedNodes?.has(node.id);
        const childCount = node.children?.length || 0;
        const isRoot = level === 0 && !parentId;
        const colors = node.colors || getNodeColor(level, isRoot);
        const isOperating = node.id === operatingNodeId;
        const isHovered = node.id === hoveredNodeId;

        // Get node height from map or use default height based on content
        const nodeHeight =
          nodeHeights?.get(node.id) ||
          (hasChildren ? DEFAULT_NODE_WITH_CHILDREN_HEIGHT : DEFAULT_NODE_HEIGHT);

        // Create the node
        const reactFlowNode: Node = {
          id: node.id,
          type: 'custom',
          data: {
            label: node.label || '',
            content: node.content || node.label || '',
            richTextContent: node.richTextContent,
            hasChildren,
            isExpanded,
            childCount,
            isRoot,
            isOperating,
            isHovered,
            onToggleExpand: safeToggleExpand,
            onLabelChange: safeLabelChange,
            onContentChange: safeContentChange,
            onColorChange: safeColorChange,
            onAddChild: safeAddChild,
            onAddSibling: safeAddSibling,
            onDeleteNode: safeDeleteNode,
            onResizeNode: safeResizeNode,
            colors: colors || DEFAULT_COLORS,
            level,
            readonly,
          },
          position: { x: 0, y: 0 }, // Initial position will be set by layout algorithm
          measured: {
            width: DEFAULT_NODE_WIDTH,
            height: nodeHeight,
          },
          // Set higher zIndex for hovered or operating nodes
          zIndex: isHovered ? 1000 : isOperating ? 500 : 0,
        };

        nodes.push(reactFlowNode);
        nodeMap.set(node.id, reactFlowNode);

        // Create edge if this node has a parent
        if (parentId) {
          const edgeId = `${parentId}-${node.id}`;

          edges.push({
            id: edgeId,
            source: parentId,
            target: node.id,
            sourceHandle: `${parentId}-source`,
            targetHandle: `${node.id}-target`,
            type: 'smoothstep',
            style: {
              ...DEFAULT_EDGE_STYLE,
              stroke: colors?.border || DEFAULT_EDGE_STYLE.stroke,
            },
            animated: false,
          });
        }

        // Process children if expanded
        if (isExpanded && Array.isArray(node.children)) {
          for (const child of node.children) {
            processNode(child, level + 1, node.id);
          }
        }
      };

      // Start processing from the root node
      processNode(mindMapData, 0);

      // Apply layout algorithm
      try {
        const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, LAYOUT_OPTIONS);
        return { nodes: layoutedNodes || nodes, edges };
      } catch (layoutError) {
        console.error('Error applying layout:', layoutError);
        return { nodes, edges };
      }
    } catch (error) {
      console.error('Error creating mind map data:', error);
      return { nodes: [], edges: [] };
    }
  }, [
    mindMapData,
    expandedNodes,
    handleToggleExpand,
    handleLabelChange,
    handleContentChange,
    handleColorChange,
    handleAddChild,
    handleAddSibling,
    handleDeleteNode,
    nodeHeights,
    onNodeResize,
    operatingNodeId,
    hoveredNodeId,
    readonly,
  ]);

  return {
    nodes: nodes || [],
    edges: edges || [],
  };
};
