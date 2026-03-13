import fs from "node:fs/promises";
import path from "node:path";
import { Type } from "@mariozechner/pi-ai";
import { resolveSafePath } from "../../memory/workspace-path.js";
import type { SkillDefinition } from "../contracts.js";

const PROJECT_SKILLS_ROOT = resolveSafePath("skills");

// pi-coding-agent 要求：name 只能包含小写字母、数字、连字符，且必须与父目录同名
function normalizeSkillName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildSkillMarkdown(
  name: string,
  description: string,
  body?: string
): string {
  const defaultBody = [
    `# ${name}`,
    "",
    "<!-- 说明这个 skill 存在的原因，以及它解决什么问题。简洁即可。-->",
    "",
    "## Steps",
    "",
    "1. 明确用户目标及关键参数",
    "2. 按最小复杂度执行",
    "3. 返回结构化结果",
    "",
    "## Examples",
    "",
    "**Example 1:**",
    "Input: [示例用户请求]",
    "Output: [期望结果]",
    "",
    "## Notes",
    "",
    "- [重要的边界情况或约束]",
  ].join("\n");

  // description 放在 frontmatter 里，同时描述「做什么」和「何时触发」
  // 多行 description 用 YAML > 块标量
  const descLines = description.trim().split("\n");
  const descYaml =
    descLines.length === 1
      ? `description: "${description.trim().replace(/"/g, '\\"')}"`
      : `description: >\n  ${descLines.join("\n  ")}`;

  return [
    "---",
    `name: ${name}`,
    descYaml,
    "---",
    "",
    body?.trim() ?? defaultBody,
    "",
  ].join("\n");
}

export function createSkillCreatorSkill(): SkillDefinition {
  return {
    name: "skill_creator",
    description: [
      "创建、读取或更新 .stupidClaw/skills/ 下的技能文件（SKILL.md）。",
      "在创建新技能前，必须先访谈用户确认：",
      "① 技能要做什么；",
      "② 何时应触发（具体用户短语/场景，越明确越好）；",
      "③ 期望输出格式。",
      "访谈完成后再调用。",
    ].join(" "),
    exposure: "on_demand",
    tool: {
      name: "skill_creator",
      label: "Skill Creator",
      description: [
        "Manage SKILL.md files under .stupidClaw/skills/.",
        "IMPORTANT: Before calling 'create', you MUST first interview the user to understand:",
        "(1) what the skill should do,",
        "(2) when it should trigger — list specific user phrases and contexts,",
        "(3) expected output format.",
        "Only call this tool after completing the interview.",
        "The 'description' field is the primary triggering mechanism.",
        "Make it explicit and slightly pushy: describe WHAT the skill does AND name specific phrases/contexts that should trigger it.",
        "Skill structure: each skill lives in its own subdirectory under .stupidClaw/skills/<name>/SKILL.md.",
        "For large reference docs, create a references/ subdirectory alongside SKILL.md and point to those files from the body.",
      ].join(" "),
      parameters: Type.Object({
        operation: Type.Union(
          [
            Type.Literal("read"),
            Type.Literal("create"),
            Type.Literal("update"),
          ],
          {
            description:
              "'read' returns existing skill content; 'create' writes a new skill; 'update' replaces existing skill content.",
          }
        ),
        name: Type.String({
          description:
            "Skill name: lowercase letters, digits, hyphens only (e.g. summarize-news). Must match the directory name.",
        }),
        description: Type.Optional(
          Type.String({
            description:
              "[create/update] Primary triggering description. Describe WHAT the skill does AND WHEN to trigger it. Be specific and slightly pushy. Example: 'Summarizes news articles. Use this skill whenever the user asks to summarize, digest, or recap any news, articles, or feeds, even if they do not use the word skill.'",
          })
        ),
        body: Type.Optional(
          Type.String({
            description:
              "[create] Custom body content (without YAML frontmatter). If omitted, a standard template is used. For skills with large reference docs, write the body to reference files in references/ subdirectory.",
          })
        ),
        content: Type.Optional(
          Type.String({
            description:
              "[update] Full SKILL.md content including YAML frontmatter. Use this for a complete rewrite. Prefer calling 'read' first to see the current content before updating.",
          })
        ),
      }),
      execute: async (_toolCallId, rawParams) => {
        const params = rawParams as {
          operation: "read" | "create" | "update";
          name: string;
          description?: string;
          body?: string;
          content?: string;
        };

        const normalizedName = normalizeSkillName(params.name);
        if (!normalizedName) {
          return {
            content: [
              {
                type: "text",
                text: "失败：name 无效，至少需要一个字母或数字。",
              },
            ],
            details: {},
          };
        }

        const skillDir = path.join(PROJECT_SKILLS_ROOT, normalizedName);
        const filePath = path.join(skillDir, "SKILL.md");

        // ── read ──────────────────────────────────────────────────────────
        if (params.operation === "read") {
          let fileContent: string;
          try {
            fileContent = await fs.readFile(filePath, "utf-8");
          } catch {
            return {
              content: [
                {
                  type: "text",
                  text: `技能 "${normalizedName}" 不存在，路径：${filePath}`,
                },
              ],
              details: {},
            };
          }
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  { name: normalizedName, path: filePath, content: fileContent },
                  null,
                  2
                ),
              },
            ],
            details: {},
          };
        }

        // ── create ────────────────────────────────────────────────────────
        if (params.operation === "create") {
          if (!params.description) {
            return {
              content: [
                { type: "text", text: "创建失败：缺少 description 参数。" },
              ],
              details: {},
            };
          }

          let exists = false;
          try {
            await fs.access(filePath);
            exists = true;
          } catch {
            exists = false;
          }

          if (exists) {
            return {
              content: [
                {
                  type: "text",
                  text: `创建失败：技能 "${normalizedName}" 已存在。如需修改，请先用 operation="read" 查看现有内容，再用 operation="update" 更新。路径：${filePath}`,
                },
              ],
              details: {},
            };
          }

          await fs.mkdir(skillDir, { recursive: true });
          const markdown = buildSkillMarkdown(
            normalizedName,
            params.description,
            params.body
          );
          await fs.writeFile(filePath, markdown, "utf-8");
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    ok: true,
                    operation: "create",
                    skillName: normalizedName,
                    path: filePath,
                    content: markdown,
                    tip: "If this skill needs large reference docs, create a references/ subdirectory alongside SKILL.md and link to those files from the body.",
                  },
                  null,
                  2
                ),
              },
            ],
            details: {},
          };
        }

        // ── update ────────────────────────────────────────────────────────
        if (params.operation === "update") {
          if (!params.content && !params.description) {
            return {
              content: [
                {
                  type: "text",
                  text: "更新失败：需要提供 content（完整文件内容）或 description（重写触发描述）。建议先用 operation='read' 查看现有内容后再更新。",
                },
              ],
              details: {},
            };
          }

          await fs.mkdir(skillDir, { recursive: true });

          let finalContent: string;
          if (params.content) {
            // 完整内容替换
            finalContent = params.content;
          } else {
            // 只更新 description，保留原有 body
            let existingBody = "";
            try {
              const existing = await fs.readFile(filePath, "utf-8");
              const match = existing.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
              existingBody = match ? match[1].trim() : existing.trim();
            } catch {
              // 文件不存在则创建新文件
            }
            finalContent = buildSkillMarkdown(
              normalizedName,
              params.description!,
              existingBody || undefined
            );
          }

          await fs.writeFile(filePath, finalContent, "utf-8");
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    ok: true,
                    operation: "update",
                    skillName: normalizedName,
                    path: filePath,
                    content: finalContent,
                  },
                  null,
                  2
                ),
              },
            ],
            details: {},
          };
        }

        return {
          content: [
            { type: "text", text: `未知 operation: ${params.operation}` },
          ],
          details: {},
        };
      },
    },
  };
}
