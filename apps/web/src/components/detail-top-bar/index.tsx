import { Button } from 'antd';
import { TiArrowBackOutline } from 'react-icons/ti';
import { useNavigate } from 'react-router-dom';
import { SiderCollapse } from '@refly-packages/ai-workspace-common/components/canvas/top-toolbar/sider-collapse';
import { useTranslation } from 'react-i18next';
export const DetailTopBar = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  return (
    <div
      className="h-16 min-h-[64px] flex items-center justify-start px-4 box-border"
      style={{
        borderBottom: 'solid 1px #f0f0f0',
      }}
    >
      <SiderCollapse />

      <Button
        type="text"
        icon={<TiArrowBackOutline size={16} className="text-gray-500" />}
        onClick={() => {
          navigate(-1);
        }}
      >
        <span className="text-gray-500">{t('common.back')}</span>
      </Button>
    </div>
  );
};
