import { startGateway } from "../gateway.js";
import type { MessageHandler } from "./index.js";
import { sendMessage, sendChatAction } from "./polling.js";

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

import { startStupidIM, handleStupidIMRequest } from "./stupid-im.js";

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
    onGet: (req, res) => {
      return handleStupidIMRequest(req, res);
    },
    onServerCreated: (server) => {
      const imToken = process.env.STUPID_IM_TOKEN;
      if (imToken) {
        startStupidIM(imToken, onMessage, server);
      }
    },
    onPayload: async (payload) => {
      const text = payload.message?.text?.trim();
      const chatId = payload.message?.chat?.id;
      if (text && chatId !== undefined) {
        await onMessage({
          updateId: payload.update_id,
          chatId: String(chatId),
          text,
          reply: (replyText) => sendMessage(token, String(chatId), replyText),
          sendChatAction: () => sendChatAction(token, String(chatId))
        });
      }
    }
  });
}
