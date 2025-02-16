import { createContext, useContext, useState } from 'react';

interface EditorPerformanceContextType {
  isNodeDragging: boolean;
  setIsNodeDragging: (dragging: boolean) => void;
  draggingNodeId: string | null;
  setDraggingNodeId: (nodeId: string | null) => void;
}

const EditorPerformanceContext = createContext<EditorPerformanceContextType>({
  isNodeDragging: false,
  setIsNodeDragging: () => {},
  draggingNodeId: null,
  setDraggingNodeId: () => {},
});

export const EditorPerformanceProvider = ({ children }) => {
  const [isNodeDragging, setIsNodeDragging] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  return (
    <EditorPerformanceContext.Provider
      value={{ isNodeDragging, setIsNodeDragging, draggingNodeId, setDraggingNodeId }}
    >
      {children}
    </EditorPerformanceContext.Provider>
  );
};

export const useEditorPerformance = () => useContext(EditorPerformanceContext);
