import { Type } from "@mariozechner/pi-ai";
import type { SkillDefinition, SkillMeta } from "../contracts.js";

export function createListAvailableSkillsSkill(
  getAllSkills: () => SkillMeta[]
): SkillDefinition {
  return {
    name: "list_available_skills",
    description: "列出可按需调用的技能目录和用途",
    exposure: "always",
    tool: {
      name: "list_available_skills",
      label: "List Available Skills",
      description: "List skill catalog with exposure levels",
      parameters: Type.Object({}),
      execute: async () => ({
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                skills: getAllSkills().map((skill) => ({
                  name: skill.name,
                  exposure: skill.exposure,
                  description: skill.description
                })),
                guidance:
                  "先使用 always 技能；需要历史等能力时再调用 on_demand 技能。注意：read/write/edit/bash 是内建基础工具，不属于 skills 列表，默认始终可用，且默认工作目录是 .stupidClaw/workspace。"
              },
              null,
              2
            )
          }
        ],
        details: {}
      })
    }
  };
}
