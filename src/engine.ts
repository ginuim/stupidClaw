import fs from "node:fs";
import {
  AuthStorage,
  createCodingTools,
  createAgentSession,
  formatSkillsForPrompt,
  ModelRegistry,
  SessionManager,
  type AgentSession
} from "@mariozechner/pi-coding-agent";
import { appendHistoryEvent } from "./memory/history-store";
import { readProfileMarkdown } from "./memory/profile-store";
import { resolveSafePath } from "./memory/workspace-path";
import { IDENTITY_PROMPT_LINES } from "./prompt/identity";
import { loadStandardFileSkills } from "./skills/file-skills";
import { createSkillRegistry } from "./skills/registry";

export interface ChatInput {
  chatId: string;
  text: string;
}

export interface ChatOutput {
  replyText: string;
}

interface ChatSession {
  session: AgentSession;
}

const chatSessions = new Map<string, ChatSession>();
const skillRegistry = createSkillRegistry();
const DEBUG_ENGINE = process.env.DEBUG_STUPIDCLAW === "1";
const DEBUG_PROMPT = process.env.DEBUG_PROMPT === "1";
const WORKSPACE_ROOT = resolveSafePath("workspace");
let startupConfigLogged = false;

function debugLog(message: string): void {
  if (DEBUG_ENGINE) {
    console.log(`[debug][engine] ${message}`);
  }
}

function debugPromptLog(chatId: string, prompt: string): void {
  if (!DEBUG_PROMPT) {
    return;
  }
  console.log("[debug][prompt] begin");
  console.log(`chatId=${chatId}`);
  console.log(prompt);
  console.log("[debug][prompt] end");
}

function summarizeSchema(schema: unknown): string {
  try {
    const raw = JSON.stringify(schema);
    if (!raw) {
      return "(empty)";
    }
    return raw.length > 240 ? `${raw.slice(0, 240)}...` : raw;
  } catch {
    return "(unserializable)";
  }
}

function collectSessionToolNames(session: AgentSession): string[] {
  const names = new Set<string>();
  const candidates: unknown[] = [
    (session as unknown as { tools?: unknown }).tools,
    (session as unknown as { agent?: { tools?: unknown } }).agent?.tools,
    (session as unknown as { agent?: { state?: { tools?: unknown } } }).agent?.state?.tools
  ];

  for (const candidate of candidates) {
    if (!candidate) {
      continue;
    }
    if (Array.isArray(candidate)) {
      for (const item of candidate) {
        if (
          item &&
          typeof item === "object" &&
          "name" in item &&
          typeof (item as { name?: unknown }).name === "string"
        ) {
          names.add((item as { name: string }).name);
        }
      }
      continue;
    }
    if (typeof candidate === "object") {
      for (const key of Object.keys(candidate as Record<string, unknown>)) {
        names.add(key);
      }
    }
  }

  return Array.from(names).sort();
}

function debugToolsLog(session: AgentSession, fileSkillNames: string[]): void {
  if (!DEBUG_PROMPT) {
    return;
  }
  const sessionToolNames = collectSessionToolNames(session);
  const customToolSummary = skillRegistry.all.map((skill) => ({
    name: skill.tool.name,
    exposure: skill.exposure,
    parameters: summarizeSchema(skill.tool.parameters)
  }));

  console.log("[debug][tools] begin");
  console.log(`sessionTools=${JSON.stringify(sessionToolNames)}`);
  console.log(`customTools=${JSON.stringify(customToolSummary)}`);
  console.log(`fileSkills=${JSON.stringify(fileSkillNames)}`);
  console.log("[debug][tools] end");
}

function maskSecret(value: string | undefined): string {
  if (!value) {
    return "(missing)";
  }
  if (value.length <= 8) {
    return "*".repeat(value.length);
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function fallbackReply(text: string): string {
  return `收到：${text}`;
}

function pickMiniMaxModel(modelRegistry: ModelRegistry) {
  const preferredModelId = process.env.MINIMAX_MODEL;
  const available = modelRegistry.getAvailable();
  const minimaxAvailable = available.filter((model) =>
    ["minimax", "minimax-cn"].includes(model.provider)
  );

  if (preferredModelId) {
    const preferred =
      modelRegistry.find("minimax-cn", preferredModelId) ||
      modelRegistry.find("minimax", preferredModelId);
    if (preferred) {
      debugLog(`selected preferred model=${preferred.provider}/${preferred.id}`);
      return preferred;
    }
    debugLog(`preferred model not found: ${preferredModelId}`);
  }

  return (
    minimaxAvailable.find((model) => model.provider === "minimax-cn") ??
    minimaxAvailable.find((model) => model.provider === "minimax") ??
    available[0]
  );
}

function createAuthStorage(): AuthStorage {
  const authStorage = AuthStorage.create();
  if (process.env.MINIMAX_API_KEY && !process.env.MINIMAX_CN_API_KEY) {
    authStorage.setRuntimeApiKey("minimax-cn", process.env.MINIMAX_API_KEY);
    debugLog("MINIMAX_CN_API_KEY missing; reuse MINIMAX_API_KEY for minimax-cn");
  }
  return authStorage;
}

async function createChatSession(): Promise<ChatSession | null> {
  if (!process.env.MINIMAX_API_KEY && !process.env.MINIMAX_CN_API_KEY) {
    debugLog("createChatSession skipped: MINIMAX_API_KEY and MINIMAX_CN_API_KEY missing");
    return null;
  }

  const authStorage = createAuthStorage();
  const modelRegistry = new ModelRegistry(authStorage);
  const model = pickMiniMaxModel(modelRegistry);

  if (!model) {
    debugLog("createChatSession failed: no model available");
    return null;
  }

  if (DEBUG_ENGINE && !startupConfigLogged) {
    startupConfigLogged = true;
    console.log(
      "[debug][engine] runtime config:",
      JSON.stringify(
        {
          telegramMode: process.env.TELEGRAM_MODE ?? "polling",
          minimaxModelEnv: process.env.MINIMAX_MODEL ?? "(empty)",
          selectedProvider: model.provider,
          selectedModelId: model.id,
          selectedBaseUrl: model.baseUrl,
          workspaceRoot: WORKSPACE_ROOT,
          minimaxApiKeyMasked: maskSecret(process.env.MINIMAX_API_KEY),
          minimaxCnApiKeyMasked: maskSecret(process.env.MINIMAX_CN_API_KEY),
          debugEnabled: DEBUG_ENGINE
        },
        null,
        2
      )
    );
  }

  fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });

  const { session } = await createAgentSession({
    authStorage,
    cwd: WORKSPACE_ROOT,
    modelRegistry,
    model,
    sessionManager: SessionManager.inMemory(),
    tools: createCodingTools(WORKSPACE_ROOT),
    customTools: skillRegistry.all.map((skill) => skill.tool),
    thinkingLevel: "off"
  });

  debugLog(`chat session created with model=${model.provider}/${model.id}`);
  return { session };
}

async function getChatSession(chatId: string): Promise<ChatSession | null> {
  const existing = chatSessions.get(chatId);
  if (existing) {
    debugLog(`reuse session for chatId=${chatId}`);
    return existing;
  }

  const created = await createChatSession();
  if (!created) {
    return null;
  }
  chatSessions.set(chatId, created);
  debugLog(`store new session for chatId=${chatId}`);
  return created;
}

function safeAppend(event: Parameters<typeof appendHistoryEvent>[0]): void {
  appendHistoryEvent(event).catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[error] append history failed: ${message}`);
  });
}

async function buildPromptWithProfile(
  text: string
): Promise<{ prompt: string; fileSkillNames: string[] }> {
  const profile = await readProfileMarkdown();
  const fileSkills = loadStandardFileSkills();
  const fileSkillNames = fileSkills.map((skill) => skill.name);
  const fileSkillsPrompt =
    fileSkills.length > 0 ? formatSkillsForPrompt(fileSkills) : "";

  const lines = [
    ...IDENTITY_PROMPT_LINES,
    "",
    "你正在和同一个用户持续对话。以下是长期记忆 profile.md，请优先遵守并引用其中稳定事实。",
    "",
    "<profile>",
    profile.trim(),
    "</profile>",
    "",
    "<user_message>",
    text,
    "</user_message>"
  ];

  if (fileSkillsPrompt.trim()) {
    lines.push("");
    lines.push("<file_skills>");
    lines.push(fileSkillsPrompt.trim());
    lines.push("</file_skills>");
  }

  return {
    prompt: lines.join("\n"),
    fileSkillNames
  };
}

async function chatWithPi(chatId: string, text: string): Promise<string | null> {
  const chatSession = await getChatSession(chatId);
  if (!chatSession) {
    return null;
  }

  let replyBuffer = "";
  let receivedDelta = false;

  const unsubscribe = chatSession.session.subscribe((event) => {
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_delta"
    ) {
      receivedDelta = true;
      replyBuffer += event.assistantMessageEvent.delta;
      return;
    }
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_end"
    ) {
      // Some providers send full content in text_end even after deltas.
      // If we already streamed deltas, appending text_end would duplicate output.
      if (!receivedDelta) {
        replyBuffer += event.assistantMessageEvent.content;
      }
      return;
    }
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "done"
    ) {
      const doneText = extractAssistantText(event.assistantMessageEvent.message);
      if (doneText) {
        replyBuffer = doneText;
      }
      return;
    }
    if (event.type === "tool_execution_start") {
      safeAppend({
        ts: new Date().toISOString(),
        chatId,
        role: "assistant",
        type: "tool_call",
        tool: event.toolName,
        args:
          typeof event.args === "object" && event.args
            ? (event.args as Record<string, unknown>)
            : undefined
      });
      return;
    }

    if (event.type === "tool_execution_end") {
      safeAppend({
        ts: new Date().toISOString(),
        chatId,
        role: "assistant",
        type: "tool_result",
        tool: event.toolName,
        result: JSON.stringify(event.result ?? null),
        isError: event.isError
      });
    }
  });

  try {
    const { prompt, fileSkillNames } = await buildPromptWithProfile(text);
    debugPromptLog(chatId, prompt);
    debugToolsLog(chatSession.session, fileSkillNames);
    await chatSession.session.prompt(prompt);
  } finally {
    unsubscribe();
  }

  const directReply = replyBuffer.trim();
  if (directReply) {
    return directReply;
  }

  const stateReply = extractLatestAssistantReply(chatSession.session);
  if (stateReply) {
    return stateReply;
  }

  const assistantError = extractLatestAssistantError(chatSession.session);
  if (assistantError) {
    return `模型调用失败：${assistantError}`;
  }

  return null;
}

function extractLatestAssistantReply(session: AgentSession): string {
  const messages = session.agent.state.messages;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const text = extractAssistantText(messages[i]);
    if (text.trim().length > 0) {
      return text.trim();
    }
  }
  return "";
}

function extractLatestAssistantError(session: AgentSession): string {
  const messages = session.agent.state.messages as Array<{
    role?: string;
    errorMessage?: unknown;
  }>;
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "assistant") {
      continue;
    }
    if (typeof message.errorMessage === "string" && message.errorMessage.trim()) {
      if (message.errorMessage.includes("invalid api key")) {
        return "MiniMax API Key 无效（invalid api key），请检查并更换 .env 中 MINIMAX_API_KEY。";
      }
      return message.errorMessage;
    }
  }
  return "";
}

function extractAssistantText(message: unknown): string {
  if (!message || typeof message !== "object") {
    return "";
  }
  const m = message as { role?: string; content?: unknown };
  if (m.role !== "assistant") {
    return "";
  }
  if (typeof m.content === "string") {
    return m.content;
  }
  if (Array.isArray(m.content)) {
    const parts = m.content
      .map((item) => {
        if (!item || typeof item !== "object") {
          return "";
        }
        const c = item as {
          type?: string;
          text?: unknown;
          content?: unknown;
          value?: unknown;
        };
        if (typeof c.text === "string") {
          return c.text;
        }
        if (typeof c.content === "string") {
          return c.content;
        }
        if (typeof c.value === "string") {
          return c.value;
        }
        return "";
      })
      .filter((part) => part.length > 0);
    return parts.join("");
  }
  return "";
}

export async function chat(input: ChatInput): Promise<ChatOutput> {
  debugLog(`chat start chatId=${input.chatId}`);
  await appendHistoryEvent({
    ts: new Date().toISOString(),
    chatId: input.chatId,
    role: "user",
    type: "message",
    text: input.text
  });

  const piReply = await chatWithPi(input.chatId, input.text);
  const replyText = piReply ?? fallbackReply(input.text);
  if (!piReply) {
    debugLog("fallback reply used because piReply is null");
  }

  await appendHistoryEvent({
    ts: new Date().toISOString(),
    chatId: input.chatId,
    role: "assistant",
    type: "message",
    text: replyText
  });

  return { replyText };
}
