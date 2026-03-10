import type { SkillDefinition } from "./contracts";
import { getStandardFileSkillMetas } from "./file-skills";
import { createQueryHistorySkill } from "./memory/query_history";
import { createGetSystemTimeSkill } from "./system/get_system_time";
import { createListAvailableSkillsSkill } from "./system/list_available_skills";
import { createSkillCreatorSkill } from "./system/skill_creator";

export interface SkillRegistry {
  all: SkillDefinition[];
  always: SkillDefinition[];
  onDemand: SkillDefinition[];
}

export function createSkillRegistry(): SkillRegistry {
  const queryHistory = createQueryHistorySkill();
  const skillCreator = createSkillCreatorSkill();
  const baseSkills: SkillDefinition[] = [
    createGetSystemTimeSkill(),
    queryHistory,
    skillCreator
  ];
  const listAvailable = createListAvailableSkillsSkill(() => {
    const builtIn = baseSkills.map((skill) => ({
      name: skill.name,
      description: skill.description,
      exposure: skill.exposure
    }));
    return [...builtIn, ...getStandardFileSkillMetas()];
  });

  const all = [baseSkills[0], listAvailable, baseSkills[1], baseSkills[2]];
  const always = all.filter((skill) => skill.exposure === "always");
  const onDemand = all.filter((skill) => skill.exposure === "on_demand");

  return { all, always, onDemand };
}
