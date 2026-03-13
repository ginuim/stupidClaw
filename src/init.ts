import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { confirm, input, password, select } from "@inquirer/prompts";
import pc from "picocolors";
import { PROVIDERS, type InitProvider, type ProviderValue } from "./init-providers.js";

type SelectChoice = {
  value: string;
  name: string;
};

type KeyValidationResult = {
  ok: boolean;
  message: string;
  modelIds?: string[];
};

const OPENROUTER_CN_AGENT_PRIORITY: string[] = [
  "deepseek/deepseek-r1",
  "deepseek/deepseek-chat",
  "deepseek/deepseek-chat-v3.1",
  "deepseek/deepseek-v3.2",
  "qwen/qwen3-coder",
  "qwen/qwen3-coder-plus",
  "qwen/qwen3-max-thinking",
  "moonshotai/kimi-k2-thinking",
  "moonshotai/kimi-k2",
  "minimax/minimax-m2.5",
];

const OPENROUTER_AGENT_PRIORITY: string[] = [
  "openrouter/auto",
  "openrouter/hunter-alpha",
  "openrouter/healer-alpha",
  "anthropic/claude-sonnet-4",
  "anthropic/claude-3.7-sonnet",
  "openai/gpt-5.3-codex",
  "openai/gpt-5-codex",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
];

const MANUAL_MODEL_VALUE = "__manual_model_id__";

function uniq(list: string[]): string[] {
  return Array.from(new Set(list));
}

function isCnModelId(id: string): boolean {
  return /^(deepseek|qwen|moonshotai|minimax|baidu|bytedance-seed|z-ai|stepfun|xiaomi|alibaba)\//.test(id);
}

function isAgentFriendlyModelId(id: string): boolean {
  return /(coder|reason|r1|thinking|sonnet|gpt-5|gpt-4\.1|o3|gemini-2\.5|auto)/i.test(id);
}

function validateProviderApiKey(
  _provider: InitProvider,
  providerApiKey: string
): KeyValidationResult {
  if (!providerApiKey.trim()) {
    return { ok: false, message: "API Key 为空，请重新输入" };
  }
  return { ok: true, message: "" };
}

function buildOpenRouterChoices(modelIds: string[]): SelectChoice[] {
  const available = new Set(modelIds);
  const recommendedCn = OPENROUTER_CN_AGENT_PRIORITY.filter((id) => available.has(id));
  const recommendedAgent = OPENROUTER_AGENT_PRIORITY.filter((id) => available.has(id));
  const cnPool = modelIds.filter((id) => isCnModelId(id) && !recommendedCn.includes(id)).slice(0, 10);
  const agentPool = modelIds
    .filter(
      (id) =>
        isAgentFriendlyModelId(id) &&
        !recommendedCn.includes(id) &&
        !recommendedAgent.includes(id) &&
        !cnPool.includes(id)
    )
    .slice(0, 10);

  const options: SelectChoice[] = [];
  for (const id of recommendedCn) {
    options.push({
      value: `openrouter:${id}`,
      name: `国产高性价比 | ${id}`,
    });
  }
  for (const id of recommendedAgent) {
    options.push({
      value: `openrouter:${id}`,
      name: `通用 Agent 推荐 | ${id}`,
    });
  }
  for (const id of cnPool) {
    options.push({
      value: `openrouter:${id}`,
      name: `国产可用 | ${id}`,
    });
  }
  for (const id of agentPool) {
    options.push({
      value: `openrouter:${id}`,
      name: `Agent 可用 | ${id}`,
    });
  }

  if (options.length === 0) {
    return [
      {
        value: "openrouter:openrouter/auto",
        name: "OpenRouter Auto (自动路由)",
      },
      {
        value: MANUAL_MODEL_VALUE,
        name: "手动输入 model_id（高级）",
      },
    ];
  }

  options.push({
    value: MANUAL_MODEL_VALUE,
    name: "手动输入 model_id（高级）",
  });
  return options;
}

function buildStaticModelChoices(provider: InitProvider): SelectChoice[] {
  return [
    ...provider.models.map((m) => ({ value: m.value, name: m.name })),
    { value: MANUAL_MODEL_VALUE, name: "手动输入 model_id（高级）" },
  ];
}

async function chooseModelByProvider(
  provider: InitProvider,
  _providerApiKey: string,
  preloadedModelIds?: string[]
): Promise<string> {
  if (provider.value === "openrouter") {
    const choices =
      preloadedModelIds && preloadedModelIds.length > 0
        ? buildOpenRouterChoices(preloadedModelIds)
        : buildStaticModelChoices(provider);
    const label =
      preloadedModelIds && preloadedModelIds.length > 0
        ? `选择 OpenRouter 模型（已过滤 ${preloadedModelIds.length} 个可用，国产高性价比优先）`
        : "选择 OpenRouter 模型（离线推荐）";
    const selected = await select({ message: label, choices, loop: false });
    if (selected !== MANUAL_MODEL_VALUE) {
      return selected;
    }
    const customModelId = await input({
      message: "输入 OpenRouter 的 model_id（例如 deepseek/deepseek-r1）",
      validate: (v) => v.trim().length > 0 || "不能为空",
    });
    return `openrouter:${customModelId.trim()}`;
  }

  if (provider.isCustom) {
    const modelId = await input({
      message: `输入 model_id（例如 gpt-4o、claude-3-5-sonnet-20241022）`,
      validate: (v) => v.trim().length > 0 || "不能为空",
    });
    return `${provider.value}:${modelId.trim()}`;
  }

  const selected = await select({
    message: "使用哪个模型？",
    choices: buildStaticModelChoices(provider),
    loop: false,
  });
  if (selected !== MANUAL_MODEL_VALUE) {
    return selected;
  }
  const customModelId = await input({
    message: `输入 ${provider.value} 的 model_id`,
    validate: (v) => v.trim().length > 0 || "不能为空",
  });
  return `${provider.value}:${customModelId.trim()}`;
}

function buildEnvContent(fields: {
  stupidModel: string;
  providerEnvKey: string;
  providerApiKey: string;
  customBaseUrl?: string;
  customBaseUrlKey?: string;
  telegramBotToken: string;
  stupidImToken: string;
  port: string;
}): string {
  const lines: string[] = [
    `# --- 核心模型配置 ---`,
    `STUPID_MODEL=${fields.stupidModel}`,
    ``,
    `# --- 供应商密钥 ---`,
  ];
  if (fields.providerEnvKey) {
    lines.push(`${fields.providerEnvKey}=${fields.providerApiKey}`);
  }
  if (fields.customBaseUrlKey && fields.customBaseUrl) {
    lines.push(`${fields.customBaseUrlKey}=${fields.customBaseUrl}`);
  }
  lines.push(
    ``,
    `# --- Telegram 配置 ---`,
    `TELEGRAM_BOT_TOKEN=${fields.telegramBotToken}`,
    `TELEGRAM_MODE=polling`,
    ``,
    `# --- 网页端 IM 配置 ---`,
    `STUPID_IM_TOKEN=${fields.stupidImToken}`,
    ``,
    `# --- 调试 / 服务端口 ---`,
    `PORT=${fields.port}`,
    `DEBUG_STUPIDCLAW=0`,
    `DEBUG_PROMPT=1`,
    ``
  );
  return lines.join("\n");
}

export async function runInit(destDir: string): Promise<void> {
  const dest = path.resolve(destDir, ".env");

  console.log();
  console.log(pc.bold(pc.cyan("  StupidClaw 初始化向导")));
  console.log(pc.dim("  按 Ctrl+C 随时退出\n"));

  if (fs.existsSync(dest)) {
    const overwrite = await confirm({
      message: pc.yellow(`.env 文件已存在，是否覆盖？`),
      default: false,
    });
    if (!overwrite) {
      console.log(pc.dim("\n跳过，保留已有配置。\n"));
      return;
    }
    console.log();
  }

  // 步骤 1：选择供应商
  console.log(pc.dim("步骤 1/5") + pc.bold("  选择 AI 模型供应商"));
  const providerValue = await select<ProviderValue>({
    message: "使用哪个供应商？",
    choices: PROVIDERS.map((p) => ({ value: p.value, name: p.name })),
    loop: false,
  });
  const provider = PROVIDERS.find((p) => p.value === providerValue)!;

  // 步骤 2：API Key（无 envKey 的 provider 如 Ollama 跳过此步）
  let providerApiKeyValue = "";
  if (provider.envKey) {
    console.log();
    console.log(pc.dim("步骤 2/5") + pc.bold(`  ${provider.envKey}`));
    console.log(pc.dim("  输入时不会显示，属于脱敏保护，请正常粘贴后回车\n"));
    const providerApiKey = await password({
      message: provider.envKey,
      validate: (v) => v.trim().length > 0 || "不能为空",
      mask: "*",
    });
    providerApiKeyValue = providerApiKey.trim();
  }

  // 步骤 2.5（仅 isCustom）：输入自定义 baseUrl
  let customBaseUrl = "";
  if (provider.isCustom) {
    console.log();
    const hint = provider.defaultBaseUrl
      ? `输入服务的 Base URL（默认：${provider.defaultBaseUrl}）`
      : "输入服务的 Base URL（如 https://your-proxy.com/v1）";
    console.log(pc.dim(`  ${hint}\n`));
    customBaseUrl = await input({
      message: "Base URL",
      default: provider.defaultBaseUrl ?? "",
      validate: (v) => (v.trim().startsWith("http") ? true : "请输入以 http 开头的完整 URL"),
    });
    customBaseUrl = customBaseUrl.trim().replace(/\/+$/, "");
  }

  // 步骤 3：选择模型
  console.log();
  console.log(pc.dim("步骤 3/5") + pc.bold("  选择模型"));
  const stupidModel = await chooseModelByProvider(provider, providerApiKeyValue);

  // 步骤 4：Telegram Bot Token（可选，留空则仅用 StupidIM）
  console.log();
  console.log(pc.dim("步骤 4/5") + pc.bold("  Telegram Bot Token"));
  console.log(pc.dim("  从 @BotFather 获取。直接回车留空则仅使用 StupidIM 网页端\n"));
  const telegramBotToken = await input({
    message: "TELEGRAM_BOT_TOKEN（可留空）",
    default: "",
  });

  // 步骤 5：其他配置
  console.log();
  console.log(pc.dim("步骤 5/5") + pc.bold("  其他配置") + pc.dim("（回车使用默认值）"));
  const defaultToken = crypto.randomBytes(16).toString("hex");
  const stupidImToken = await input({
    message: "STUPID_IM_TOKEN（网页端访问密钥）",
    default: defaultToken,
  });
  const port = await input({
    message: "PORT（服务端口）",
    default: "8080",
    validate: (v) => /^\d+$/.test(v) || "请输入数字",
  });

  const customBaseUrlKey = provider.isCustom
    ? (provider.baseUrlEnvKey ?? (provider.envKey
        ? `${provider.envKey.replace(/_API_KEY$/, "")}_BASE_URL`
        : undefined))
    : undefined;

  const content = buildEnvContent({
    stupidModel,
    providerEnvKey: provider.envKey,
    providerApiKey: providerApiKeyValue,
    customBaseUrl: customBaseUrl || undefined,
    customBaseUrlKey,
    telegramBotToken: telegramBotToken.trim(),
    stupidImToken: stupidImToken.trim(),
    port: port.trim(),
  });

  fs.writeFileSync(dest, content, "utf8");

  console.log();
  console.log(pc.green("  配置完成！") + "  " + pc.bold(dest));
  console.log();
  console.log(pc.dim("  下一步，启动："));
  console.log(`    ${pc.cyan(pc.bold("npx stupid-claw"))}`);
  if (!telegramBotToken.trim()) {
    console.log(pc.dim("\n  未配置 Telegram，将启动 StupidIM 网页端，浏览器访问即可对话。"));
  }
  console.log();
}
