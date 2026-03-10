import type { SkillDefinition } from "./contracts";
import { getStandardFileSkillMetas } from "./file-skills";
import { createQueryHistorySkill } from "./memory/query_history";
import { createUpdateProfileSkill } from "./memory/update_profile";
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
  const updateProfile = createUpdateProfileSkill();
  const skillCreator = createSkillCreatorSkill();
  const baseSkills: SkillDefinition[] = [
    createGetSystemTimeSkill(),
    queryHistory,
    updateProfile,
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

  const all = [baseSkills[0], listAvailable, ...baseSkills.slice(1)];
  const always = all.filter((skill) => skill.exposure === "always");
  const onDemand = all.filter((skill) => skill.exposure === "on_demand");

  return { all, always, onDemand };
}
