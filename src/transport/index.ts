import { getUpdates, sendMessage, sendChatAction } from "./polling";
import { runWebhookMode } from "./webhook";
import { startStupidIM } from "./stupid-im";

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
  token: string,
  onMessage: MessageHandler
): Promise<void> {
  const mode = process.env.TELEGRAM_MODE ?? "polling";

  if (mode === "webhook") {
    console.log("[boot] StupidClaw Telegram webhook started");
    await runWebhookMode(token, onMessage);
    return;
  }

  // Polling mode: start StupidIM on its own port if token is provided
  const imToken = process.env.STUPID_IM_TOKEN;
  if (imToken) {
    startStupidIM(imToken, onMessage);
  }

  await runPollingMode(token, onMessage);
}
