'use client';

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { ReactFlow, Controls, Background, BackgroundVariant } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { NodeData } from './types';
import { nodeTypes } from './nodes';
import { useMindMapOperation } from './hooks/use-mind-map-operation';
import { useMindMapData } from './hooks/use-mind-map-data';
import { useNodePosition } from '@refly-packages/ai-workspace-common/hooks/canvas/use-node-position';
import { safeStringifyJSON } from '@refly-packages/utils/parse';

interface MindMapProps {
  data: NodeData;
  onNodeClick: (node: NodeData) => void;
  onChange?: (updatedData: NodeData) => void;
  readonly?: boolean;
}

const proOptions = { hideAttribution: true };

const MindMap = React.memo(
  function MindMap({ data, onNodeClick, onChange, readonly = false }: MindMapProps) {
    const [mindMapData, setMindMapData] = useState<NodeData>(data);
    const reactFlowInstance = useRef<any>(null);
    const [lastAddedNodeId, setLastAddedNodeId] = useState<string>('');
    const [nodeHeights, setNodeHeights] = useState<Map<string, number>>(new Map());
    const [operatingNodeId, setOperatingNodeId] = useState<string | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const { setNodeCenter } = useNodePosition();
    const dataRef = useRef<NodeData>(data);
    const previousDataStringRef = useRef<string>(safeStringifyJSON(data));
    const updateCountRef = useRef<number>(0);

    console.log('mindMapData', mindMapData);

    // Update internal state when data reference changes
    useEffect(() => {
      const currentDataString = safeStringifyJSON(data);
      if (currentDataString !== previousDataStringRef.current) {
        dataRef.current = data;
        setMindMapData(data);
        previousDataStringRef.current = currentDataString;
        updateCountRef.current = 0; // Reset update counter when external data changes
      }
    }, [data]);

    // Custom setMindMapData that also updates parent
    const updateMindMapData = useCallback(
      (newData: NodeData) => {
        const newDataString = safeStringifyJSON(newData);
        const currentDataString = safeStringifyJSON(mindMapData);

        // Prevent circular updates by comparing stringified data
        if (newDataString === currentDataString) {
          return;
        }

        // Limit number of internal updates to prevent infinite loops
        // if (updateCountRef.current > 5) {
        //   console.warn('Too many mind map updates, breaking potential infinite loop');
        //   return;
        // }

        updateCountRef.current++;
        setMindMapData(newData);
        dataRef.current = newData;
        previousDataStringRef.current = newDataString;

        // Notify parent of change with the updated node data
        if (onChange && !readonly) {
          onChange(newData);
        }
      },
      [onChange, mindMapData, readonly],
    );

    // Initialize expanded nodes with memoization to avoid recalculation
    const [expandedNodes, setExpandedNodes] = useState<Set<string>>(() => {
      const allIds = new Set<string>();
      const collectIds = (node: NodeData) => {
        if (!node?.id) return;
        allIds.add(node.id);
        if (Array.isArray(node?.children)) {
          for (const child of node.children) {
            collectIds(child);
          }
        }
      };
      collectIds(data);
      return allIds;
    });

    const {
      handleToggleExpand,
      handleLabelChange,
      handleContentChange,
      handleColorChange,
      handleAddChild,
      handleAddSibling,
      handleDeleteNode,
    } = useMindMapOperation({
      mindMapData,
      setMindMapData: updateMindMapData,
      expandedNodes,
      setExpandedNodes,
      lastAddedNodeId,
      setLastAddedNodeId,
      readonly,
    });

    // Handle node resizing and trigger layout update
    const handleNodeResize = useCallback((nodeId: string, _width: number, height: number) => {
      setNodeHeights((prev) => {
        const newHeights = new Map(prev);
        newHeights.set(nodeId, height);
        return newHeights;
      });
    }, []);

    // Memoize useMindMapData input values to prevent unnecessary recalculations
    const mindMapInputs = useMemo(
      () => ({
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
        onNodeResize: handleNodeResize,
        operatingNodeId,
        hoveredNodeId,
        readonly,
      }),
      [
        JSON.stringify(mindMapData),
        expandedNodes,
        handleToggleExpand,
        handleLabelChange,
        handleContentChange,
        handleColorChange,
        handleAddChild,
        handleAddSibling,
        handleDeleteNode,
        handleNodeResize,
        operatingNodeId,
        hoveredNodeId,
        readonly,
      ],
    );

    const { nodes, edges } = useMindMapData(mindMapInputs);

    // Memoize the findNodeData function to improve performance
    const findNodeData = useMemo(() => {
      return (id: string, root: NodeData): NodeData | undefined => {
        if (root?.id === id) return root;
        if (!Array.isArray(root?.children)) return undefined;

        for (const child of root.children) {
          const found = findNodeData(id, child);
          if (found) return found;
        }

        return undefined;
      };
    }, []);

    const handleNodeClick = useCallback(
      (event: React.MouseEvent, node: any) => {
        // If node is in edit mode, don't propagate click - let the editor handle it
        if ((node?.id === operatingNodeId || readonly) && event.target) {
          const target = event.target as HTMLElement;
          // Allow text selection in both operating and readonly mode
          if (target.closest('.ProseMirror') || target.closest('.select-text')) {
            event.stopPropagation();
            return;
          }
        }

        // Set operating node if clicking directly on node (not a button), even in readonly mode for text selection
        const target = event.target as HTMLElement;
        if (!target.closest('button')) {
          setOperatingNodeId(node?.id);
        }

        const originalData = findNodeData(node?.id, mindMapData);
        if (originalData) {
          onNodeClick(originalData);
        }
      },
      [mindMapData, onNodeClick, operatingNodeId, findNodeData, readonly],
    );

    // Reset operating node when clicking on the canvas
    const handlePaneClick = useCallback(() => {
      setOperatingNodeId(null);
    }, []);

    // Handler for node hover events
    const handleNodeHover = useCallback((nodeId: string | null) => {
      setHoveredNodeId(nodeId);
    }, []);

    // Focus on newly added node when lastAddedNodeId changes
    useEffect(() => {
      if (lastAddedNodeId && !readonly) {
        // Use setTimeout to ensure the node is rendered before attempting to focus
        const timerId = setTimeout(() => {
          setNodeCenter(lastAddedNodeId, true);
          setOperatingNodeId(lastAddedNodeId);
        }, 100);

        return () => clearTimeout(timerId);
      }
    }, [lastAddedNodeId, setNodeCenter, readonly]);

    // Memoize default edge options
    const defaultEdgeOptions = useMemo(
      () => ({
        type: 'step',
        style: { stroke: '#94a3b8', strokeWidth: 1.5 },
      }),
      [],
    );

    // Memoize flow options
    const fitViewOptions = useMemo(() => ({ padding: 0.2 }), []);

    return (
      <div className="h-full w-full rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodeClick={handleNodeClick}
          onPaneClick={handlePaneClick}
          nodesDraggable={!readonly}
          nodeTypes={nodeTypes}
          onInit={(instance) => {
            reactFlowInstance.current = instance;
          }}
          fitView
          fitViewOptions={fitViewOptions}
          defaultEdgeOptions={defaultEdgeOptions}
          proOptions={proOptions}
          minZoom={0.2}
          maxZoom={1.5}
          panOnScroll={true}
          zoomOnScroll={true}
          selectionOnDrag={false}
          panOnDrag={!operatingNodeId || readonly}
          onNodeMouseEnter={(_e, node) => handleNodeHover(node.id)}
          onNodeMouseLeave={() => handleNodeHover(null)}
        >
          <Controls
            showInteractive={false}
            className="bg-white border border-gray-200 shadow-sm"
            position="bottom-right"
          />
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1.5}
            color="#94a3b8"
            bgColor="#eef4f7"
          />
        </ReactFlow>
      </div>
    );
  },
  (prevProps, nextProps) => {
    // Custom comparison function for memoization
    return (
      safeStringifyJSON(prevProps.data) === safeStringifyJSON(nextProps.data) &&
      prevProps.readonly === nextProps.readonly &&
      prevProps.onNodeClick === nextProps.onNodeClick &&
      prevProps.onChange === nextProps.onChange
    );
  },
);

export default MindMap;
