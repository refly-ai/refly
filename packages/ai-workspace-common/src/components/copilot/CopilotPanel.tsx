import { memo } from 'react';

// Import the workflow data
import { DAILY_NEWS_WORKFLOW } from '@refly-packages/ai-workspace-common/data/daily-news-workflow';
import { WorkflowStepsPanel } from './WorkflowStepsPanel';

interface CopilotPanelProps {
  className?: string;
}

export const CopilotPanel = memo(({ className }: CopilotPanelProps) => {
  return (
    <div
      className={`w-full h-full bg-white rounded-xl border border-gray-200 shadow-sm ${className || ''}`}
    >
      <WorkflowStepsPanel workflow={DAILY_NEWS_WORKFLOW} workflowTitle="Daily AI News Digest" />
    </div>
  );
});

CopilotPanel.displayName = 'CopilotPanel';
