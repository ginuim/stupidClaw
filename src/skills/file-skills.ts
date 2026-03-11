import fs from "node:fs";
import {
  formatSkillsForPrompt,
  loadSkillsFromDir,
  type Skill
} from "@mariozechner/pi-coding-agent";
import { resolveSafePath } from "../memory/workspace-path.js";
import type { SkillMeta } from "./contracts.js";

const PROJECT_SKILL_DIRS = [
  {
    dir: resolveSafePath("skills"),
    source: "project:.stupidClaw/skills"
  }
];

export function loadStandardFileSkills(): Skill[] {
  const all: Skill[] = [];
  const seen = new Set<string>();

  for (const item of PROJECT_SKILL_DIRS) {
    if (!fs.existsSync(item.dir)) {
      continue;
    }
    const result = loadSkillsFromDir({
      dir: item.dir,
      source: item.source
    });
    for (const skill of result.skills) {
      if (seen.has(skill.name)) {
        continue;
      }
      seen.add(skill.name);
      all.push(skill);
    }
  }

  return all;
}

export function buildStandardFileSkillsPrompt(): string {
  const skills = loadStandardFileSkills();
  if (skills.length === 0) {
    return "";
  }
  return formatSkillsForPrompt(skills);
}

export function getStandardFileSkillMetas(): SkillMeta[] {
  return loadStandardFileSkills().map((skill) => ({
    name: skill.name,
    description: skill.description,
    exposure: "on_demand" as const
  }));
}
