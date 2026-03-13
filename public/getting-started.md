# StupidClaw 快速上手指南

欢迎使用 StupidClaw！基于 pi-mono 底座的极简本地 Agent，严格限制在指定目录，以纯文本格式读写记忆。没有数据库的黑魔法，只有你能完全掌控的代码。

本文将手把手带你完成从获取必要凭证到成功启动机器人的全过程。

---

## 步骤一：获取必要凭证

StupidClaw 默认依赖两个外部服务：**Telegram**（作为主要交互界面）和 **MiniMax**（作为大语言模型驱动核心）。

### 1. 获取 Telegram Bot Token
> **提示**：如果你无法访问 Telegram，也可以跳过此步骤，直接使用项目内置的 [网页版简易 IM（StupidIM）](#网页端简易-imstupidim使用说明)。

1. 打开 Telegram，搜索并添加官方机器人 [BotFather](https://t.me/botfather)。
2. 在对话框中输入 `/newbot` 创建一个新的机器人。
3. 按照提示，给你的机器人起一个**名字（Name）**（任意，可重复）和一个**用户名（Username）**（必须以 `bot` 结尾，不可重复，如 `MyStupidClaw_bot`）。
4. 创建成功后，BotFather 会回复你一段包含 `Token` 的消息（类似 `123456789:ABCdefGHIjklmNOPqrsTUVwxyz`）。请妥善保存这串字符，这就是你的 `TELEGRAM_BOT_TOKEN`。

### 2. 获取大语言模型 API Key

StupidClaw 支持多种模型供应商，你只需要至少配置一个即可启动：

- **DeepSeek**: 国内直连，性价比极高。在 [DeepSeek 开放平台](https://platform.deepseek.com/) 获取 `DEEPSEEK_API_KEY`。
- **Kimi（Moonshot AI）**: 国内直连，长上下文出色。在 [Moonshot 开放平台](https://platform.moonshot.cn/) 获取 `MOONSHOT_API_KEY`。
- **阿里云 DashScope（Qwen）**: 国内直连，Qwen 系列。在 [阿里云百炼](https://bailian.console.aliyun.com/) 获取 `DASHSCOPE_API_KEY`。
- **智谱 bigmodel.cn（GLM）**: 国内直连，GLM 系列，有免费额度。在 [智谱开放平台](https://open.bigmodel.cn/) 获取 `ZHIPU_API_KEY`。
- **MiniMax**: 对中文支持极佳。在 [MiniMax 开放平台](https://platform.minimaxi.com/) 获取 `MINIMAX_CN_API_KEY`。
- **OpenAI**: 在 [OpenAI Platform](https://platform.openai.com/) 获取 `OPENAI_API_KEY`。
- **Anthropic**: 在 [Anthropic Console](https://console.anthropic.com/) 获取 `ANTHROPIC_API_KEY`。
- **Groq**: 速度极快，有免费额度。在 [Groq Console](https://console.groq.com/) 获取 `GROQ_API_KEY`。
- **OpenRouter**: 一个 Key 接入几乎所有模型。在 [OpenRouter](https://openrouter.ai/) 获取 `OPENROUTER_API_KEY`。
- **本地模型**: 支持 Ollama、LM Studio、vLLM 等本地部署，需要额外配置。

完整的供应商列表和本地模型配置方法，见 [模型配置指南](models.md)。

---

## 步骤二：项目初始化与配置

### 方式 A：极致极简 (npx 运行)

如果你不想手动下载代码，只要你有 Node.js (v20+)，可以在任何目录下直接运行：

```bash
# 1. 直接启动（首次运行会提示缺少配置）
npx stupid-claw

# 2. 如果当前目录下没有 .env，程序会生成提示。
# 你也可以手动创建一个 .env 文件，填入必要凭证。

# 3. 指定配置文件运行
npx stupid-claw --config ~/my-stupid-config.env
```

### 方式 B：源码运行 (开发者推荐)

#### 1. 下载代码与安装依赖
确保你本地已经安装了 Node.js（推荐 v20+）和 `pnpm`。

```bash
git clone <项目地址>
cd stupidClaw
pnpm install
```

### 2. 配置环境变量
项目根目录下有一个 `.env.example` 文件，我们需要根据它创建一份真实的配置文件：

```bash
cp .env.example .env
```

打开 `.env` 文件，至少填写两项：一是 `STUPID_MODEL`（选择模型），二是对应供应商的 API Key。

**格式：`STUPID_MODEL=provider:model_id`**

```dotenv
# 默认配置（使用 MiniMax）
STUPID_MODEL=minimax:MiniMax-M2.5
MINIMAX_API_KEY=在这里填入你的 API Key

# 或者换成 OpenAI
# STUPID_MODEL=openai:gpt-4o
# OPENAI_API_KEY=sk-xxxx

# 或者换成 Groq（免费额度）
# STUPID_MODEL=groq:llama-3.3-70b-versatile
# GROQ_API_KEY=gsk_xxxx
```

更多配置选项（含所有 provider 列表、DeepSeek 接入方法、本地模型配置），见 [模型配置指南](models.md)。

---

## 步骤三：启动 StupidClaw

一切准备就绪后，只需在终端中运行：

```bash
pnpm dev
```

看到控制台输出如下内容时，说明机器人已经启动成功了：
```text
[boot] StupidIM started on port 8080
[boot] StupidClaw Telegram polling started
```

此时，如果你配置了 Telegram，你可以直接在 Telegram 里搜索你创建的那个机器人的 Username，点击“Start”，跟它打个招呼，它就会回复你了！

---

## 网页端简易 IM（StupidIM）使用说明

如果你没有梯子无法访问 Telegram，没关系！StupidClaw 内置了一个极简的网页版客户端。

在项目正常启动（`pnpm dev` 保持运行）的情况下，终端日志会打印出一段链接：

```text
[boot] StupidIM HTTP Server started on port 8080

==================================================
🟢 StupidIM 网页端已启动！请按住 Command/Ctrl 点击下方链接：
http://localhost:8080/?token=my_super_secret_token&chatId=my_test_chat_id&url=ws%3A%2F%2Flocalhost%3A8080
==================================================
```

你只需要：
1. **按住键盘的 `Command` (macOS) 或 `Ctrl` (Windows)**。
2. **用鼠标点击终端中这段蓝色的链接**，或者手动复制粘贴到浏览器打开。
3. 网页打开后会自动填充好各项配置，直接点击界面上的 **“连接”** 按钮。
4. 连接成功后右上角会显示绿色状态，现在你就可以像使用微信一样，在网页端直接和 StupidClaw 对话了！

---

## 打包成独立可执行文件 (可选)

如果你想把这个项目部署到服务器上，或者发给没有安装 Node.js 的朋友运行，你可以利用 Bun 将其打包成一个单文件的二进制程序。

1. 确保已在项目中运行过 `pnpm install` 安装相关依赖。
2. 运行打包命令：
   ```bash
   pnpm run build:exe
   ```
3. 打包完成后，在 `dist` 目录下会生成一个名为 `stupidclaw` 的可执行文件（大小约 60MB+）。
4. 你只需要把这个 `stupidclaw` 文件和你的 `.env` 文件放在**同一个目录**下，直接运行它即可，**无需任何其他依赖**！

```bash
./stupidclaw
```