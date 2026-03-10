import { startGateway } from "../gateway";
import type { IncomingMessage, MessageHandler } from "./index";

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat?: { id: number | string };
    text?: string;
  };
}

const TELEGRAM_API_BASE = "https://api.telegram.org";

function buildApiUrl(token: string, method: string): string {
  return `${TELEGRAM_API_BASE}/bot${token}/${method}`;
}

function mapUpdateToMessage(update: TelegramUpdate): IncomingMessage | null {
  const text = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;
  if (!text || chatId === undefined) {
    return null;
  }
  return {
    updateId: update.update_id,
    chatId: String(chatId),
    text
  };
}

async function setWebhook(
  token: string,
  webhookUrl: string,
  secretToken?: string
): Promise<void> {
  const response = await fetch(buildApiUrl(token, "setWebhook"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secretToken,
      allowed_updates: ["message"],
      drop_pending_updates: false
    })
  });
  if (!response.ok) {
    throw new Error(`setWebhook failed: HTTP ${response.status}`);
  }
}

export async function runWebhookMode(
  token: string,
  onMessage: MessageHandler
): Promise<void> {
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error("Missing TELEGRAM_WEBHOOK_URL in webhook mode");
  }

  const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
  const gatewayPath = process.env.TELEGRAM_WEBHOOK_PATH ?? "/telegram/webhook";
  const port = Number(process.env.PORT ?? "8787");
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error("Invalid PORT");
  }

  await setWebhook(token, webhookUrl, secretToken);
  await startGateway<TelegramUpdate>({
    port,
    path: gatewayPath,
    secretToken,
    onPayload: async (payload) => {
      const message = mapUpdateToMessage(payload);
      if (message) {
        await onMessage(message);
      }
    }
  });
}
