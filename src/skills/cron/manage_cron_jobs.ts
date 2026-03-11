import { Type } from "@mariozechner/pi-ai";
import {
  createCronJobId,
  readCronJobs,
  writeCronJobs,
  type CronJob
} from "../../cron/jobs-store.js";
import type { SkillDefinition } from "../contracts.js";

const ACTIONS = ["list", "add", "update", "remove", "set_enabled"] as const;
type ManageAction = (typeof ACTIONS)[number];

function normalizeText(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function isValidAction(raw: string): raw is ManageAction {
  return ACTIONS.includes(raw as ManageAction);
}

function hasFiveCronFields(expr: string): boolean {
  return expr
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0).length === 5;
}

export interface ManageCronJobsSkillOptions {
  getDefaultChatId?: () => string | undefined;
}

export function createManageCronJobsSkill(
  options: ManageCronJobsSkillOptions = {}
): SkillDefinition {
  return {
    name: "manage_cron_jobs",
    description: "管理定时任务（list/add/update/remove/set_enabled）",
    exposure: "on_demand",
    tool: {
      name: "manage_cron_jobs",
      label: "Manage Cron Jobs",
      description: "Manage cron jobs in .stupidClaw/cron_jobs.json",
      parameters: Type.Object({
        action: Type.String({
          description: "list | add | update | remove | set_enabled"
        }),
        id: Type.Optional(
          Type.String({
            description: "任务 id（update/remove/set_enabled 必填）"
          })
        ),
        name: Type.Optional(
          Type.String({
            description: "任务名（add 必填）"
          })
        ),
        cronExpr: Type.Optional(
          Type.String({
            description: "五段 cron 表达式（add 必填），例如 0 8 * * *"
          })
        ),
        chatId: Type.Optional(
          Type.String({
            description: "目标 Telegram chatId（可选，默认当前会话 chatId）"
          })
        ),
        sessionKey: Type.Optional(
          Type.String({
            description: "可选会话键，不传则默认等于 chatId"
          })
        ),
        requirement: Type.Optional(
          Type.String({
            description: "任务要求描述（建议填写）"
          })
        ),
        skillNames: Type.Optional(
          Type.Array(
            Type.String({
              description: "需要 LLM 动态生成内容时填写。告诉 LLM 执行时可以调用哪些 skill，由 LLM 决定何时调用、传什么参数。例如讲故事、写内容等创意类任务填 [\"tell_bedtime_story\"]"
            })
          )
        ),
        prompt: Type.Optional(
          Type.String({
            description: "额外补充说明（可选）；不要把 skill 内容展开写进来"
          })
        ),
        toolName: Type.Optional(
          Type.String({
            description: "仅当任务参数完全固定、完全不需要 LLM 生成内容时才填。cron 触发时直接以固定的 toolArgs 调用该工具函数，完全绕过 LLM。适合发送固定文本、触发固定操作等场景。需要 LLM 生成内容时不要填此字段"
          })
        ),
        toolArgs: Type.Optional(
          Type.Object({}, { additionalProperties: true })
        )
      }),
      execute: async (_toolCallId, rawParams) => {
        const params = rawParams as {
          action?: string;
          id?: string;
          name?: string;
          cronExpr?: string;
          chatId?: string;
          sessionKey?: string;
          requirement?: string;
          skillNames?: string[];
          prompt?: string;
          toolName?: string;
          toolArgs?: Record<string, unknown>;
          enabled?: boolean;
        };

        const action = normalizeText(params.action);
        if (!isValidAction(action)) {
          return {
            content: [
              {
                type: "text",
                text: "操作失败：action 非法，只能是 list/add/update/remove/set_enabled。"
              }
            ],
            details: {}
          };
        }

        const jobs = await readCronJobs();

        if (action === "list") {
          return {
            content: [{ type: "text", text: JSON.stringify({ jobs }, null, 2) }],
            details: {}
          };
        }

        if (action === "add") {
          const name = normalizeText(params.name);
          const cronExpr = normalizeText(params.cronExpr);
          const chatId =
            normalizeText(params.chatId) || normalizeText(options.getDefaultChatId?.());
          const sessionKey = normalizeText(params.sessionKey) || chatId;
          const requirement =
            normalizeText(params.requirement) || `定时任务：${name || "未命名任务"}`;
          const skillNames = Array.isArray(params.skillNames)
            ? params.skillNames.map(normalizeText).filter((s) => s.length > 0)
            : [];
          const prompt = normalizeText(params.prompt) || undefined;
          const toolName = normalizeText(params.toolName) || undefined;
          const toolArgs =
            params.toolArgs && typeof params.toolArgs === "object" ? params.toolArgs : {};

          if (!name || !cronExpr || !chatId) {
            return {
              content: [
                {
                  type: "text",
                  text: "新增失败：name/cronExpr 必填，且必须能确定 chatId（显式传入或使用当前会话）。"
                }
              ],
              details: {}
            };
          }

          if (!hasFiveCronFields(cronExpr)) {
            return {
              content: [
                {
                  type: "text",
                  text: "新增失败：cronExpr 必须是 5 段格式，例如 0 8 * * *。"
                }
              ],
              details: {}
            };
          }

          if (toolName) {
            // 直接工具调用路径：不需要 skillNames/prompt
          } else if (skillNames.length === 0 && !prompt && !requirement) {
            return {
              content: [
                {
                  type: "text",
                  text: "新增失败：未指定 toolName 时，skillNames/prompt/requirement 至少填一项。"
                }
              ],
              details: {}
            };
          }

          const newJob: CronJob = {
            id: createCronJobId(),
            name,
            enabled: true,
            cronExpr,
            targetChatId: chatId,
            sessionKey,
            task: {
              requirement,
              skillNames,
              prompt,
              toolName,
              toolArgs: toolName ? toolArgs : undefined
            }
          };
          jobs.push(newJob);
          await writeCronJobs(jobs);

          return {
            content: [
              { type: "text", text: JSON.stringify({ ok: true, job: newJob }, null, 2) }
            ],
            details: {}
          };
        }

        if (action === "update") {
          const id = normalizeText(params.id);
          if (!id) {
            return {
              content: [{ type: "text", text: "更新失败：id 必填。" }],
              details: {}
            };
          }

          const job = jobs.find((item) => item.id === id);
          if (!job) {
            return {
              content: [{ type: "text", text: `更新失败：未找到任务 ${id}。` }],
              details: {}
            };
          }

          const nextName = normalizeText(params.name);
          const nextCronExpr = normalizeText(params.cronExpr);
          const nextChatId = normalizeText(params.chatId);
          const nextSessionKey = normalizeText(params.sessionKey);
          const nextRequirement = normalizeText(params.requirement);
          const nextPrompt = normalizeText(params.prompt) || undefined;
          const nextToolName = normalizeText(params.toolName) || undefined;
          const nextToolArgs =
            params.toolArgs && typeof params.toolArgs === "object"
              ? params.toolArgs
              : undefined;
          const nextSkillNames = Array.isArray(params.skillNames)
            ? params.skillNames.map(normalizeText).filter((s) => s.length > 0)
            : undefined;

          if (nextName) job.name = nextName;
          if (nextCronExpr) {
            if (!hasFiveCronFields(nextCronExpr)) {
              return {
                content: [
                  {
                    type: "text",
                    text: "更新失败：cronExpr 必须是 5 段格式，例如 0 8 * * *。"
                  }
                ],
                details: {}
              };
            }
            job.cronExpr = nextCronExpr;
          }
          if (nextChatId) job.targetChatId = nextChatId;
          if (nextSessionKey) job.sessionKey = nextSessionKey;
          if (nextRequirement) job.task.requirement = nextRequirement;
          if (nextSkillNames) job.task.skillNames = nextSkillNames;
          if (nextPrompt !== undefined) job.task.prompt = nextPrompt;
          if (nextToolName !== undefined) {
            job.task.toolName = nextToolName;
            job.task.toolArgs = nextToolArgs ?? job.task.toolArgs;
          } else if (nextToolArgs) {
            job.task.toolArgs = nextToolArgs;
          }

          await writeCronJobs(jobs);
          return {
            content: [{ type: "text", text: JSON.stringify({ ok: true, job }, null, 2) }],
            details: {}
          };
        }

        if (action === "remove") {
          const id = normalizeText(params.id);
          if (!id) {
            return {
              content: [{ type: "text", text: "删除失败：id 必填。" }],
              details: {}
            };
          }

          const next = jobs.filter((job) => job.id !== id);
          const removed = next.length !== jobs.length;
          await writeCronJobs(next);

          return {
            content: [
              { type: "text", text: JSON.stringify({ ok: removed, removedId: id }, null, 2) }
            ],
            details: {}
          };
        }

        // set_enabled
        const id = normalizeText(params.id);
        if (!id || typeof params.enabled !== "boolean") {
          return {
            content: [
              { type: "text", text: "设置失败：set_enabled 需要 id 和 enabled(boolean)。" }
            ],
            details: {}
          };
        }

        let found = false;
        for (const job of jobs) {
          if (job.id === id) {
            job.enabled = params.enabled;
            found = true;
            break;
          }
        }
        await writeCronJobs(jobs);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: found, id, enabled: params.enabled }, null, 2)
            }
          ],
          details: {}
        };
      }
    }
  };
}
