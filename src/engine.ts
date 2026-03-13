import fs from "node:fs";
import {
  AuthStorage,
  createCodingTools,
  createAgentSession,
  DefaultResourceLoader,
  formatSkillsForPrompt,
  ModelRegistry,
  SessionManager,
  type AgentSession
} from "@mariozechner/pi-coding-agent";
import { appendHistoryEvent } from "./memory/history-store.js";
import { readProfileMarkdown } from "./memory/profile-store.js";
import { resolveSafePath } from "./memory/workspace-path.js";
import { IDENTITY_PROMPT_LINES } from "./prompt/identity.js";
import { loadStandardFileSkills } from "./skills/file-skills.js";
import { createSkillRegistry, type SkillRegistry } from "./skills/registry.js";

export interface ChatInput {
  chatId: string;
  text: string;
}

export interface ChatOutput {
  replyText: string;
}

interface ChatSession {
  session: AgentSession;
  skillRegistry: SkillRegistry;
  fileSkillNames: string[];
}

const chatSessions = new Map<string, ChatSession>();
const DEBUG_ENGINE = process.env.DEBUG_STUPIDCLAW === "1";
const DEBUG_PROMPT = process.env.DEBUG_PROMPT === "1";
const WORKSPACE_ROOT = resolveSafePath("workspace");
let startupConfigLogged = false;
const PROVIDER_ENV_KEY_MAP: Record<string, string> = {
  minimax: "MINIMAX_API_KEY",
  "minimax-cn": "MINIMAX_CN_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GEMINI_API_KEY",
  groq: "GROQ_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  xai: "XAI_API_KEY",
  "kimi-coding": "KIMI_API_KEY",
  huggingface: "HF_TOKEN",
  deepseek: "DEEPSEEK_API_KEY",
  kimi: "MOONSHOT_API_KEY",
  dashscope: "DASHSCOPE_API_KEY",
  bigmodel: "ZHIPU_API_KEY",
  "custom-openai": "CUSTOM_OPENAI_API_KEY",
  "custom-anthropic": "CUSTOM_ANTHROPIC_API_KEY",
};

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

function debugToolsLog(
  session: AgentSession,
  skillRegistry: SkillRegistry,
  fileSkillNames: string[]
): void {
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

function stripThinkTags(text: string): string {
  return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
}

function normalizeApiKeyError(error: unknown): Error {
  const rawMessage = error instanceof Error ? error.message : String(error);
  const keyMatch = rawMessage.match(/No API key found for ([\w-]+)/i);
  if (!keyMatch) {
    return error instanceof Error ? error : new Error(rawMessage);
  }

  const missingProvider = keyMatch[1];
  const configuredModel = process.env.STUPID_MODEL ?? "";
  const configuredProvider = configuredModel.includes(":") ? configuredModel.split(":")[0] : "";

  if (configuredProvider && configuredProvider !== missingProvider) {
    const configuredKey = PROVIDER_ENV_KEY_MAP[configuredProvider] ?? `${configuredProvider.toUpperCase()}_API_KEY`;
    return new Error(
      `当前 STUPID_MODEL=${configuredModel}，但运行时提示缺少 ${missingProvider} 的 API Key。` +
        `这通常表示已回退到默认 provider。请确认 ${configuredKey} 已正确配置，且 STUPID_MODEL 的 provider/model_id 拼写正确。`
    );
  }

  const missingKey = PROVIDER_ENV_KEY_MAP[missingProvider];
  if (missingKey) {
    return new Error(`缺少 ${missingProvider} 的 API Key，请在 .env 中配置 ${missingKey}。`);
  }
  return new Error(`缺少 ${missingProvider} 的 API Key，请检查 .env 中对应 provider 的密钥配置。`);
}

function buildStaticSystemPrompt(fileSkillsPrompt: string): string {
  const lines: string[] = [...IDENTITY_PROMPT_LINES];
  if (fileSkillsPrompt.trim()) {
    lines.push("", "<file_skills>", fileSkillsPrompt.trim(), "</file_skills>");
  }
  return lines.join("\n");
}

function pickModel(modelRegistry: ModelRegistry) {
  const config = process.env.STUPID_MODEL || process.env.MINIMAX_MODEL;
  const available = modelRegistry.getAvailable();

  if (config) {
    // 支持 provider:model_id 格式，也兼容旧的直接 model_id 格式（默认为 minimax-cn/minimax）
    if (config.includes(":")) {
      const [provider, id] = config.split(":");
      const found = modelRegistry.find(provider, id);
      if (found) {
        debugLog(`selected model from config: ${provider}/${id}`);
        return found;
      }
      const providerKey =
        PROVIDER_ENV_KEY_MAP[provider] ?? `${provider.toUpperCase()}_API_KEY`;
      const providerModels = available
        .filter((m) => m.provider === provider)
        .map((m) => m.id);
      if (providerModels.length === 0) {
        throw new Error(
          `STUPID_MODEL=${config} 无法匹配可用模型：provider=${provider} 当前没有可用模型。` +
            `请检查 ${providerKey} 是否已正确配置，或确认该 provider 是否受当前运行时支持。`
        );
      }
      throw new Error(
        `STUPID_MODEL=${config} 无法匹配可用模型。` +
          `provider=${provider} 当前可用模型：${providerModels.join(", ")}。` +
          `请检查 model_id 拼写，或改成上述可用模型之一。`
      );
    } else {
      // 兼容旧逻辑：如果是纯 model_id，尝试在 minimax 家族里找
      const found =
        modelRegistry.find("minimax-cn", config) ||
        modelRegistry.find("minimax", config);
      if (found) {
        debugLog(`selected preferred minimax model=${found.provider}/${found.id}`);
        return found;
      }
    }
  }

  // 默认兜底：优先找 minimax-cn，找不到就用第一个可用的
  return (
    modelRegistry.find("minimax-cn", "MiniMax-M2.5") ??
    available.find((m) => m.provider === "minimax-cn") ??
    available.find((m) => m.provider === "minimax") ??
    available[0]
  );
}

function createModelRegistry(): ModelRegistry {
  const authStorage = AuthStorage.create();
  // 某些 provider 的环境变量名与内部 provider 名不完全一一对应，这里显式映射。
  if (process.env.OPENROUTER_API_KEY) {
    authStorage.setRuntimeApiKey("openrouter", process.env.OPENROUTER_API_KEY);
    debugLog("OPENROUTER_API_KEY loaded for openrouter");
  }
  // MiniMax 兼容：如果只填了 MINIMAX_API_KEY，则复用到 minimax-cn
  if (process.env.MINIMAX_API_KEY && !process.env.MINIMAX_CN_API_KEY) {
    authStorage.setRuntimeApiKey("minimax-cn", process.env.MINIMAX_API_KEY);
    debugLog("MINIMAX_CN_API_KEY missing; reuse MINIMAX_API_KEY for minimax-cn");
  }

  const registry = new ModelRegistry(authStorage);

  // DeepSeek 官方（OpenAI 兼容）
  if (process.env.DEEPSEEK_API_KEY) {
    registry.registerProvider("deepseek", {
      baseUrl: "https://api.deepseek.com/v1",
      apiKey: process.env.DEEPSEEK_API_KEY,
      api: "openai-completions",
      models: [
        { id: "deepseek-chat", name: "DeepSeek Chat (V3)", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 65536, maxTokens: 8192 },
        { id: "deepseek-reasoner", name: "DeepSeek Reasoner (R1)", reasoning: true, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 65536, maxTokens: 8192 },
      ],
    });
    debugLog("deepseek provider registered");
  }

  // Kimi（Moonshot AI，OpenAI 兼容）
  if (process.env.MOONSHOT_API_KEY) {
    registry.registerProvider("kimi", {
      baseUrl: "https://api.moonshot.cn/v1",
      apiKey: process.env.MOONSHOT_API_KEY,
      api: "openai-completions",
      models: [
        { id: "moonshot-v1-128k", name: "moonshot-v1-128k", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 },
        { id: "moonshot-v1-32k", name: "moonshot-v1-32k", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 32768, maxTokens: 8192 },
        { id: "moonshot-v1-8k", name: "moonshot-v1-8k", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 8192, maxTokens: 4096 },
        { id: "kimi-k2-0711-preview", name: "Kimi K2", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 131072, maxTokens: 8192 },
        { id: "kimi-thinking-preview", name: "Kimi Thinking", reasoning: true, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 131072, maxTokens: 8192 },
      ],
    });
    debugLog("kimi provider registered");
  }

  // 阿里云 DashScope（OpenAI 兼容）
  if (process.env.DASHSCOPE_API_KEY) {
    registry.registerProvider("dashscope", {
      baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      apiKey: process.env.DASHSCOPE_API_KEY,
      api: "openai-completions",
      models: [
        { id: "qwen-max", name: "Qwen Max", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 32768, maxTokens: 8192 },
        { id: "qwen-plus", name: "Qwen Plus", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 131072, maxTokens: 8192 },
        { id: "qwen-turbo", name: "Qwen Turbo", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 131072, maxTokens: 8192 },
        { id: "qwen3-235b-a22b", name: "Qwen3 235B", reasoning: true, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 131072, maxTokens: 8192 },
        { id: "qwen3-72b", name: "Qwen3 72B", reasoning: true, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 131072, maxTokens: 8192 },
      ],
    });
    debugLog("dashscope provider registered");
  }

  // 智谱 bigmodel.cn（OpenAI 兼容）
  if (process.env.ZHIPU_API_KEY) {
    registry.registerProvider("bigmodel", {
      baseUrl: "https://open.bigmodel.cn/api/paas/v4",
      apiKey: process.env.ZHIPU_API_KEY,
      api: "openai-completions",
      models: [
        { id: "glm-4", name: "GLM-4", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 4096 },
        { id: "glm-4-flash", name: "GLM-4-Flash", reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 4096 },
        { id: "glm-z1-flash", name: "GLM-Z1-Flash", reasoning: true, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 4096 },
      ],
    });
    debugLog("bigmodel provider registered");
  }

  // 自定义 OpenAI 兼容接口
  if (process.env.CUSTOM_OPENAI_BASE_URL && process.env.CUSTOM_OPENAI_API_KEY) {
    const modelId = extractCustomModelId("custom-openai");
    registry.registerProvider("custom-openai", {
      baseUrl: process.env.CUSTOM_OPENAI_BASE_URL,
      apiKey: process.env.CUSTOM_OPENAI_API_KEY,
      api: "openai-completions",
      models: modelId
        ? [{ id: modelId, name: modelId, reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 128000, maxTokens: 8192 }]
        : [],
    });
    debugLog(`custom-openai provider registered, baseUrl=${process.env.CUSTOM_OPENAI_BASE_URL}`);
  }

  // 自定义 Anthropic 兼容接口
  if (process.env.CUSTOM_ANTHROPIC_BASE_URL && process.env.CUSTOM_ANTHROPIC_API_KEY) {
    const modelId = extractCustomModelId("custom-anthropic");
    registry.registerProvider("custom-anthropic", {
      baseUrl: process.env.CUSTOM_ANTHROPIC_BASE_URL,
      apiKey: process.env.CUSTOM_ANTHROPIC_API_KEY,
      api: "anthropic-messages",
      models: modelId
        ? [{ id: modelId, name: modelId, reasoning: false, input: ["text"], cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }, contextWindow: 200000, maxTokens: 8192 }]
        : [],
    });
    debugLog(`custom-anthropic provider registered, baseUrl=${process.env.CUSTOM_ANTHROPIC_BASE_URL}`);
  }

  return registry;
}

/** 从 STUPID_MODEL=provider:model_id 中提取指定 provider 的 model_id */
function extractCustomModelId(providerName: string): string | undefined {
  const config = process.env.STUPID_MODEL ?? "";
  if (!config.startsWith(`${providerName}:`)) return undefined;
  return config.slice(providerName.length + 1) || undefined;
}

async function createChatSession(chatId: string): Promise<ChatSession | null> {
  const modelRegistry = createModelRegistry();
  const model = pickModel(modelRegistry);

  if (!model) {
    debugLog("createChatSession failed: no model available. Please check your API keys in .env");
    return null;
  }

  if (DEBUG_ENGINE && !startupConfigLogged) {
    startupConfigLogged = true;
    console.log(
      "[debug][engine] runtime config:",
      JSON.stringify(
        {
          telegramMode: process.env.TELEGRAM_MODE ?? "polling",
          stupidModelEnv: process.env.STUPID_MODEL ?? "(empty)",
          selectedProvider: model.provider,
          selectedModelId: model.id,
          selectedBaseUrl: model.baseUrl,
          workspaceRoot: WORKSPACE_ROOT,
          debugEnabled: DEBUG_ENGINE
        },
        null,
        2
      )
    );
  }

  fs.mkdirSync(WORKSPACE_ROOT, { recursive: true });
  const skillRegistry = createSkillRegistry({
    getDefaultChatId: () => chatId
  });

  const fileSkills = loadStandardFileSkills();
  const fileSkillNames = fileSkills.map((skill) => skill.name);
  const fileSkillsPrompt = fileSkills.length > 0 ? formatSkillsForPrompt(fileSkills) : "";

  const loader = new DefaultResourceLoader({
    noExtensions: true,
    noSkills: true,
    noPromptTemplates: true,
    noThemes: true,
    systemPromptOverride: () => buildStaticSystemPrompt(fileSkillsPrompt),
    appendSystemPromptOverride: () => []
  });
  await loader.reload();

  let session: AgentSession;
  try {
    ({ session } = await createAgentSession({
      authStorage: modelRegistry.authStorage,
      cwd: WORKSPACE_ROOT,
      modelRegistry,
      model,
      sessionManager: SessionManager.inMemory(),
      tools: createCodingTools(WORKSPACE_ROOT),
      customTools: skillRegistry.all.map((skill) => skill.tool),
      thinkingLevel: "off",
      resourceLoader: loader
    }));
  } catch (error) {
    throw normalizeApiKeyError(error);
  }

  debugLog(`chat session created with model=${model.provider}/${model.id}`);
  return { session, skillRegistry, fileSkillNames };
}

async function getChatSession(chatId: string): Promise<ChatSession | null> {
  const existing = chatSessions.get(chatId);
  if (existing) {
    debugLog(`reuse session for chatId=${chatId}`);
    return existing;
  }

  const created = await createChatSession(chatId);
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

async function buildTurnPrompt(chatId: string, text: string): Promise<string> {
  const profile = await readProfileMarkdown();
  const now = new Date();
  const nowIso = now.toISOString();
  const nowLocal = now.toLocaleString("zh-CN", { hour12: false });

  return [
    "以下是当前回合的运行上下文，请优先使用，不要向用户重复索要这些信息。",
    "",
    "<runtime_context>",
    `chat_id=${chatId}`,
    `now_iso=${nowIso}`,
    `now_local=${nowLocal}`,
    "</runtime_context>",
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
  ].join("\n");
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
    const prompt = await buildTurnPrompt(chatId, text);
    debugPromptLog(chatId, prompt);
    debugToolsLog(chatSession.session, chatSession.skillRegistry, chatSession.fileSkillNames);
    try {
      await chatSession.session.prompt(prompt);
    } catch (error) {
      throw normalizeApiKeyError(error);
    }
  } finally {
    unsubscribe();
  }

  const directReply = stripThinkTags(replyBuffer);
  if (directReply) {
    return directReply;
  }

  const stateReply = stripThinkTags(extractLatestAssistantReply(chatSession.session));
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
      if (message.errorMessage.toLowerCase().includes("api key")) {
        return "API Key 无效或未配置，请检查并更换 .env 中的相关配置。";
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
