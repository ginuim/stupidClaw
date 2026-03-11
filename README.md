# StupidClaw

回归纯粹的极简本地 Agent：  
基于 `pi-mono` 底座。业余时间开发，主要用于简单代码学习交流使用，欢迎反馈。  
严格限制在指定目录，以纯文本格式读写记忆。没有数据库的黑魔法，只有你能完全掌控的代码。

## 官方网站：[stupidClaw](https://stupidclaw.reaidea.com)

## 相关文档

- [快速上手指南](docs/getting-started.md)
- [模型配置指南](docs/models.md)
- [常见故障排查](docs/troubleshooting.md)

## 项目边界

- 只用文件系统，不引入数据库和向量库。
- 默认 Message as UI：Telegram。
- 默认传输模式：Long Polling；Webhook 是可选增强。
- AI 只能读写 `.stupidClaw/`，不能碰 `src/`。

## 目录结构（当前与目标）

```text
stupidClaw/
├─ src/
│  ├─ index.ts
│  ├─ engine.ts
│  ├─ transport/
│  │  ├─ polling.ts
│  │  └─ webhook.ts              # 第 2 期
│  ├─ gateway.ts                 # 第 2 期
│  ├─ cron.ts                    # 第 6 期
│  ├─ memory/
│  │  ├─ history-store.ts        # 第 3 期
│  │  ├─ profile-store.ts        # 第 4 期
│  │  └─ workspace-path.ts       # 第 5 期
│  └─ skills/
│     ├─ contracts.ts            # 第 3 期
│     ├─ registry.ts             # 第 3 期
│     ├─ system/get_system_time.ts
│     ├─ system/list_available_skills.ts
│     ├─ memory/query_history.ts
│     ├─ memory/update_profile.ts
│     └─ cron/manage_cron_jobs.ts
├─ .stupidClaw/                  # AI 沙盒区（运行时自动创建）
│  ├─ profile.md
│  ├─ cron_jobs.json
│  └─ history/YYYY-MM-DD.jsonl
├─ .env.example
└─ DEV_TODO.md
```

## 5 分钟启动

详见完整的 [快速上手指南](docs/getting-started.md) 获取详细的步骤（包括如何申请 Telegram Bot Token 和 API Key 等，以及如何使用内置网页端 IM）。

### 方式 A：最快启动 (npx)

如果你本地已有 Node.js 环境，无需下载源码，直接在任何目录下运行：

```bash
npx stupid-claw
```

首次运行会在当前目录下生成 `.env` 提示，配置完成后再次运行即可。

### 方式 B：源码运行

1. 安装依赖

```bash
pnpm install
```

2. 配置环境变量

```bash
cp .env.example .env
```

至少填写：
- `STUPID_MODEL` (模型选择，如 `minimax:MiniMax-M2.5` 或 `openai:gpt-4o`)
- 对应供应商的 API Key (如 `MINIMAX_API_KEY` 或 `OPENAI_API_KEY`)
- `TELEGRAM_BOT_TOKEN` (如果你使用网页端 IM，可以随便填)

3. 启动

```bash
pnpm dev
```

如果你想使用内置的免梯子网页端 IM，启动后直接点击终端中输出的绿色链接即可！

