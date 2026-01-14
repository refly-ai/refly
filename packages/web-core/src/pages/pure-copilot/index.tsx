import { PureCopilot } from '@refly-packages/ai-workspace-common/components/pure-copilot';
import { Home } from 'refly-icons';
import { Button, Tooltip } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const PureCopilotPage = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div className="relative w-full h-full bg-refly-bg-body flex flex-col overflow-auto">
      <Tooltip
        title={<div className="text-xs">{t('canvas.toolbar.backDashboard')}</div>}
        arrow={false}
      >
        <Button
          type="text"
          className="absolute top-4 left-4 !w-8 !h-8"
          icon={<Home size={24} />}
          onClick={() => navigate('/workspace')}
        />
      </Tooltip>
      <div className="my-auto w-full">
        <PureCopilot source="onboarding" />
      </div>
    </div>
  );
};

export default PureCopilotPage;
