import { useState } from 'react';
import { Splitter } from 'antd';
import { ResourceView } from '@refly-packages/ai-workspace-common/components/resource-view';
import ResourceDeck from '@refly-packages/ai-workspace-common/components/resource-view/resource-deck';
interface ResourceNodePreviewProps {
  resourceId?: string;
}

export const ResourceNodePreview = ({ resourceId }: ResourceNodePreviewProps) => {
  // Track deck size state locally
  const [deckSize, setDeckSize] = useState<number>(0);

  // If no resourceId provided, show placeholder
  if (!resourceId) {
    return (
      <div className="h-full flex items-center justify-center bg-white rounded p-3">
        <span className="text-gray-500">No resource selected</span>
      </div>
    );
  }

  return (
    <div className="h-full bg-white rounded">
      <ResourceView resourceId={resourceId} deckSize={deckSize} setDeckSize={setDeckSize} />
      {/* <Splitter layout="vertical" onResize={(sizes) => setDeckSize(sizes[1])}>
        <Splitter.Panel className="min-h-[200px]">
        <ResourceView resourceId={resourceId} deckSize={deckSize} setDeckSize={setDeckSize} />
        </Splitter.Panel>
        <Splitter.Panel size={deckSize} max={'80%'} collapsible>
          <ResourceDeck domain="resource" id={resourceId} />
        </Splitter.Panel>
      </Splitter> */}
    </div>
  );
};
