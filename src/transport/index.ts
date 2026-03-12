import { getUpdates, sendMessage, sendChatAction } from "./polling.js";
import { runWebhookMode } from "./webhook.js";
import { startStupidIM } from "./stupid-im.js";

export interface IncomingMessage {
  updateId?: number;
  chatId: string;
  text: string;
  reply: (text: string) => Promise<void>;
  sendChatAction: () => Promise<void>;
}

export type MessageHandler = (message: IncomingMessage) => Promise<void>;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPollingMode(
  token: string,
  onMessage: MessageHandler
): Promise<void> {
  let offset = 0;
  console.log("[boot] StupidClaw Telegram polling started");

  while (true) {
    try {
      const messages = await getUpdates(token, offset);
      for (const message of messages) {
        offset = Math.max(offset, message.updateId + 1);
        await onMessage({
          updateId: message.updateId,
          chatId: message.chatId,
          text: message.text,
          reply: (text) => sendMessage(token, message.chatId, text),
          sendChatAction: () => sendChatAction(token, message.chatId)
        });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[error] telegram polling failed: ${message}`);
      await sleep(1000);
    }
  }
}

export async function startTransport(
  token: string | undefined,
  onMessage: MessageHandler
): Promise<void> {
  const imToken = process.env.STUPID_IM_TOKEN;
  if (imToken) {
    startStupidIM(imToken, onMessage);
  }

  if (!token) {
    console.log("[boot] TELEGRAM_BOT_TOKEN 未配置，跳过 Telegram 轮询");
    return;
  }

  const mode = process.env.TELEGRAM_MODE ?? "polling";

  if (mode === "webhook") {
    console.log("[boot] StupidClaw Telegram webhook started");
    await runWebhookMode(token, onMessage);
    return;
  }

  await runPollingMode(token, onMessage);
}
