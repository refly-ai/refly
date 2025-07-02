import { useTranslation } from 'react-i18next';
import { useRef, useMemo, useCallback, useState } from 'react';
import { useListSkills } from '@refly-packages/ai-workspace-common/hooks/use-find-skill';
import { Skill } from '@refly-packages/ai-workspace-common/requests/types.gen';
import { Dropdown, MenuProps } from 'antd';
import { getSkillIcon } from '@refly-packages/ai-workspace-common/components/common/icon';
import { cn } from '@refly/utils/cn';
import { LuLayoutGrid } from 'react-icons/lu';

const skillItemTitleClasses =
  'inline-block max-w-[calc(100% - 8px)] overflow-hidden text-ellipsis whitespace-nowrap';

const skillItemClasses =
  'h-7 px-1.5 rounded-md border border-solid border-gray-200 bg-white flex items-center justify-center ' +
  'dark:bg-gray-800 dark:border-gray-600 ' +
  'text-xs font-medium text-gray-500 dark:text-gray-400 ' +
  'transition-all duration-200 ease-in-out cursor-pointer ' +
  'hover:bg-gray-100 hover:border-gray-300 hover:text-green-600 ' +
  'dark:hover:bg-gray-700 dark:hover:border-gray-600 dark:hover:text-green-400 ' +
  'active:scale-95';

interface SkillDisplayProps {
  containCnt?: number;
  selectedSkill: Skill | null;
  setSelectedSkill: (skill: Skill) => void;
}
export const SkillDisplay = ({
  selectedSkill,
  setSelectedSkill,
  containCnt = 3,
}: SkillDisplayProps) => {
  const { t } = useTranslation();

  const [open, setOpen] = useState(false);

  const skillDisplayRef = useRef<HTMLDivElement>(null);

  const skills = useListSkills();

  const handleSkillSelect = useCallback(
    (skill: Skill) => {
      setSelectedSkill(skill);
    },
    [setSelectedSkill],
  );

  const displayedSkills = useMemo(() => skills.slice(0, containCnt), [skills]);
  const remainingSkills = useMemo(() => skills.slice(containCnt), [skills]);

  const skillItems = useMemo(() => {
    return displayedSkills?.map((item, index) => {
      const displayName = t(`${item?.name}.name`, { ns: 'skill' });
      return (
        <div
          key={item?.name || index}
          className={skillItemClasses}
          onClick={() => handleSkillSelect(item)}
        >
          {getSkillIcon(item?.name)}
          <span className={cn(skillItemTitleClasses, 'ml-1')}>{displayName}</span>
        </div>
      );
    });
  }, [displayedSkills, handleSkillSelect, t]);

  const dropdownItems: MenuProps['items'] = useMemo(() => {
    return remainingSkills?.map((item) => ({
      key: item.name,
      label: (
        <div className="flex items-center gap-2 text-[13px]">
          {getSkillIcon(item?.name)}
          <span className={skillItemTitleClasses}>{t(`${item?.name}.name`, { ns: 'skill' })}</span>
        </div>
      ),
      onClick: () => handleSkillSelect(item),
    }));
  }, [remainingSkills, handleSkillSelect, t]);

  const dropdownComponent = useMemo(
    () => (
      <Dropdown
        menu={{ items: dropdownItems }}
        trigger={['click']}
        placement="topLeft"
        open={open}
        onOpenChange={setOpen}
      >
        <div key="more" className={skillItemClasses}>
          <LuLayoutGrid className="" />
          <span className={cn(skillItemTitleClasses, 'ml-1')}>
            {t('copilot.skillDisplay.more')}
          </span>
        </div>
      </Dropdown>
    ),
    [dropdownItems, open, t],
  );

  if (selectedSkill) {
    return null;
  }

  return (
    <div className="flex flex-row gap-1 pb-1" ref={skillDisplayRef}>
      {skillItems}
      {remainingSkills.length > 0 && dropdownComponent}
    </div>
  );
};
