import { useState, useRef, useEffect, useCallback } from 'react';
import MindMapViewer from './viewer';
import { ReactFlowProvider } from '@xyflow/react';
import { NodeData } from './types';
import { useThrottledCallback } from 'use-debounce';
import { jsonrepair } from 'jsonrepair';
import { useTranslation } from 'react-i18next';
import { IconLoading } from '@refly-packages/ai-workspace-common/components/common/icon';

interface MindMapRendererProps {
  content: string;
  width: string;
  height: string;
  readonly?: boolean;
  onChange?: (content: string) => void;
}

export default function MindMapRenderer({
  content,
  width,
  height,
  readonly,
  onChange,
}: MindMapRendererProps) {
  const [parsedData, setParsedData] = useState<NodeData | null>(null);
  const { t } = useTranslation();

  // Track the last JSON string to prevent duplicate updates
  const lastJsonString = useRef<string>(content);

  // Throttle mind map updates to prevent too frequent updates
  const handleMindMapChange = useThrottledCallback(
    (updatedData: NodeData) => {
      if (!onChange || readonly) return;

      try {
        console.log('updatedData', updatedData);
        // Convert the updated data to a JSON string with pretty formatting
        const jsonString = JSON.stringify(updatedData, null, 2);

        // Only emit change if the JSON actually changed
        if (jsonString !== lastJsonString.current) {
          lastJsonString.current = jsonString;
          onChange(jsonString);
        }
      } catch (err) {
        console.error('Failed to stringify mind map data to JSON:', err);
      }
    },
    300, // 300ms throttle to prevent rapid updates
  );

  // Memoize the onChange handler to prevent recreating it on every render
  const memoizedOnChange = useCallback(
    (updatedData: NodeData) => {
      handleMindMapChange(updatedData);
    },
    [handleMindMapChange],
  );

  useEffect(() => {
    // Try parsing as JSON with repair for incomplete JSON
    try {
      if (!content) return;

      // Use jsonrepair to fix potentially incomplete JSON
      const repairedJson = jsonrepair(content);
      const jsonData = JSON.parse(repairedJson) as NodeData;

      // Basic validation
      if (!jsonData || typeof jsonData !== 'object') {
        console.warn('Invalid JSON data structure');
        return;
      }

      // Ensure minimum required structure
      if (!jsonData.id) {
        jsonData.id = 'root';
      }

      if (!Array.isArray(jsonData.children)) {
        jsonData.children = [];
      }

      if (!jsonData.label && !jsonData.content) {
        jsonData.label = 'Main Topic';
        jsonData.content = 'Main Topic';
      }

      // Only update state if there's an actual change
      if (JSON.stringify(jsonData) !== JSON.stringify(parsedData)) {
        setParsedData(jsonData);
        lastJsonString.current = content;
      }
    } catch (err) {
      console.error('Failed to parse JSON:', err);
      // No need to set parse error - just don't update parsedData
    }
  }, [content, parsedData]);

  if (!parsedData) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-4 text-gray-500 bg-gray-50">
        <IconLoading className="h-3 w-3 animate-spin text-green-500 mb-2" />
        <div>{t('canvas.nodes.mindMap.invalidMindMapData')}</div>
      </div>
    );
  }

  return (
    <div style={{ width, height }}>
      <ReactFlowProvider>
        <MindMapViewer
          data={parsedData}
          onChange={memoizedOnChange}
          onNodeClick={() => {}} // Empty handler since we don't need this functionality
          readonly={readonly}
        />
      </ReactFlowProvider>
    </div>
  );
}
