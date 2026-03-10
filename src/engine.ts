import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
  type AgentSession
} from "@mariozechner/pi-coding-agent";
import { appendHistoryEvent } from "./memory/history-store";
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
  enableSkills: boolean;
}

const skillChatSessions = new Map<string, ChatSession>();
const plainChatSessions = new Map<string, ChatSession>();
const skillRegistry = createSkillRegistry();
const DEBUG_ENGINE = process.env.DEBUG_STUPIDCLAW === "1";
let startupConfigLogged = false;

function debugLog(message: string): void {
  if (DEBUG_ENGINE) {
    console.log(`[debug][engine] ${message}`);
  }
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
  const minimaxAvailable = available.filter(
    (model) => model.provider === "minimax" || model.provider === "minimax-cn"
  );
  debugLog(
    `available models=${available.length}, minimax models=${minimaxAvailable.length}, preferred=${preferredModelId ?? "(none)"}`
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

  const selected =
    minimaxAvailable.find((model) => model.provider === "minimax-cn") ??
    minimaxAvailable.find((model) => model.provider === "minimax") ??
    available[0];
  if (selected) {
    debugLog(`selected fallback model=${selected.provider}/${selected.id}`);
  }
  return selected;
}

async function createChatSession(enableSkills: boolean): Promise<ChatSession | null> {
  if (!process.env.MINIMAX_API_KEY && !process.env.MINIMAX_CN_API_KEY) {
    debugLog("createChatSession skipped: MINIMAX_API_KEY and MINIMAX_CN_API_KEY missing");
    return null;
  }

  const authStorage = AuthStorage.create();
  if (process.env.MINIMAX_API_KEY && !process.env.MINIMAX_CN_API_KEY) {
    authStorage.setRuntimeApiKey("minimax-cn", process.env.MINIMAX_API_KEY);
    debugLog("MINIMAX_CN_API_KEY missing; reuse MINIMAX_API_KEY for minimax-cn");
  }
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
          minimaxApiKeyMasked: maskSecret(process.env.MINIMAX_API_KEY),
          minimaxCnApiKeyMasked: maskSecret(process.env.MINIMAX_CN_API_KEY),
          debugEnabled: DEBUG_ENGINE
        },
        null,
        2
      )
    );
  }

  const { session } = await createAgentSession({
    authStorage,
    modelRegistry,
    model,
    sessionManager: SessionManager.inMemory(),
    tools: [],
    customTools: enableSkills ? skillRegistry.all.map((skill) => skill.tool) : [],
    thinkingLevel: "off"
  });

  debugLog(
    `chat session created with model=${model.provider}/${model.id}, tools=${enableSkills ? skillRegistry.all.length : 0}`
  );
  return { session, enableSkills };
}

async function getChatSession(
  chatId: string,
  enableSkills: boolean
): Promise<ChatSession | null> {
  const sessions = enableSkills ? skillChatSessions : plainChatSessions;
  const existing = sessions.get(chatId);
  if (existing) {
    debugLog(
      `reuse session for chatId=${chatId}, enableSkills=${existing.enableSkills}`
    );
    return existing;
  }

  const created = await createChatSession(enableSkills);
  if (!created) {
    return null;
  }
  sessions.set(chatId, created);
  debugLog(`store new session for chatId=${chatId}, enableSkills=${enableSkills}`);
  return created;
}

async function chatWithPiInternal(
  chatId: string,
  text: string,
  enableSkills: boolean
): Promise<string | null> {
  const chatSession = await getChatSession(chatId, enableSkills);
  if (!chatSession) {
    return null;
  }

  let streamBuffer = "";
  let endBuffer = "";
  let toolStartCount = 0;
  let messageUpdateCount = 0;
  const safeAppend = (event: Parameters<typeof appendHistoryEvent>[0]) => {
    appendHistoryEvent(event).catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[error] append history failed: ${message}`);
    });
  };

  const unsubscribe = chatSession.session.subscribe((event) => {
    if (event.type === "message_update") {
      messageUpdateCount += 1;
    }
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_delta"
    ) {
      streamBuffer += event.assistantMessageEvent.delta;
      return;
    }
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "text_end"
    ) {
      endBuffer = `${endBuffer}${event.assistantMessageEvent.content}`;
      return;
    }
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "done"
    ) {
      const doneText = extractAssistantText(event.assistantMessageEvent.message);
      if (doneText) {
        endBuffer = doneText;
      }
      debugLog(`assistant done reason=${event.assistantMessageEvent.reason}`);
      return;
    }
    if (
      event.type === "message_update" &&
      event.assistantMessageEvent.type === "error"
    ) {
      debugLog(
        `assistant stream error reason=${event.assistantMessageEvent.reason}`
      );
      return;
    }

    if (event.type === "tool_execution_start") {
      toolStartCount += 1;
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
      return;
    }

    if (event.type === "message_end") {
      const messageText = extractAssistantText(event.message);
      if (messageText) {
        endBuffer = messageText;
      }
    }
  });

  try {
    await chatSession.session.prompt(text);
  } finally {
    unsubscribe();
  }

  const reply = streamBuffer.trim();
  if (reply.length > 0) {
    debugLog(`reply from text_delta length=${reply.length}`);
    return reply;
  }
  const fallbackFromMessageEnd = endBuffer.trim();
  if (fallbackFromMessageEnd.length > 0) {
    debugLog(`reply from message_end/text_end length=${fallbackFromMessageEnd.length}`);
    return fallbackFromMessageEnd;
  }
  const stateReply = extractLatestAssistantReply(chatSession.session);
  if (stateReply) {
    debugLog(
      `reply from session state length=${stateReply.length}, enableSkills=${enableSkills}`
    );
    return stateReply;
  }
  const assistantError = extractLatestAssistantError(chatSession.session);
  if (assistantError) {
    debugLog(`assistant error captured: ${assistantError}`);
    return `模型调用失败：${assistantError}`;
  }
  debugLog(
    `no assistant text captured from pi session (message_updates=${messageUpdateCount}, tool_calls=${toolStartCount}, state_messages=${chatSession.session.agent.state.messages.length}, enableSkills=${enableSkills})`
  );
  debugLog(`session tail summary: ${summarizeMessages(chatSession.session)}`);
  return null;
}

async function chatWithPi(chatId: string, text: string): Promise<string | null> {
  const withSkills = await chatWithPiInternal(chatId, text, true);
  if (withSkills) {
    return withSkills;
  }
  debugLog("retry with plain pi session (skills disabled)");
  return chatWithPiInternal(chatId, text, false);
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

function summarizeMessages(session: AgentSession): string {
  const messages = session.agent.state.messages as Array<{
    role?: string;
    content?: unknown;
  }>;
  const tail = messages.slice(-3);
  return tail
    .map((message, index) => {
      const role = message.role ?? "unknown";
      if (typeof message.content === "string") {
        return `${index}:${role}:string(${message.content.length})`;
      }
      if (Array.isArray(message.content)) {
        const kinds = message.content
          .map((item) => {
            if (!item || typeof item !== "object") {
              return "unknown";
            }
            const maybeType = (item as { type?: unknown }).type;
            return typeof maybeType === "string" ? maybeType : "object";
          })
          .join(",");
        return `${index}:${role}:array[${kinds}]`;
      }
      return `${index}:${role}:other`;
    })
    .join(" | ");
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
