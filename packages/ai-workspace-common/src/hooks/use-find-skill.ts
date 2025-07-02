import { useMemo } from 'react';
import { useListSkills as useListSkillsQuery } from '@refly-packages/ai-workspace-common/queries';

export const useListSkills = () => {
  const { data: skillData } = useListSkillsQuery({}, null, {
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: false,
    staleTime: 60 * 1000, // Data fresh for 1 minute
    gcTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  return skillData?.data.filter((skill) => skill.name !== 'imageGeneration') ?? [];
};

export const useFindSkill = (skillName: string) => {
  const skills = useListSkills();
  const skill = useMemo(
    () => skills?.find((skill) => skill.name === skillName),
    [skills, skillName],
  );
  return skill;
};
