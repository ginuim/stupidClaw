import {
  AuthStorage,
  createAgentSession,
  ModelRegistry,
  SessionManager,
  type AgentSession
} from "@mariozechner/pi-coding-agent";

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

function fallbackReply(text: string): string {
  return `收到：${text}`;
}

function pickMiniMaxModel(modelRegistry: ModelRegistry) {
  const preferredModelId = process.env.MINIMAX_MODEL;
  if (preferredModelId) {
    const preferred =
      modelRegistry.find("minimax", preferredModelId) ||
      modelRegistry.find("minimax-cn", preferredModelId);
    if (preferred) {
      return preferred;
    }
  }

  const available = modelRegistry.getAvailable();
  const minimax = available.find(
    (model) => model.provider === "minimax" || model.provider === "minimax-cn"
  );
  return minimax ?? available[0];
}

async function createChatSession(): Promise<ChatSession | null> {
  if (!process.env.MINIMAX_API_KEY && !process.env.MINIMAX_CN_API_KEY) {
    return null;
  }

  const authStorage = AuthStorage.create();
  const modelRegistry = new ModelRegistry(authStorage);
  const model = pickMiniMaxModel(modelRegistry);

  if (!model) {
    return null;
  }

  const { session } = await createAgentSession({
    authStorage,
    modelRegistry,
    model,
    sessionManager: SessionManager.inMemory(),
    tools: [],
    thinkingLevel: "off"
  });

  return { session };
}

async function getChatSession(chatId: string): Promise<ChatSession | null> {
  const existing = chatSessions.get(chatId);
  if (existing) {
    return existing;
  }

  const created = await createChatSession();
  if (!created) {
    return null;
  }
  chatSessions.set(chatId, created);
  return created;
}

async function chatWithPi(chatId: string, text: string): Promise<string | null> {
  const chatSession = await getChatSession(chatId);
  if (!chatSession) {
    return null;
  }

  let streamBuffer = "";
  const unsubscribe = chatSession.session.subscribe((event) => {
    if (event.type !== "message_update") {
      return;
    }
    if (event.assistantMessageEvent.type === "text_delta") {
      streamBuffer += event.assistantMessageEvent.delta;
    }
  });

  try {
    await chatSession.session.prompt(text);
  } finally {
    unsubscribe();
  }

  const reply = streamBuffer.trim();
  return reply.length > 0 ? reply : null;
}

export async function chat(input: ChatInput): Promise<ChatOutput> {
  const piReply = await chatWithPi(input.chatId, input.text);
  return { replyText: piReply ?? fallbackReply(input.text) };
}
