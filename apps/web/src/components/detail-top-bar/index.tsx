import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { AiOutlineMenuUnfold } from 'react-icons/ai';
import { Button } from 'antd';
import { Divider } from 'antd';
import SiderPopover from '../../pages/sider-popover';
import { TiArrowBackOutline } from 'react-icons/ti';
import { useNavigate } from 'react-router-dom';

export const DetailTopBar = () => {
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  const navigate = useNavigate();
  return (
    <div
      className="h-16 min-h-[64px] flex items-center justify-start px-4 box-border"
      style={{
        borderBottom: 'solid 1px #f0f0f0',
      }}
    >
      {collapse && (
        <>
          <SiderPopover>
            <Button
              type="text"
              icon={<AiOutlineMenuUnfold size={16} className="text-gray-500" />}
              onClick={() => {
                setCollapse(!collapse);
              }}
            />
          </SiderPopover>
          <Divider type="vertical" className="pr-[4px] h-4" />
        </>
      )}
      <Button
        type="text"
        icon={<TiArrowBackOutline size={16} className="text-gray-500" />}
        onClick={() => {
          navigate(-1);
        }}
      >
        <span className="text-gray-500">返回上一页</span>
      </Button>
    </div>
  );
};
