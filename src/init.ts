import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { confirm, input, password, select } from "@inquirer/prompts";
import pc from "picocolors";
import { PROVIDERS, type ProviderValue } from "./init-providers.js";

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

  // 步骤 1：选择供应商
  console.log(pc.dim("步骤 1/5") + pc.bold("  选择 AI 模型供应商"));
  const providerValue = await select<ProviderValue>({
    message: "使用哪个供应商？",
    choices: PROVIDERS.map((p) => ({ value: p.value, name: p.name })),
    loop: false,
  });
  const provider = PROVIDERS.find((p) => p.value === providerValue)!;

  // 步骤 2：选择模型
  console.log();
  console.log(pc.dim("步骤 2/5") + pc.bold("  选择模型"));
  const stupidModel = await select({
    message: "使用哪个模型？",
    choices: provider.models.map((m) => ({ value: m.value, name: m.name })),
    loop: false,
  });

  // 步骤 3：API Key（脱敏输入，需告知用户）
  console.log();
  console.log(pc.dim("步骤 3/5") + pc.bold(`  ${provider.envKey}`));
  console.log(pc.dim("  输入时不会显示，属于脱敏保护，请正常粘贴后回车\n"));
  const providerApiKey = await password({
    message: provider.envKey,
    validate: (v) => v.trim().length > 0 || "不能为空",
    mask: "*",
  });

  // 步骤 4：Telegram Bot Token（可选，留空则仅用 StupidIM）
  console.log();
  console.log(pc.dim("步骤 4/5") + pc.bold("  Telegram Bot Token"));
  console.log(pc.dim("  从 @BotFather 获取。直接回车留空则仅使用 StupidIM 网页端\n"));
  const telegramBotToken = await input({
    message: "TELEGRAM_BOT_TOKEN（可选）",
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

  const content = buildEnvContent({
    stupidModel,
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
  console.log(pc.dim("  下一步，启动："));
  console.log(`    ${pc.cyan(pc.bold("npx stupid-claw"))}`);
  if (!telegramBotToken.trim()) {
    console.log(pc.dim("\n  未配置 Telegram，将启动 StupidIM 网页端，浏览器访问即可对话。"));
  }
  console.log();
}
