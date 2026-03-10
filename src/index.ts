import { chat } from "./engine";
import { getUpdates, sendMessage } from "./transport/polling";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  let offset = 0;
  console.log("[boot] StupidClaw polling started");

  while (true) {
    try {
      const messages = await getUpdates(token, offset);
      for (const message of messages) {
        offset = Math.max(offset, message.updateId + 1);
        const result = await chat({
          chatId: message.chatId,
          text: message.text
        });
        await sendMessage(token, message.chatId, result.replyText);
        console.log(
          `[ok] chatId=${message.chatId} updateId=${message.updateId} text="${message.text}"`
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[error] polling failed: ${message}`);
      await sleep(1000);
    }
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[fatal] ${message}`);
  process.exit(1);
});
