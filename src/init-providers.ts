// 供应商 + 模型选项，init 向导使用

export const PROVIDERS = [
  {
    value: "minimax-cn",
    name: "MiniMax 国内版 (minimaxi.com，推荐国内用户)",
    envKey: "MINIMAX_CN_API_KEY",
    models: [
      { value: "minimax-cn:MiniMax-M2.5", name: "MiniMax-M2.5" },
      { value: "minimax-cn:MiniMax-M2.1", name: "MiniMax-M2.1" },
    ],
  },
  {
    value: "minimax",
    name: "MiniMax 国际版",
    envKey: "MINIMAX_API_KEY",
    models: [
      { value: "minimax:MiniMax-M2.5", name: "MiniMax-M2.5" },
      { value: "minimax:MiniMax-M2.1", name: "MiniMax-M2.1" },
    ],
  },
  {
    value: "openai",
    name: "OpenAI",
    envKey: "OPENAI_API_KEY",
    models: [
      { value: "openai:gpt-4o", name: "GPT-4o" },
      { value: "openai:gpt-4o-mini", name: "GPT-4o-mini" },
      { value: "openai:o1-mini", name: "o1-mini" },
    ],
  },
  {
    value: "anthropic",
    name: "Anthropic Claude",
    envKey: "ANTHROPIC_API_KEY",
    models: [
      { value: "anthropic:claude-3-5-sonnet-20241022", name: "Claude 3.5 Sonnet" },
      { value: "anthropic:claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
    ],
  },
  {
    value: "google",
    name: "Google Gemini",
    envKey: "GEMINI_API_KEY",
    models: [
      { value: "google:gemini-2.0-flash", name: "Gemini 2.0 Flash" },
      { value: "google:gemini-1.5-pro", name: "Gemini 1.5 Pro" },
    ],
  },
  {
    value: "groq",
    name: "Groq (免费额度，速度快)",
    envKey: "GROQ_API_KEY",
    models: [
      { value: "groq:llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
      { value: "groq:llama-3.1-8b-instant", name: "Llama 3.1 8B" },
    ],
  },
  {
    value: "openrouter",
    name: "OpenRouter (聚合 DeepSeek、Hunter、Healer 等)",
    envKey: "OPENROUTER_API_KEY",
    models: [
      { value: "openrouter:openrouter/hunter-alpha", name: "Hunter Alpha (推荐，Agent 专用)" },
      { value: "openrouter:openrouter/healer-alpha", name: "Healer Alpha (推荐，多模态)" },
      { value: "openrouter:deepseek/deepseek-r1", name: "DeepSeek R1" },
      { value: "openrouter:deepseek/deepseek-chat", name: "DeepSeek Chat" },
    ],
  },
  {
    value: "xai",
    name: "xAI Grok",
    envKey: "XAI_API_KEY",
    models: [{ value: "xai:grok-2-latest", name: "Grok 2" }],
  },
] as const;

export type ProviderValue = (typeof PROVIDERS)[number]["value"];
