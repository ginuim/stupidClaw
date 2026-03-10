import fs from "node:fs/promises";
import path from "node:path";
import { Type } from "@mariozechner/pi-ai";
import { resolveSafePath } from "../../memory/workspace-path";
import type { SkillDefinition } from "../contracts";

const PROJECT_SKILLS_ROOT = resolveSafePath("skills");

function normalizeSkillName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildSkillMarkdown(
  name: string,
  description: string,
  steps: string[]
): string {
  const stepLines =
    steps.length > 0
      ? steps.map((step, idx) => `${idx + 1}. ${step}`).join("\n")
      : "1. 明确用户目标\n2. 按最小复杂度执行\n3. 返回结构化结果";

  return [
    "---",
    `name: ${name}`,
    `description: ${description}`,
    "---",
    "",
    `# ${name}`,
    "",
    `Use this skill when ${description}.`,
    "",
    "## Steps",
    stepLines,
    ""
  ].join("\n");
}

export function createSkillCreatorSkill(): SkillDefinition {
  return {
    name: "skill_creator",
    description: "在项目中创建标准 SKILL.md 文件",
    exposure: "on_demand",
    tool: {
      name: "skill_creator",
      label: "Skill Creator",
      description: "Create a standard SKILL.md in .stupidClaw/skills",
      parameters: Type.Object({
        name: Type.String({
          description: "技能名，建议英文或拼音，例如 summarize_daily_news"
        }),
        description: Type.String({
          description: "技能用途描述，简洁一句话"
        }),
        steps: Type.Optional(
          Type.Array(
            Type.String({
              description: "技能执行步骤"
            })
          )
        ),
        overwrite: Type.Optional(
          Type.Boolean({
            description: "是否覆盖已存在技能，默认 false"
          })
        )
      }),
      execute: async (_toolCallId, rawParams) => {
        const params = rawParams as {
          name: string;
          description: string;
          steps?: string[];
          overwrite?: boolean;
        };

        const normalizedName = normalizeSkillName(params.name);
        if (!normalizedName) {
          return {
            content: [
              {
                type: "text",
                text: "创建失败：name 无效，至少需要一个字母或数字。"
              }
            ],
            details: {}
          };
        }

        const skillDir = resolveSafePath(`skills/${normalizedName}`);
        const filePath = path.join(skillDir, "SKILL.md");
        await fs.mkdir(skillDir, { recursive: true });

        let exists = false;
        try {
          await fs.access(filePath);
          exists = true;
        } catch {
          exists = false;
        }

        if (exists && !params.overwrite) {
          return {
            content: [
              {
                type: "text",
                text: `创建失败：技能已存在，请使用 overwrite=true 覆盖。路径：${filePath}`
              }
            ],
            details: {}
          };
        }

        const markdown = buildSkillMarkdown(
          normalizedName,
          params.description.trim(),
          params.steps ?? []
        );
        await fs.writeFile(filePath, markdown, "utf-8");

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: true,
                  skillName: normalizedName,
                  path: filePath
                },
                null,
                2
              )
            }
          ],
          details: {}
        };
      }
    }
  };
}
