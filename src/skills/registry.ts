import type { SkillDefinition } from "./contracts.js";
import { createManageCronJobsSkill } from "./cron/manage_cron_jobs.js";
import { getStandardFileSkillMetas } from "./file-skills.js";
import { createQueryHistorySkill } from "./memory/query_history.js";
import { createUpdateProfileSkill } from "./memory/update_profile.js";
import { createGetSystemTimeSkill } from "./system/get_system_time.js";
import { createListAvailableSkillsSkill } from "./system/list_available_skills.js";
import { createSkillCreatorSkill } from "./system/skill_creator.js";
import { createGetWeatherSkill } from "./web/get_weather.js";
import { createWebSearchSkill } from "./web/web_search.js";

export interface SkillRegistry {
  all: SkillDefinition[];
  always: SkillDefinition[];
  onDemand: SkillDefinition[];
}

export interface SkillRegistryOptions {
  getDefaultChatId?: () => string | undefined;
}

export function createSkillRegistry(options: SkillRegistryOptions = {}): SkillRegistry {
  const queryHistory = createQueryHistorySkill();
  const updateProfile = createUpdateProfileSkill();
  const skillCreator = createSkillCreatorSkill();
  const manageCronJobs = createManageCronJobsSkill({
    getDefaultChatId: options.getDefaultChatId
  });
  const baseSkills: SkillDefinition[] = [
    createGetSystemTimeSkill(),
    queryHistory,
    updateProfile,
    skillCreator,
    manageCronJobs,
    createWebSearchSkill(),
    createGetWeatherSkill()
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
