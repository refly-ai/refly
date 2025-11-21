import { BaseSkill } from './base';
import { SkillEngine } from './engine';
import { Agent } from './skills/agent';

export const createSkillInventory = (engine: SkillEngine): BaseSkill[] => {
  return [new Agent(engine)];
};
