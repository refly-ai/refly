import { Avatar } from 'antd';
import { Icon } from '@refly/openapi-schema';
interface SkillAvatarProps {
  icon: Icon;
  size: number;
  displayName: string;
  shape?: 'circle' | 'square';
  noBorder?: boolean;
  background?: string;
}

export const SkillAvatar = (props: SkillAvatarProps) => {
  const { icon, size, displayName, shape, noBorder, background } = props;
  return (
    <Avatar
      shape={shape || 'square'}
      size={size}
      style={{
        background: background || '#fff',
        fontSize: (size / 3) * 2,
        border: `${noBorder ? 'none' : '1px solid rgba(0, 0, 0, 0.1)'}`,
        flexShrink: 0,
      }}
      className="skill-avatar"
    >
      {icon ? (
        icon.type === 'image' ? (
          <img src={icon.value} alt="avatar" />
        ) : (
          icon.value
        )
      ) : (
        <span style={{ color: '#00968F' }}>{displayName}</span>
      )}
    </Avatar>
  );
};
