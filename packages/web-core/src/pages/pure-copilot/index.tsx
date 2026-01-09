import { PureCopilot } from '@refly-packages/ai-workspace-common/components/pure-copilot';

const PureCopilotPage = () => {
  return (
    <div className="w-full h-full bg-refly-bg-body flex flex-col overflow-auto">
      <div className="my-auto w-full">
        <PureCopilot source="onboarding" />
      </div>
    </div>
  );
};

export default PureCopilotPage;
