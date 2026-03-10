export interface ChatInput {
  chatId: string;
  text: string;
}

export interface ChatOutput {
  replyText: string;
}

const MINIMAX_API_URL = "https://api.minimax.chat/v1/text/chatcompletion_v2";

function fallbackReply(text: string): string {
  return `收到：${text}`;
}

async function callMiniMax(text: string): Promise<string> {
  const apiKey = process.env.MINIMAX_API_KEY;
  const model = process.env.MINIMAX_MODEL ?? "MiniMax-M2.5";

  if (!apiKey) {
    return fallbackReply(text);
  }

  const response = await fetch(MINIMAX_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: "你是 StupidClaw，回答简短直接。"
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0.2
    })
  });

  if (!response.ok) {
    return fallbackReply(text);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = data.choices?.[0]?.message?.content?.trim();
  return content || fallbackReply(text);
}

export async function chat(input: ChatInput): Promise<ChatOutput> {
  const replyText = await callMiniMax(input.text);
  return { replyText: `[${input.chatId}] ${replyText}` };
}
