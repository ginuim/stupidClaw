#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { startCronScheduler } from "./cron.js";
import { chat } from "./engine.js";
import { ensureWorkspaceDirs } from "./memory/workspace-path.js";
import { createSkillRegistry } from "./skills/registry.js";
import { startTransport } from "./transport/index.js";

// 解析命令行参数，支持 --config 指定 .env 路径
const args = process.argv.slice(2);
const configIdx = args.indexOf("--config");
const configPath =
  configIdx > -1 && args[configIdx + 1]
    ? path.resolve(process.cwd(), args[configIdx + 1])
    : path.resolve(process.cwd(), ".env");

// 显式加载指定的 .env 文件
if (fs.existsSync(configPath)) {
  dotenv.config({ path: configPath });
} else if (configIdx > -1) {
  // 如果用户指定了但不存在，报错
  console.error(`[error] 配置文件未找到: ${configPath}`);
  process.exit(1);
} else {
  // 如果默认的 .env 也不存在，给个友好提示，而不是直接崩掉（或者等后面报 Missing Token）
  console.warn(`[warn] 未检测到 .env 配置文件 (${configPath})，程序可能无法正常工作。`);
  console.warn(`[hint] 你可以从 .env.example 复制一份或使用 --config 指定。`);
}

const WORKSPACE_DIR = path.resolve(process.cwd(), ".stupidClaw");
const LOCK_FILE = path.resolve(WORKSPACE_DIR, "polling.lock");

function acquireSingleInstanceLock(): void {
  fs.mkdirSync(WORKSPACE_DIR, { recursive: true });
  try {
    const fd = fs.openSync(LOCK_FILE, "wx");
    fs.writeFileSync(fd, String(process.pid));
    fs.closeSync(fd);
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "EEXIST") {
      throw new Error(
        `Another polling instance is already running (lock file: ${LOCK_FILE})`
      );
    }
    throw error;
  }
}

function releaseSingleInstanceLock(): void {
  if (fs.existsSync(LOCK_FILE)) {
    fs.unlinkSync(LOCK_FILE);
  }
}

function registerShutdownHooks(): void {
  const cleanupAndExit = (signal: string) => {
    try {
      releaseSingleInstanceLock();
    } finally {
      process.exit(signal === "SIGINT" ? 130 : 143);
    }
  };
  process.on("SIGINT", () => cleanupAndExit("SIGINT"));
  process.on("SIGTERM", () => cleanupAndExit("SIGTERM"));
  process.on("exit", () => {
    releaseSingleInstanceLock();
  });
}

function toTextOutput(result: unknown): string {
  if (!result || typeof result !== "object") {
    return JSON.stringify(result ?? null);
  }

  const payload = result as {
    content?: Array<{ type?: string; text?: unknown }>;
  };
  const textParts = Array.isArray(payload.content)
    ? payload.content
        .filter((item) => item && item.type === "text")
        .map((item) => (typeof item.text === "string" ? item.text : ""))
        .filter((item) => item.length > 0)
    : [];

  if (textParts.length > 0) {
    return textParts.join("\n");
  }

  try {
    return JSON.stringify(result, null, 2);
  } catch {
    return "执行完成，但结果无法序列化。";
  }
}

async function main(): Promise<void> {
  acquireSingleInstanceLock();
  ensureWorkspaceDirs();
  registerShutdownHooks();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  const skillRegistry = createSkillRegistry();
  const skillMap = new Map(skillRegistry.all.map((skill) => [skill.name, skill]));
  startCronScheduler(token, {
    runSkill: async (skillName, args) => {
      if (!skillName.trim()) {
        return {
          ok: false,
          output: "任务配置错误：toolName 不能为空。"
        };
      }
      const skill = skillMap.get(skillName);
      if (!skill) {
        return {
          ok: false,
          output: `未知技能：${skillName}。请先用 manage_cron_jobs 删除或修正任务。`
        };
      }
      try {
        const result = await skill.tool.execute(
          "cron",
          args,
          undefined,
          undefined,
          {} as never
        );
        return {
          ok: true,
          output: toTextOutput(result)
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          output: message
        };
      }
    },
    runPrompt: async (sessionKey, prompt) => {
      const text = prompt.trim();
      if (!text) {
        return {
          ok: false,
          output: "任务配置错误：prompt 不能为空。"
        };
      }
      try {
        const result = await chat({
          chatId: sessionKey,
          text
        });
        return {
          ok: true,
          output: result.replyText
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return {
          ok: false,
          output: message
        };
      }
    }
  });

  await startTransport(token, async (message) => {
    message.sendChatAction().catch(() => {});
    const typingInterval = setInterval(() => {
      message.sendChatAction().catch(() => {});
    }, 4000);

    try {
      const result = await chat({
        chatId: message.chatId,
        text: message.text
      });
      await message.reply(result.replyText);
      const updateIdText = message.updateId === undefined ? "-" : String(message.updateId);
      console.log(
        `[ok] chatId=${message.chatId} updateId=${updateIdText} text="${message.text}"`
      );
    } finally {
      clearInterval(typingInterval);
    }
  });
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[fatal] ${message}`);
  process.exit(1);
});
