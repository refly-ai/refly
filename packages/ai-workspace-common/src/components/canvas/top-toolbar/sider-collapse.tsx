import { useSiderStoreShallow } from '@refly-packages/ai-workspace-common/stores/sider';
import { AiOutlineMenuUnfold } from 'react-icons/ai';
import { Button, Divider } from 'antd';
import SiderPopover from '../../../../../../apps/web/src/pages/sider-popover';

export const SiderCollapse = ({
  showDivider = true,
  size = 16,
}: { showDivider?: boolean; size?: number }) => {
  const { collapse, setCollapse } = useSiderStoreShallow((state) => ({
    collapse: state.collapse,
    setCollapse: state.setCollapse,
  }));
  return collapse ? (
    <div className="flex h-16 items-center">
      <SiderPopover>
        <Button
          type="text"
          icon={<AiOutlineMenuUnfold size={size} className="text-gray-500" />}
          onClick={() => {
            setCollapse(!collapse);
          }}
        />
      </SiderPopover>
      {showDivider && <Divider type="vertical" className="pr-[4px] h-4" />}
    </div>
  ) : null;
};
