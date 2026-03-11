import { appendHistoryEvent } from "./memory/history-store.js";
import { sendMessage } from "./transport/polling.js";
import { readCronJobs, writeCronJobs, type CronJob } from "./cron/jobs-store.js";

export interface CronExecutor {
  runSkill: (
    skillName: string,
    args: Record<string, unknown>
  ) => Promise<{ ok: boolean; output: string }>;
  runPrompt: (
    sessionKey: string,
    prompt: string
  ) => Promise<{ ok: boolean; output: string }>;
}

function parseNumericValue(raw: string, min: number, max: number): number | null {
  if (!/^\d+$/.test(raw)) {
    return null;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    return null;
  }
  return value;
}

function matchField(rawField: string, value: number, min: number, max: number): boolean {
  const field = rawField.trim();
  if (!field) {
    return false;
  }
  if (field === "*") {
    return true;
  }

  const segments = field.split(",");
  for (const segmentRaw of segments) {
    const segment = segmentRaw.trim();
    if (!segment) {
      return false;
    }
    if (segment === "*") {
      return true;
    }

    if (segment.startsWith("*/")) {
      const step = parseNumericValue(segment.slice(2), 1, max);
      if (!step) {
        return false;
      }
      if ((value - min) % step === 0) {
        return true;
      }
      continue;
    }

    if (segment.includes("-")) {
      const [startRaw, endRaw] = segment.split("-");
      if (endRaw === undefined) {
        return false;
      }
      const start = parseNumericValue(startRaw, min, max);
      const end = parseNumericValue(endRaw, min, max);
      if (start === null || end === null || start > end) {
        return false;
      }
      if (value >= start && value <= end) {
        return true;
      }
      continue;
    }

    const exact = parseNumericValue(segment, min, max);
    if (exact === null) {
      return false;
    }
    if (value === exact) {
      return true;
    }
  }

  return false;
}

export function isCronExprMatch(cronExpr: string, now: Date): boolean {
  const parts = cronExpr
    .trim()
    .split(/\s+/)
    .filter((part) => part.length > 0);

  if (parts.length !== 5) {
    return false;
  }

  const [minuteExpr, hourExpr, dayExpr, monthExpr, weekExpr] = parts;
  const minute = now.getMinutes();
  const hour = now.getHours();
  const day = now.getDate();
  const month = now.getMonth() + 1;
  const week = now.getDay();

  return (
    matchField(minuteExpr, minute, 0, 59) &&
    matchField(hourExpr, hour, 0, 23) &&
    matchField(dayExpr, day, 1, 31) &&
    matchField(monthExpr, month, 1, 12) &&
    matchField(weekExpr, week, 0, 6)
  );
}

function formatMinuteKey(now: Date): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day} ${hour}:${minute}`;
}

function wasTriggeredInMinute(job: CronJob, minuteKey: string): boolean {
  if (!job.lastTriggeredAt) {
    return false;
  }
  const parsed = new Date(job.lastTriggeredAt);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return formatMinuteKey(parsed) === minuteKey;
}

function buildCronPrompt(job: CronJob): string {
  const lines: string[] = [];

  if (job.task.skillNames.length > 0) {
    lines.push(`请调用以下技能：${job.task.skillNames.join("、")}`);
  }

  lines.push(`任务要求：${job.task.requirement}`);

  if (job.task.prompt?.trim()) {
    lines.push(`补充说明：${job.task.prompt.trim()}`);
  }

  return lines.join("\n");
}

async function triggerJob(
  job: CronJob,
  token: string,
  executor: CronExecutor
): Promise<{ output: string; isError: boolean }> {
  const execution = job.task.toolName
    ? await executor.runSkill(job.task.toolName, job.task.toolArgs ?? {})
    : await executor.runPrompt(
        job.sessionKey ?? job.targetChatId,
        buildCronPrompt(job)
      );
  const title = `【定时任务】${job.name}`;
  const output = execution.ok
    ? `${title}\n执行成功\n${execution.output}`
    : `${title}\n执行失败\n${execution.output}`;

  await sendMessage(token, job.targetChatId, output);

  return {
    output,
    isError: !execution.ok
  };
}

async function tick(token: string, executor: CronExecutor): Promise<void> {
  const now = new Date();
  const minuteKey = formatMinuteKey(now);
  const jobs = await readCronJobs();
  let changed = false;

  for (const job of jobs) {
    if (!job.enabled) {
      continue;
    }
    if (!isCronExprMatch(job.cronExpr, now)) {
      continue;
    }
    if (wasTriggeredInMinute(job, minuteKey)) {
      continue;
    }

    const cronTool = job.task.toolName ?? "cron_prompt";
    const cronArgs = job.task.toolName
      ? { requirement: job.task.requirement, toolName: job.task.toolName, toolArgs: job.task.toolArgs }
      : { requirement: job.task.requirement, skillNames: job.task.skillNames, prompt: job.task.prompt, sessionKey: job.sessionKey ?? job.targetChatId };

    const ts = new Date().toISOString();
    await appendHistoryEvent({
      ts,
      chatId: job.targetChatId,
      role: "assistant",
      type: "tool_call",
      tool: cronTool,
      args: cronArgs
    });

    try {
      const result = await triggerJob(job, token, executor);
      await appendHistoryEvent({
        ts: new Date().toISOString(),
        chatId: job.targetChatId,
        role: "assistant",
        type: "tool_result",
        tool: cronTool,
        result: result.output,
        isError: result.isError
      });
      await appendHistoryEvent({
        ts: new Date().toISOString(),
        chatId: job.targetChatId,
        role: "assistant",
        type: "message",
        text: result.output
      });
      console.log(`[cron] triggered job=${job.id} name="${job.name}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const output = `【定时任务】${job.name}\n执行失败\n${message}`;
      await appendHistoryEvent({
        ts: new Date().toISOString(),
        chatId: job.targetChatId,
        role: "assistant",
        type: "tool_result",
        tool: cronTool,
        result: output,
        isError: true
      });
      await appendHistoryEvent({
        ts: new Date().toISOString(),
        chatId: job.targetChatId,
        role: "assistant",
        type: "message",
        text: output
      });
      await sendMessage(token, job.targetChatId, output).catch(() => undefined);
      console.error(`[cron] job failed id=${job.id}: ${message}`);
    }

    job.lastTriggeredAt = new Date().toISOString();
    changed = true;
  }

  if (changed) {
    await writeCronJobs(jobs);
  }
}

export function startCronScheduler(token: string, executor: CronExecutor): void {
  const intervalMs = 15_000;
  void tick(token, executor).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[cron] first tick failed: ${message}`);
  });

  setInterval(() => {
    void tick(token, executor).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[cron] tick failed: ${message}`);
    });
  }, intervalMs);
}
