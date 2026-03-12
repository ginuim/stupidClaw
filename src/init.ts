import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { confirm, input, password, select } from "@inquirer/prompts";
import pc from "picocolors";

// 所有知识集中在这张表里：供应商 id、对应的环境变量名、默认模型
const PROVIDERS = [
  {
    value: "minimax-cn",
    name: "MiniMax 国内版 (minimaxi.com，推荐国内用户)",
    envKey: "MINIMAX_CN_API_KEY",
    defaultModel: "minimax-cn:MiniMax-M2.5",
  },
  {
    value: "minimax",
    name: "MiniMax 国际版",
    envKey: "MINIMAX_API_KEY",
    defaultModel: "minimax:MiniMax-M2.5",
  },
  {
    value: "openai",
    name: "OpenAI",
    envKey: "OPENAI_API_KEY",
    defaultModel: "openai:gpt-4o-mini",
  },
  {
    value: "anthropic",
    name: "Anthropic Claude",
    envKey: "ANTHROPIC_API_KEY",
    defaultModel: "anthropic:claude-3-5-haiku-20241022",
  },
  {
    value: "google",
    name: "Google Gemini",
    envKey: "GEMINI_API_KEY",
    defaultModel: "google:gemini-2.0-flash",
  },
  {
    value: "groq",
    name: "Groq (免费额度，速度快)",
    envKey: "GROQ_API_KEY",
    defaultModel: "groq:llama-3.3-70b-versatile",
  },
  {
    value: "openrouter",
    name: "OpenRouter (可聚合 DeepSeek 等)",
    envKey: "OPENROUTER_API_KEY",
    defaultModel: "openrouter:deepseek/deepseek-chat",
  },
  {
    value: "xai",
    name: "xAI Grok",
    envKey: "XAI_API_KEY",
    defaultModel: "xai:grok-2-latest",
  },
] as const;

type ProviderValue = (typeof PROVIDERS)[number]["value"];

function buildEnvContent(fields: {
  stupidModel: string;
  providerEnvKey: string;
  providerApiKey: string;
  telegramBotToken: string;
  stupidImToken: string;
  port: string;
}): string {
  return [
    `# --- 核心模型配置 ---`,
    `STUPID_MODEL=${fields.stupidModel}`,
    ``,
    `# --- 供应商密钥 ---`,
    `${fields.providerEnvKey}=${fields.providerApiKey}`,
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
    ``,
  ].join("\n");
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

  // 步骤 1：Telegram Bot Token
  console.log(pc.dim("步骤 1/4") + pc.bold("  Telegram Bot Token"));
  console.log(pc.dim("  从 @BotFather 获取，格式如：123456789:ABCdefGhi...\n"));
  const telegramBotToken = await input({
    message: "TELEGRAM_BOT_TOKEN",
    validate: (v) => v.trim().length > 0 || "不能为空",
  });

  // 步骤 2：选择供应商
  console.log();
  console.log(pc.dim("步骤 2/4") + pc.bold("  选择 AI 模型供应商"));
  const providerValue = await select<ProviderValue>({
    message: "使用哪个供应商？",
    choices: PROVIDERS.map((p) => ({ value: p.value, name: p.name })),
  });
  const provider = PROVIDERS.find((p) => p.value === providerValue)!;

  // 步骤 3：API Key（隐藏输入）
  console.log();
  console.log(pc.dim("步骤 3/4") + pc.bold(`  ${provider.envKey}`));
  const providerApiKey = await password({
    message: provider.envKey,
    validate: (v) => v.trim().length > 0 || "不能为空",
    mask: "*",
  });

  // 步骤 4：其他配置（有默认值）
  console.log();
  console.log(pc.dim("步骤 4/4") + pc.bold("  其他配置") + pc.dim("（回车使用默认值）"));
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

  // 写入文件
  const content = buildEnvContent({
    stupidModel: provider.defaultModel,
    providerEnvKey: provider.envKey,
    providerApiKey: providerApiKey.trim(),
    telegramBotToken: telegramBotToken.trim(),
    stupidImToken: stupidImToken.trim(),
    port: port.trim(),
  });

  fs.writeFileSync(dest, content, "utf8");

  console.log();
  console.log(pc.green("  配置完成！") + "  " + pc.bold(dest));
  console.log();
  console.log(pc.dim("  下一步，启动机器人："));
  console.log(`    ${pc.cyan(pc.bold("npx stupid-claw"))}`);
  console.log();
}
