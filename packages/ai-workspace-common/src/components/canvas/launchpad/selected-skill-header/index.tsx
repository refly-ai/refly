import { Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { Skill } from '@refly/openapi-schema';
import classNames from 'classnames';
import { getSkillIcon } from '@refly-packages/ai-workspace-common/components/common/icon';
import './index.scss';
import { memo } from 'react';

interface SelectedSkillHeaderProps {
  readonly?: boolean;
  skill?: Skill;
  className?: string;
  onClose?: () => void;
  setSelectedSkill?: (skill: Skill | null) => void;
}

const SelectedSkillHeaderComponent = ({
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
        {getSkillIcon(skill?.name)}
        <p>{skillDisplayName}</p>
      </div>
      {!readonly && (
        <div className="selected-skill-manage">
          <Button
            type="text"
            icon={<CloseOutlined />}
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

export const SelectedSkillHeader = memo(SelectedSkillHeaderComponent, (prevProps, nextProps) => {
  return (
    prevProps.skill === nextProps.skill &&
    prevProps.className === nextProps.className &&
    prevProps.readonly === nextProps.readonly
  );
});

SelectedSkillHeader.displayName = 'SelectedSkillHeader';
