import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { chat } from "./engine";
import { getUpdates, sendMessage } from "./transport/polling";

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  acquireSingleInstanceLock();
  registerShutdownHooks();

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  let offset = 0;
  console.log("[boot] StupidClaw polling started");

  while (true) {
    try {
      const messages = await getUpdates(token, offset);
      for (const message of messages) {
        offset = Math.max(offset, message.updateId + 1);
        const result = await chat({
          chatId: message.chatId,
          text: message.text
        });
        await sendMessage(token, message.chatId, result.replyText);
        console.log(
          `[ok] chatId=${message.chatId} updateId=${message.updateId} text="${message.text}"`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[error] polling failed: ${message}`);
      await sleep(1000);
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[fatal] ${message}`);
  process.exit(1);
});
