import { createContext, useContext, useState } from 'react';

interface EditorPerformanceContextType {
  isNodeDragging: boolean;
  draggingNodeId: string | null;
  setIsNodeDragging: (isDragging: boolean) => void;
  setDraggingNodeId: (nodeId: string | null) => void;
}

const EditorPerformanceContext = createContext<EditorPerformanceContextType>({
  isNodeDragging: false,
  setIsNodeDragging: () => {},
  draggingNodeId: null,
  setDraggingNodeId: () => {},
});

export const EditorPerformanceProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [isNodeDragging, setIsNodeDragging] = useState(false);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);

  return (
    <EditorPerformanceContext.Provider
      value={{
        isNodeDragging,
        setIsNodeDragging,
        draggingNodeId,
        setDraggingNodeId,
      }}
    >
      {children}
    </EditorPerformanceContext.Provider>
  );
};

export const useEditorPerformance = () => useContext(EditorPerformanceContext);
