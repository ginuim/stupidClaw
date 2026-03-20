// 供应商配置定义，与 src/init-providers.ts 保持一致

export type Provider = {
  value: string;
  name: string;
  /** API Key 对应的环境变量名。空字符串表示无需 API Key（如 Ollama） */
  envKey: string;
  models: { value: string; name: string }[];
  /** 固定 baseUrl（dashscope/bigmodel 等 OpenAI 兼容服务） */
  baseUrl?: string;
  /** 协议类型，用于 registerProvider */
  apiType?: "openai-completions" | "anthropic-messages";
  /** 需要向导额外提示用户输入 baseUrl */
  isCustom?: boolean;
  /** isCustom 时 baseUrl 输入框的默认值 */
  defaultBaseUrl?: string;
  /** baseUrl 写入 .env 时使用的变量名（默认由 envKey 推导） */
  baseUrlEnvKey?: string;
};

export const PROVIDERS: Provider[] = [
  {
    value: "minimax-cn",
    name: "MiniMax 国内版 (minimaxi.com)",
    envKey: "MINIMAX_CN_API_KEY",
    models: [
      { value: "minimax-cn:MiniMax-M2.5", name: "MiniMax-M2.5" },
      { value: "minimax-cn:MiniMax-M2.1", name: "MiniMax-M2.1" },
    ],
  },
  {
    value: "minimax",
    name: "MiniMax 国际版 (minimax.io)",
    envKey: "MINIMAX_API_KEY",
    models: [
      { value: "minimax:MiniMax-M2.5", name: "MiniMax-M2.5" },
    ],
  },
  {
    value: "deepseek",
    name: "DeepSeek 官方 (deepseek.com)",
    envKey: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com/v1",
    apiType: "openai-completions",
    models: [
      { value: "deepseek:deepseek-chat", name: "DeepSeek Chat (V3)" },
      { value: "deepseek:deepseek-reasoner", name: "DeepSeek Reasoner (R1)" },
    ],
  },
  {
    value: "kimi",
    name: "Kimi (Moonshot AI，国内直连)",
    envKey: "MOONSHOT_API_KEY",
    baseUrl: "https://api.moonshot.cn/v1",
    apiType: "openai-completions",
    models: [
      { value: "kimi:kimi-k2.5", name: "Kimi K2.5 (Agent Swarm / 视觉与代码)" },
      { value: "kimi:kimi-k2-thinking", name: "Kimi K2 Thinking (深度推理增强)" },
    ],
  },
  {
    value: "bigmodel",
    name: "智谱 bigmodel.cn (GLM 系列)",
    envKey: "ZHIPU_API_KEY",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    apiType: "openai-completions",
    models: [
      { value: "bigmodel:glm-5", name: "GLM-5 (744B MoE 旗舰)" },
      { value: "bigmodel:glm-4.6", name: "GLM-4.6" },
    ],
  },
  {
    value: "dashscope",
    name: "阿里云 DashScope",
    envKey: "DASHSCOPE_API_KEY",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiType: "openai-completions",
    models: [
      { value: "dashscope:qwen3.5-plus", name: "Qwen 3.5 Plus" },
      { value: "dashscope:qwen3-max-thinking", name: "Qwen 3 Max Thinking (适合复杂 Agent)" },
      { value: "dashscope:qwen3.5-medium", name: "Qwen 3.5 Medium (极速高性价比)" },
    ],
  },
  {
    value: "openai",
    name: "OpenAI",
    envKey: "OPENAI_API_KEY",
    models: [
      { value: "openai:gpt-5.4", name: "GPT-5.4 (1M Context / 强 Agent)" },
      { value: "openai:gpt-5.4-thinking", name: "GPT-5.4 Thinking (自带思维链)" },
      { value: "openai:gpt-5.3-codex", name: "GPT-5.3 Codex (代码作业优选)" },
      { value: "openai:gpt-4o", name: "GPT-4o (常规备用)" },
    ],
  },
  {
    value: "anthropic",
    name: "Anthropic Claude",
    envKey: "ANTHROPIC_API_KEY",
    models: [
      { value: "anthropic:claude-opus-4.6", name: "Claude Opus 4.6 (长线 Agent 规划王牌)" },
      { value: "anthropic:claude-3-7-sonnet-20250224", name: "Claude 3.7 Sonnet (混合推理/代码强)" },
      { value: "anthropic:claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku" },
    ],
  },
  {
    value: "google",
    name: "Google Gemini",
    envKey: "GEMINI_API_KEY",
    models: [
      { value: "google:gemini-3.1-pro", name: "Gemini 3.1 Pro (复杂逻辑与多模态)" },
      { value: "google:gemini-3.1-flash-lite", name: "Gemini 3.1 Flash-Lite (毫秒级响应)" },
      { value: "google:gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    ],
  },
  {
    value: "openrouter",
    name: "OpenRouter (全球聚合通道)",
    envKey: "OPENROUTER_API_KEY",
    models: [
      { value: "openrouter:deepseek/deepseek-v4", name: "DeepSeek V4" },
      { value: "openrouter:deepseek/deepseek-r1-0528", name: "DeepSeek R1-0528 (强化推理版)" },
      { value: "openrouter:anthropic/claude-3.7-sonnet", name: "Claude 3.7 Sonnet" },
      { value: "openrouter:zhipu/glm-5", name: "Zhipu GLM-5" },
      { value: "openrouter:openrouter/auto", name: "OpenRouter Auto (自动路由)" },
    ],
  },
  {
    value: "groq",
    name: "Groq (免费额度，极速推理芯片)",
    envKey: "GROQ_API_KEY",
    models: [
      { value: "groq:llama-3.3-70b-versatile", name: "Llama 3.3 70B" },
      { value: "groq:deepseek-r1-distill-llama-70b", name: "DeepSeek R1 Llama 70B" },
    ],
  },
  {
    value: "xai",
    name: "xAI Grok",
    envKey: "XAI_API_KEY",
    models: [{ value: "xai:grok-latest", name: "Grok Latest" }],
  },
  {
    value: "ollama",
    name: "Ollama（本地模型，需先在本机运行 Ollama）",
    envKey: "",
    apiType: "openai-completions",
    isCustom: true,
    defaultBaseUrl: "http://localhost:11434/v1",
    baseUrlEnvKey: "OLLAMA_BASE_URL",
    models: [],
  },
  {
    value: "lmstudio",
    name: "LM Studio（本地模型，需先在本机运行 LM Studio）",
    envKey: "",
    apiType: "openai-completions",
    isCustom: true,
    defaultBaseUrl: "http://localhost:1234/v1",
    baseUrlEnvKey: "LMSTUDIO_BASE_URL",
    models: [],
  },
  {
    value: "custom-openai",
    name: "自定义 OpenAI 兼容接口（任意 baseUrl）",
    envKey: "CUSTOM_OPENAI_API_KEY",
    apiType: "openai-completions",
    isCustom: true,
    models: [],
  },
  {
    value: "custom-anthropic",
    name: "自定义 Anthropic 兼容接口（任意 baseUrl）",
    envKey: "CUSTOM_ANTHROPIC_API_KEY",
    apiType: "anthropic-messages",
    isCustom: true,
    models: [],
  },
];

// 用户配置的供应商
export type UserProviderConfig = {
  id: string;
  providerValue: string;
  apiKey: string;
  baseUrl?: string;
  selectedModel: string;
};

// 完整配置
export type AppConfig = {
  providers: UserProviderConfig[];
  activeProviderId: string | null;
  port: string;
  stupidImToken: string;
};

// 获取供应商定义
export function getProviderDef(value: string): Provider | undefined {
  return PROVIDERS.find((p) => p.value === value);
}

// 获取供应商的模型列表
export function getProviderModels(providerValue: string): { value: string; name: string }[] {
  const provider = getProviderDef(providerValue);
  return provider?.models || [];
}

// 生成默认配置
export function createDefaultConfig(): AppConfig {
  return {
    providers: [],
    activeProviderId: null,
    port: "8080",
    stupidImToken: generateToken(),
  };
}

// 生成随机 token
function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// 创建新的供应商配置
export function createProviderConfig(providerValue: string): UserProviderConfig {
  const provider = getProviderDef(providerValue);
  const models = getProviderModels(providerValue);

  return {
    id: `provider_${Date.now()}`,
    providerValue,
    apiKey: "",
    baseUrl: provider?.defaultBaseUrl || "",
    selectedModel: models.length > 0 ? models[0].value : "",
  };
}
