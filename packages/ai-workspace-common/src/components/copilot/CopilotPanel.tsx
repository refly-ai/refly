import { memo } from 'react';
import { Empty } from 'antd';

interface CopilotPanelProps {
  className?: string;
}

export const CopilotPanel = memo(({ className }: CopilotPanelProps) => {
  return (
    <div
      className={`w-full h-full bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col ${className || ''}`}
    >
      {/* Header */}
      <div className="p-4 border-b border-gray-100 flex-shrink-0">
        <h3 className="font-semibold text-gray-900 text-lg">AI Copilot</h3>
        <p className="text-sm text-gray-600 mt-1">
          AI Copilot workflows are automatically triggered based on your chat input. Try typing
          "Daily AI News Digest" to activate the news workflow.
        </p>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center">
        <Empty
          description={
            <div className="text-center">
              <p className="text-gray-600 mb-2">No active workflow</p>
              <p className="text-sm text-gray-500">
                Workflows will appear here when triggered by your input
              </p>
            </div>
          }
        />
      </div>
    </div>
  );
});

CopilotPanel.displayName = 'CopilotPanel';
