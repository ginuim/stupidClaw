import { getUpdates } from "./polling";
import { runWebhookMode } from "./webhook";

export interface IncomingMessage {
  updateId?: number;
  chatId: string;
  text: string;
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
  console.log("[boot] StupidClaw polling started");

  while (true) {
    try {
      const messages = await getUpdates(token, offset);
      for (const message of messages) {
        offset = Math.max(offset, message.updateId + 1);
        await onMessage(message);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[error] polling failed: ${message}`);
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
    console.log("[boot] StupidClaw webhook started");
    await runWebhookMode(token, onMessage);
    return;
  }

  await runPollingMode(token, onMessage);
}
