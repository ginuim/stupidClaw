# StupidClaw — AI 使用手册

本文件供 AI 编程助手（Cursor、Claude Code、Copilot 等）阅读，涵盖项目使用方式与开发约定。

---

## 项目简介

StupidClaw 是一个极简本地 Agent，基于 `@mariozechner/pi-coding-agent`（pi-mono）底座构建，通过 Telegram Bot 或内置网页端 IM（StupidIM）与用户交互。AI 只能读写 `.stupidClaw/` 沙盒目录，以纯文本文件管理记忆，无数据库依赖。

---

## 安装与启动

### 方式 A：npx（推荐，无需 clone）

```bash
# 1. 在任意目录运行初始化向导
npx stupid-claw init

# 2. 向导完成后，直接启动
npx stupid-claw
```

`init` 向导会交互式地引导用户选择 AI 供应商、输入 API Key、选择模型，并自动生成 `.env` 文件。

### 方式 B：源码安装（开发者）

```bash
git clone <repo-url>
cd stupidClaw
pnpm install

# 初始化配置
cp .env.example .env
# 编辑 .env，填写 STUPID_MODEL 和对应 API Key

# 开发模式启动
pnpm dev
```

---

## .env 配置说明

最简配置只需两项：

```dotenv
STUPID_MODEL=provider:model_id   # 选择模型，如 deepseek:deepseek-chat
DEEPSEEK_API_KEY=sk-xxxx         # 对应供应商的 API Key
```

### 支持的供应商

| provider | 说明 | 需要的环境变量 |
| :--- | :--- | :--- |
| `deepseek` | DeepSeek 官方（国内直连） | `DEEPSEEK_API_KEY` |
| `kimi` | Kimi / Moonshot AI（国内直连） | `MOONSHOT_API_KEY` |
| `dashscope` | 阿里云 DashScope / Qwen（国内直连） | `DASHSCOPE_API_KEY` |
| `bigmodel` | 智谱 bigmodel.cn / GLM（国内直连） | `ZHIPU_API_KEY` |
| `minimax-cn` | MiniMax 国内站（国内直连） | `MINIMAX_CN_API_KEY` |
| `openai` | OpenAI | `OPENAI_API_KEY` |
| `anthropic` | Anthropic Claude | `ANTHROPIC_API_KEY` |
| `google` | Google Gemini | `GEMINI_API_KEY` |
| `groq` | Groq（免费额度，速度快） | `GROQ_API_KEY` |
| `openrouter` | OpenRouter（聚合平台） | `OPENROUTER_API_KEY` |
| `xai` | xAI Grok | `XAI_API_KEY` |
| `custom-openai` | 任意 OpenAI 兼容接口 | `CUSTOM_OPENAI_API_KEY` + `CUSTOM_OPENAI_BASE_URL` |
| `custom-anthropic` | 任意 Anthropic 兼容接口 | `CUSTOM_ANTHROPIC_API_KEY` + `CUSTOM_ANTHROPIC_BASE_URL` |

### 常用模型示例

```dotenv
# DeepSeek（V3 / R1）
STUPID_MODEL=deepseek:deepseek-chat
DEEPSEEK_API_KEY=sk-xxxx

# Kimi K2 / moonshot
STUPID_MODEL=kimi:kimi-k2-0711-preview
MOONSHOT_API_KEY=sk-xxxx

# Qwen Max（阿里云）
STUPID_MODEL=dashscope:qwen-max
DASHSCOPE_API_KEY=sk-xxxx

# GLM-4-Flash（智谱，免费）
STUPID_MODEL=bigmodel:glm-4-flash
ZHIPU_API_KEY=xxxx

# OpenAI GPT-4o
STUPID_MODEL=openai:gpt-4o
OPENAI_API_KEY=sk-xxxx

# OpenRouter（聚合，一个 Key 用多模型）
STUPID_MODEL=openrouter:deepseek/deepseek-r1
OPENROUTER_API_KEY=sk-or-xxxx
```

### 本地模型（Ollama / LM Studio / vLLM）

本地模型需要先在 `~/.pi/agent/models.json` 中注册，再填 `STUPID_MODEL`：

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

```dotenv
STUPID_MODEL=ollama:qwen2.5-coder:7b
```

### 完整 .env 字段说明

```dotenv
# 模型选择（必填）
STUPID_MODEL=provider:model_id

# Telegram（不填则只能用 StupidIM 网页端）
TELEGRAM_BOT_TOKEN=
TELEGRAM_MODE=polling

# StupidIM 网页端访问密钥
STUPID_IM_TOKEN=your_secret_token

# 服务端口（默认 8080）
PORT=8080

# 调试开关
DEBUG_STUPIDCLAW=0   # 设为 1 开启引擎详细日志
DEBUG_PROMPT=1       # 设为 1 打印完整 prompt
```

---

## 目录结构

```
stupidClaw/
├── src/
│   ├── index.ts          # 入口：启动传输层
│   ├── engine.ts         # 核心：会话管理、模型调用、provider 注册
│   ├── init.ts           # npx init 交互式向导
│   ├── init-providers.ts # init 向导的供应商 + 模型列表
│   ├── transport/        # polling.ts / webhook.ts / stupid-im.ts
│   ├── memory/           # history-store / profile-store / workspace-path
│   ├── skills/           # 内置技能（cron、profile、history 等）
│   └── prompt/           # identity.ts 身份提示词
├── .stupidClaw/          # AI 沙盒（运行时自动创建，gitignore）
│   ├── profile.md        # 长期记忆
│   ├── cron_jobs.json    # 定时任务
│   └── history/          # 对话历史 YYYY-MM-DD.jsonl
├── public/               # 文档（models.md / getting-started.md 等）
├── .env.example
└── DEV_TODO.md
```

---

## 关键代码位置

- **新增 provider 支持**：`src/init-providers.ts`（向导列表）+ `src/engine.ts` 的 `createModelRegistry()`（运行时注册）
- **模型选择逻辑**：`src/engine.ts` 的 `pickModel()`
- **技能注册**：`src/skills/registry.ts`
- **沙盒路径控制**：`src/memory/workspace-path.ts`

---

## 开发约定（AI 协作规范）

> 以下约定仅在参与本项目**代码开发**时适用。

### 1. 分支策略

每开始新一期开发工作前，必须新建对应的 git 分支。

- 分支命名：`phase-N` 或 `phase-N-简短描述`（如 `phase-1-polling`）
- 第 0 期对应 `phase-0`，第 1 期对应 `phase-1`，依此类推

### 2. 教程与代码同步

每一期代码开发完毕后，必须同步更新教程文章。

- 代码先行，文章跟随
- 教程内容需与当前实现一致，避免读者按文档操作时跑不通

### 3. 开发 Todo 维护

项目内必须维护 `DEV_TODO.md` 开发待办文件。

- 每期开发前：在 todo 中列出本期任务
- 每期开发中：代码改动后立即更新 todo 状态
- 任务完成后：勾选对应项

**任何代码修改或开发工作后都必须更新 DEV_TODO.md**，不得遗漏。

### 参考

- 教程期数规划：`StupidClaw-教程期数规划-v3.md`
- 开发待办：`DEV_TODO.md`
