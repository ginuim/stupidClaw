export interface TelegramMessage {
  updateId: number;
  chatId: string;
  text: string;
}

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

export async function getUpdates(
  token: string,
  offset: number
): Promise<TelegramMessage[]> {
  const url = buildApiUrl(token, "getUpdates");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      offset,
      timeout: 30,
      allowed_updates: ["message"]
    })
  });

  if (!response.ok) {
    throw new Error(`getUpdates failed: HTTP ${response.status}`);
  }

  const payload = (await response.json()) as {
    ok: boolean;
    result: TelegramUpdate[];
  };

  if (!payload.ok) {
    throw new Error("getUpdates failed: Telegram returned ok=false");
  }

  return payload.result
    .map((update) => {
      const text = update.message?.text?.trim();
      const chatId = update.message?.chat?.id;
      if (!text || chatId === undefined) {
        return null;
      }
      return {
        updateId: update.update_id,
        chatId: String(chatId),
        text
      } satisfies TelegramMessage;
    })
    .filter((item): item is TelegramMessage => item !== null);
}

export async function sendMessage(
  token: string,
  chatId: string,
  text: string
): Promise<void> {
  const url = buildApiUrl(token, "sendMessage");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text
    })
  });

  if (!response.ok) {
    throw new Error(`sendMessage failed: HTTP ${response.status}`);
  }
}
