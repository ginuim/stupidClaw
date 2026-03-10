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

async function disableWebhook(token: string): Promise<void> {
  const url = buildApiUrl(token, "deleteWebhook");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      drop_pending_updates: false
    })
  });

  if (!response.ok) {
    throw new Error(`deleteWebhook failed: HTTP ${response.status}`);
  }
}

async function fetchUpdatesOnce(
  token: string,
  offset: number
): Promise<Response> {
  const url = buildApiUrl(token, "getUpdates");
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      offset,
      timeout: 30,
      allowed_updates: ["message"]
    })
  });
}

export async function getUpdates(
  token: string,
  offset: number
): Promise<TelegramMessage[]> {
  let response = await fetchUpdatesOnce(token, offset);
  if (response.status === 409) {
    await disableWebhook(token);
    response = await fetchUpdatesOnce(token, offset);
  }

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

// Telegram 单条消息最大字符数
const MAX_MESSAGE_LENGTH = 4096;

// 把常见 Markdown 转为 Telegram 支持的 HTML subset
// 处理顺序：先提取代码块保护，再 escape HTML，再处理行内格式
function markdownToTelegramHtml(md: string): string {
  const blocks: string[] = [];

  // 提取 ``` 代码块，用占位符保护，避免内部内容被其他规则误处理
  let result = md.replace(/```(?:\w*\n?)?([\s\S]*?)```/g, (_, code: string) => {
    const escaped = code
      .trim()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    const idx = blocks.length;
    blocks.push(`<pre><code>${escaped}</code></pre>`);
    return `\x00BLOCK${idx}\x00`;
  });

  // escape 剩余文本里的 HTML 特殊字符
  result = result
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // 标题 # / ## / ### ... → <b>text</b>（Telegram 不支持 h1-h6）
  result = result.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");

  // 水平分隔线 --- / *** / ___ → 去掉（Telegram 不支持 <hr>）
  result = result.replace(/^[ \t]*[-*_]{3,}[ \t]*$/gm, "");

  // 行内代码 `code`
  result = result.replace(/`([^`\n]+)`/g, "<code>$1</code>");

  // 粗体 **text**
  result = result.replace(/\*\*(.+?)\*\*/gs, "<b>$1</b>");

  // 斜体 *text*（不匹配已处理的 **）
  result = result.replace(/\*([^*\n]+)\*/g, "<i>$1</i>");

  // 斜体 _text_
  result = result.replace(/_([^_\n]+)_/g, "<i>$1</i>");

  // 链接 [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // 还原代码块
  result = result.replace(/\x00BLOCK(\d+)\x00/g, (_, idx: string) => blocks[Number(idx)]);

  return result;
}

// 按换行符切片，每片不超过 MAX_MESSAGE_LENGTH
function splitMessage(text: string): string[] {
  if (text.length <= MAX_MESSAGE_LENGTH) {
    return [text];
  }

  const chunks: string[] = [];
  let current = "";

  for (const line of text.split("\n")) {
    const appended = current ? `${current}\n${line}` : line;
    if (appended.length > MAX_MESSAGE_LENGTH) {
      if (current) {
        chunks.push(current);
        current = line;
      } else {
        // 单行本身超长，强制按字符截断
        for (let i = 0; i < line.length; i += MAX_MESSAGE_LENGTH) {
          chunks.push(line.slice(i, i + MAX_MESSAGE_LENGTH));
        }
        current = "";
      }
    } else {
      current = appended;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

// 发送单条消息片段，返回是否成功
async function sendChunk(
  token: string,
  chatId: string,
  text: string,
  parseMode?: string
): Promise<boolean> {
  const url = buildApiUrl(token, "sendMessage");
  const body: Record<string, unknown> = { chat_id: chatId, text };
  if (parseMode) {
    body.parse_mode = parseMode;
  }
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    return false;
  }
  const payload = (await response.json()) as { ok: boolean };
  return payload.ok;
}

// 发送 typing 状态，fire-and-forget，失败静默忽略
export async function sendChatAction(
  token: string,
  chatId: string
): Promise<void> {
  const url = buildApiUrl(token, "sendChatAction");
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, action: "typing" })
  });
}

export async function sendMessage(
  token: string,
  chatId: string,
  text: string
): Promise<void> {
  const html = markdownToTelegramHtml(text);
  const chunks = splitMessage(html);

  // 尝试 HTML 模式发送所有片段
  for (const chunk of chunks) {
    const ok = await sendChunk(token, chatId, chunk, "HTML");
    if (!ok) {
      // HTML 解析失败，fallback：用原始文本切片纯文本发送
      console.warn("[warn] sendMessage HTML parse failed, falling back to plain text");
      for (const rawChunk of splitMessage(text)) {
        const response = await fetch(buildApiUrl(token, "sendMessage"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ chat_id: chatId, text: rawChunk })
        });
        if (!response.ok) {
          throw new Error(`sendMessage failed: HTTP ${response.status}`);
        }
      }
      return;
    }
  }
}
