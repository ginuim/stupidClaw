# StupidClaw

大智若愚的本地 Agent：  
`pi-mono` + `MiniMax M2.5` + Telegram + 纯文件系统记忆。

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

## 5 分钟启动（第 1 期基线）

1. 安装依赖

```bash
pnpm install
```

2. 配置环境变量

```bash
cp .env.example .env
```

至少填写：
- `TELEGRAM_BOT_TOKEN`
- `MINIMAX_API_KEY`（不填会走本地回显 fallback）

3. 启动

```bash
pnpm dev
```

## 开发计划（7 期执行版）

### 第 0 期：发刊词与边界
- 项目结构：`README.md`、目录草图、边界说明。
- 关键代码：无（只定义边界）。

### 第 1 期：Polling 最小闭环
- 项目结构：`src/index.ts`、`src/engine.ts`、`src/transport/polling.ts`。
- 关键代码：
  - `getUpdates(offset)` 持续拉取
  - `offset = updateId + 1` 去重
  - `engine.chat(...) -> sendMessage(...)` 回复链路

### 第 2 期：Webhook 增强
- 项目结构：`src/gateway.ts`、`src/transport/webhook.ts`、`src/transport/index.ts`。
- 关键代码：
  - `TELEGRAM_MODE` 模式分发
  - Webhook 与 Polling 统一消息结构

### 第 3 期：Skills + History
- 项目结构：`src/skills/contracts.ts`、`src/skills/registry.ts`、`src/memory/history-store.ts`。
- 关键代码：
  - `always` / `on_demand` 渐进式披露
  - `history/YYYY-MM-DD.jsonl` append-only 写入

### 第 4 期：Profile 长期记忆
- 项目结构：`src/memory/profile-store.ts`、`src/skills/memory/update_profile.ts`。
- 关键代码：
  - 会话前注入 `profile.md`
  - 按段落更新，不整文件重写

### 第 5 期：Path Jailing
- 项目结构：`src/memory/workspace-path.ts` + 所有文件类 skills。
- 关键代码：
  - `resolveSafePath(targetPath)` 限定 `.stupidClaw/`
  - 拒绝 `../`、绝对路径、空路径

### 第 6 期：Cron 主动触发
- 项目结构：`src/cron.ts`、`.stupidClaw/cron_jobs.json`、`src/skills/cron/manage_cron_jobs.ts`。
- 关键代码：
  - cron 匹配与调度
  - 触发 skill 后主动 Telegram 推送
  - 执行日志落到 history

### 第 7 期：发布收口
- 项目结构：`README.md`、`.env.example`、`docs/troubleshooting.md`。
- 关键代码：
  - 最小启动脚本与故障排查
  - 可选 `bun build --compile` 独立可执行构建

## 约定

- 每期开始前先新建分支：`phase-N` 或 `phase-N-描述`。
- 每期代码完成后必须同步更新教程文章。
- 每次改代码后都维护 `DEV_TODO.md`。
