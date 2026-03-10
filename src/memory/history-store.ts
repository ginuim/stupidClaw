import fs from "node:fs/promises";
import path from "node:path";

export type HistoryRole = "user" | "assistant";
export type HistoryEventType = "message" | "tool_call" | "tool_result";

export interface HistoryEvent {
  ts: string;
  chatId: string;
  role: HistoryRole;
  type: HistoryEventType;
  text?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

const WORKSPACE_DIR = path.resolve(process.cwd(), ".stupidClaw");
const HISTORY_DIR = path.resolve(WORKSPACE_DIR, "history");

function getDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getHistoryFilePath(date: Date): string {
  return path.resolve(HISTORY_DIR, `${getDateString(date)}.jsonl`);
}

async function ensureHistoryDir(): Promise<void> {
  await fs.mkdir(HISTORY_DIR, { recursive: true });
}

export async function appendHistoryEvent(event: HistoryEvent): Promise<void> {
  await ensureHistoryDir();
  const filePath = getHistoryFilePath(new Date(event.ts));
  const line = `${JSON.stringify(event)}\n`;
  await fs.appendFile(filePath, line, "utf-8");
}

export interface QueryHistoryInput {
  chatId?: string;
  date?: string;
  limit?: number;
}

export async function queryHistory(
  input: QueryHistoryInput
): Promise<HistoryEvent[]> {
  const date = input.date ?? getDateString(new Date());
  const filePath = path.resolve(HISTORY_DIR, `${date}.jsonl`);
  const limit = Math.max(1, Math.min(input.limit ?? 20, 200));

  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const events = raw
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line) as HistoryEvent)
      .filter((event) => (input.chatId ? event.chatId === input.chatId : true));
    return events.slice(-limit);
  } catch (error) {
    const code =
      typeof error === "object" && error && "code" in error
        ? String((error as { code?: string }).code)
        : "";
    if (code === "ENOENT") {
      return [];
    }
    throw error;
  }
}
