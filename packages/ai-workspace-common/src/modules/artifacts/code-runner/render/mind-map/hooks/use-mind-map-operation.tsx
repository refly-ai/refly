import { useCallback } from 'react';
import { NodeData } from '../types';

export const useMindMapOperation = ({
  mindMapData,
  setMindMapData,
  setExpandedNodes,
  setLastAddedNodeId,
  readonly = false,
}: {
  mindMapData: NodeData;
  setMindMapData: (data: NodeData) => void;
  expandedNodes: Set<string>;
  setExpandedNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
  lastAddedNodeId: string;
  setLastAddedNodeId: (id: string) => void;
  readonly?: boolean;
}) => {
  const handleToggleExpand = useCallback(
    (nodeId: string) => {
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        if (next.has(nodeId)) {
          next.delete(nodeId);
        } else {
          next.add(nodeId);
        }
        return next;
      });
    },
    [setExpandedNodes],
  );

  const handleLabelChange = useCallback(
    (nodeId: string, newLabel: string) => {
      if (readonly) return;

      const updateNodeLabel = (node: NodeData): NodeData => {
        if (node.id === nodeId) {
          return { ...node, label: newLabel };
        }
        if (node.children) {
          return {
            ...node,
            children: node.children.map(updateNodeLabel),
          };
        }
        return node;
      };

      setMindMapData(updateNodeLabel(mindMapData));
    },
    [mindMapData, setMindMapData, readonly],
  );

  // Handle rich text content changes
  const handleContentChange = useCallback(
    (nodeId: string, markdown: string, jsonContent: any) => {
      if (readonly) return;

      const updateNodeContent = (node: NodeData): NodeData => {
        if (node.id === nodeId) {
          return {
            ...node,
            content: markdown,
            richTextContent: jsonContent,
          };
        }
        if (node.children) {
          return {
            ...node,
            children: node.children.map(updateNodeContent),
          };
        }
        return node;
      };

      setMindMapData(updateNodeContent(mindMapData));
    },
    [mindMapData, setMindMapData, readonly],
  );

  // Handle node color changes
  const handleColorChange = useCallback(
    (nodeId: string, colors: { bg: string; border: string }) => {
      if (readonly) return;

      const updateNodeColor = (node: NodeData): NodeData => {
        if (node.id === nodeId) {
          return {
            ...node,
            colors,
          };
        }
        if (node.children) {
          return {
            ...node,
            children: node.children.map(updateNodeColor),
          };
        }
        return node;
      };

      setMindMapData(updateNodeColor(mindMapData));
    },
    [mindMapData, setMindMapData, readonly],
  );

  const handleAddChild = useCallback(
    (nodeId: string) => {
      if (readonly) return;

      const newId = `node-${Date.now()}`;

      const addChildToNode = (node: NodeData): NodeData => {
        if (node.id === nodeId) {
          const children = node.children || [];
          return {
            ...node,
            children: [
              ...children,
              { id: newId, label: 'New Node', content: 'New Node', children: [] },
            ],
          };
        }
        if (node.children) {
          return {
            ...node,
            children: node.children.map(addChildToNode),
          };
        }
        return node;
      };

      const newData = addChildToNode(mindMapData);
      setMindMapData(newData);

      // Ensure the parent node is expanded
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        next.add(nodeId);
        next.add(newId); // Also add the new node to expanded nodes
        return next;
      });

      // Set the node to focus on after rerender
      setLastAddedNodeId(newId);
    },
    [mindMapData, setMindMapData, setExpandedNodes, setLastAddedNodeId, readonly],
  );

  const handleAddSibling = useCallback(
    (nodeId: string) => {
      if (readonly) return;

      const newId = `node-${Date.now()}`;

      const findParentAndAddSibling = (node: NodeData): NodeData => {
        if (node.children?.some((child) => child.id === nodeId)) {
          return {
            ...node,
            children: [
              ...node.children,
              { id: newId, label: 'New Node', content: 'New Node', children: [] },
            ],
          };
        }
        if (node.children) {
          return {
            ...node,
            children: node.children.map((child) => findParentAndAddSibling(child)),
          };
        }
        return node;
      };

      // If it's a root node, we just add it at the same level as the root
      if (nodeId === mindMapData.id) {
        const newRoot = {
          id: 'root',
          label: 'Root',
          content: 'Root',
          children: [
            mindMapData,
            { id: newId, label: 'New Node', content: 'New Node', children: [] },
          ],
        };
        setMindMapData(newRoot);
        // Add the new root and new node to expanded nodes
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          next.add('root');
          next.add(newId);
          return next;
        });
      } else {
        const newData = findParentAndAddSibling(mindMapData);
        setMindMapData(newData);
        // Add the new node to expanded nodes
        setExpandedNodes((prev) => {
          const next = new Set(prev);
          next.add(newId);
          return next;
        });
      }

      // Set the node to focus on after rerender
      setLastAddedNodeId(newId);
    },
    [mindMapData, setMindMapData, setExpandedNodes, setLastAddedNodeId, readonly],
  );

  // Add handleDeleteNode function
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      if (readonly) return;

      // Don't delete the root node
      if (nodeId === mindMapData.id || nodeId === 'root') {
        return;
      }

      const deleteNodeById = (node: NodeData): NodeData => {
        // If this node has children that include the target node
        if (node.children) {
          // Filter out the node to delete
          const filteredChildren = node.children.filter((child) => child.id !== nodeId);

          // If we removed a node, return the updated node
          if (filteredChildren.length !== node.children.length) {
            return {
              ...node,
              children: filteredChildren,
            };
          }

          // Otherwise, recursively search in children
          return {
            ...node,
            children: node.children.map(deleteNodeById),
          };
        }

        return node;
      };

      const newData = deleteNodeById(mindMapData);
      setMindMapData(newData);

      // Remove the deleted node from expanded nodes
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        next.delete(nodeId);
        return next;
      });
    },
    [mindMapData, setMindMapData, setExpandedNodes, readonly],
  );

  return {
    handleToggleExpand,
    handleLabelChange,
    handleContentChange,
    handleColorChange,
    handleAddChild,
    handleAddSibling,
    handleDeleteNode,
  };
};
