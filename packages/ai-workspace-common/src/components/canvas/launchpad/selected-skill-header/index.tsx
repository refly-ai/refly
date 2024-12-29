import { Button } from 'antd';
import { IconClose } from '@arco-design/web-react/icon';
import { SkillAvatar } from '@refly-packages/ai-workspace-common/components/skill/skill-avatar';
import { useTranslation } from 'react-i18next';
import { Skill } from '@refly/openapi-schema';
import classNames from 'classnames';
import './index.scss';

interface SelectedSkillHeaderProps {
  readonly?: boolean;
  skill?: Skill;
  className?: string;
  onClose?: () => void;
  setSelectedSkill?: (skill: Skill | null) => void;
}

export const SelectedSkillHeader = ({
  readonly,
  skill,
  className,
  onClose,
  setSelectedSkill,
}: SelectedSkillHeaderProps) => {
  const { t } = useTranslation();
  const skillDisplayName = skill ? t(`${skill?.name}.name`, { ns: 'skill' }) : '';

  return skill ? (
    <div className={classNames('selected-skill', className)}>
      <div className="selected-skill-profile">
        <SkillAvatar size={20} shape="circle" icon={skill?.icon} displayName={skillDisplayName} />
        <p>{skillDisplayName}</p>
      </div>
      {!readonly && (
        <div className="selected-skill-manage">
          <Button
            type="text"
            icon={<IconClose />}
            onClick={() => {
              onClose?.();
              setSelectedSkill?.(null);
            }}
          />
        </div>
      )}
    </div>
  ) : null;
};
