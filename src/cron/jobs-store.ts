import fs from "node:fs/promises";
import { resolveSafePath } from "../memory/workspace-path.js";

export interface CronJob {
  id: string;
  name: string;
  enabled: boolean;
  cronExpr: string;
  targetChatId: string;
  sessionKey?: string;
  task: {
    requirement: string;
    skillNames: string[];
    prompt?: string;
    // 有 toolName → 直接调注册工具（不经过 LLM）
    // 无 toolName → 走 chat 执行（skillNames 有就调 skill，没有就直接跑 prompt）
    toolName?: string;
    toolArgs?: Record<string, unknown>;
  };
  lastTriggeredAt?: string;
}

interface CronJobFile {
  jobs: CronJob[];
}

const CRON_JOBS_PATH = resolveSafePath("cron_jobs.json");

function normalizeJob(raw: unknown): CronJob | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const item = raw as Record<string, unknown>;
  if (
    typeof item.id !== "string" ||
    typeof item.name !== "string" ||
    typeof item.enabled !== "boolean" ||
    typeof item.cronExpr !== "string"
  ) {
    return null;
  }

  const targetChatId =
    typeof item.targetChatId === "string"
      ? item.targetChatId
      : typeof item.chatId === "string"
        ? item.chatId
        : "";
  if (!targetChatId) {
    return null;
  }

  const rawTask = item.task;
  const legacySkill = typeof item.skill === "string" ? item.skill : "";
  const legacyArgs =
    item.args && typeof item.args === "object" && !Array.isArray(item.args)
      ? (item.args as Record<string, unknown>)
      : {};
  const taskObj = (rawTask && typeof rawTask === "object"
    ? rawTask
    : {}) as Record<string, unknown>;
  const skillNames = Array.isArray(taskObj.skillNames)
    ? taskObj.skillNames.filter((x): x is string => typeof x === "string")
    : [];
  const requirement =
    typeof taskObj.requirement === "string"
      ? taskObj.requirement
      : `执行任务：${item.name}`;
  const toolName =
    typeof taskObj.toolName === "string" && taskObj.toolName
      ? taskObj.toolName
      // 兼容旧格式：之前 mode=tool 时用 skill 字段存工具名
      : typeof (taskObj as Record<string, unknown>).mode === "string" &&
          (taskObj as Record<string, unknown>).mode === "tool" &&
          legacySkill
        ? legacySkill
        : undefined;
  const toolArgs =
    taskObj.toolArgs &&
    typeof taskObj.toolArgs === "object" &&
    !Array.isArray(taskObj.toolArgs)
      ? (taskObj.toolArgs as Record<string, unknown>)
      : legacyArgs;
  const prompt = typeof taskObj.prompt === "string" ? taskObj.prompt : undefined;

  // 有 toolName 就是直接工具调用，必须有效
  if (toolName !== undefined && !toolName) {
    return null;
  }
  // 没有 toolName 也没有 skillNames 也没有 prompt，任务没有实质内容
  if (!toolName && skillNames.length === 0 && !prompt) {
    return null;
  }

  return {
    id: item.id,
    name: item.name,
    enabled: item.enabled,
    cronExpr: item.cronExpr,
    targetChatId,
    sessionKey: typeof item.sessionKey === "string" ? item.sessionKey : undefined,
    task: {
      requirement,
      skillNames,
      prompt,
      toolName,
      toolArgs: toolName ? toolArgs : undefined
    },
    lastTriggeredAt:
      typeof item.lastTriggeredAt === "string" ? item.lastTriggeredAt : undefined
  };
}

export async function ensureCronJobsFile(): Promise<void> {
  try {
    await fs.access(CRON_JOBS_PATH);
  } catch {
    const initial: CronJobFile = { jobs: [] };
    await fs.writeFile(CRON_JOBS_PATH, JSON.stringify(initial, null, 2), "utf-8");
  }
}

export async function readCronJobs(): Promise<CronJob[]> {
  await ensureCronJobsFile();
  const raw = await fs.readFile(CRON_JOBS_PATH, "utf-8");

  try {
    const parsed = JSON.parse(raw) as { jobs?: unknown };
    const jobs = Array.isArray(parsed.jobs) ? parsed.jobs : [];
    return jobs
      .map((item) => normalizeJob(item))
      .filter((item): item is CronJob => item !== null);
  } catch {
    return [];
  }
}

export async function writeCronJobs(jobs: CronJob[]): Promise<void> {
  const payload: CronJobFile = { jobs };
  await fs.writeFile(CRON_JOBS_PATH, JSON.stringify(payload, null, 2), "utf-8");
}

export function getCronJobsPath(): string {
  return CRON_JOBS_PATH;
}

export function createCronJobId(now = new Date()): string {
  return `job_${now.getTime()}`;
}
