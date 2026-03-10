# StupidClaw 详细设计文档 v3

## 1. 文档目标

这份文档只解决一件事：把 `StupidClaw` 收敛为可直接编码的最小可用架构，并确保后续迭代不失控。

核心约束：
- 只用文件系统，不引入数据库与向量库。
- 默认模型固定为 `MiniMax M2.5`。
- 交互入口固定为 `Telegram`，默认 `Long Polling`，`Webhook` 作为可选增强。
- Agent 内核复用 `badlogic/pi-mono`，不重复实现复杂会话状态机。
- 工具系统遵循 `pi-skills` 思路，支持渐进式披露。
- AI 可读写内容与源码彻底隔离（动静分离）。

---

## 2. 设计原则（硬约束）

- **数据优先**：先定义文件结构和不变量，再写业务代码。
- **KISS**：单进程、单用户、单工作区，先跑通闭环。
- **YAGNI**：不做“以后可能会用”的扩展点。
- **安全默认**：所有 AI 文件操作必须经过路径锁。
- **可追踪**：关键动作必须落日志与历史事件。

---

## 3. 系统边界

### 3.1 In Scope

- Telegram 消息接入、回复、编辑（流式输出可选）。
- Message as UI：默认不做 Web 管理界面。
- LLM Tool Calling。
- `history/YYYY-MM-DD.jsonl` 按日存储。
- `profile.md` 长期记忆注入与更新。
- `cron_jobs.json` 定时任务读写与执行。
- Cron 到点后触发 Skill 并主动推送消息。

### 3.2 Out of Scope

- 多用户隔离与账号系统。
- 分布式调度与高可用。
- 向量检索、RAG 索引、复杂知识库。
- 通用权限平台与 RBAC。

---

## 4. 动静分离目录结构

```text
stupid-claw/
├─ src/                            # 只读代码区（AI 绝对不可写）
│  ├─ index.ts
│  ├─ engine.ts                    # pi-mono 初始化 + MiniMax 适配
│  ├─ gateway.ts                   # Hono + Telegram webhook（可选模式）
│  ├─ transport/
│  │  ├─ polling.ts                # 默认模式：本机直连 Telegram
│  │  └─ webhook.ts                # 增强模式：公网回调
│  ├─ cron.ts                      # cron 调度入口
│  ├─ memory/
│  │  ├─ history-store.ts
│  │  ├─ profile-store.ts
│  │  └─ workspace-path.ts         # path jailing
│  └─ skills/
│     ├─ contracts.ts
│     ├─ registry.ts
│     ├─ system/get_system_time.ts
│     ├─ memory/query_history.ts
│     ├─ memory/update_profile.ts
│     └─ cron/manage_cron_jobs.ts
├─ .stupidClaw/                    # AI 可读写沙盒区（必须 git ignore）
│  ├─ profile.md
│  ├─ cron_jobs.json
│  └─ history/
│     └─ YYYY-MM-DD.jsonl
├─ .gitignore
├─ .env
└─ package.json
```

---

## 5. 核心数据结构与不变量

### 5.1 对话历史 `history/YYYY-MM-DD.jsonl`

每行一条 JSON 事件，严格单行，不做原地修改。

```json
{"ts":"2026-03-10T09:01:00.111Z","chatId":"123","role":"user","type":"message","text":"明早8点提醒我看AI新闻"}
{"ts":"2026-03-10T09:01:02.222Z","chatId":"123","role":"assistant","type":"tool_call","tool":"manage_cron_jobs","args":{"action":"add","cronExpr":"0 8 * * *"}}
{"ts":"2026-03-10T09:01:03.333Z","chatId":"123","role":"assistant","type":"message","text":"已为你添加任务"}
```

不变量：
- 文件名必须匹配 `YYYY-MM-DD.jsonl`。
- 必须包含字段：`ts/chatId/role/type`。
- 追加写入失败时，不能吞错。

### 5.2 用户画像 `profile.md`

约定模板：

```md
# User Profile

## Stable Preferences
- 饮食：不吃香菜

## Constraints
- 工作日 08:00 前仅接收摘要

## Recent Facts
- 2026-03-10：开始使用 StupidClaw
```

不变量：
- 顶层标题固定 `# User Profile`。
- 模型只允许“追加事实”或“覆盖指定段落”，禁止整文件重写。

### 5.3 定时任务 `cron_jobs.json`

```json
[
  {
    "id": "job_20260310_080000_01",
    "enabled": true,
    "chatId": "123",
    "cronExpr": "0 8 * * *",
    "timezone": "Asia/Shanghai",
    "skill": {
      "name": "web_search",
      "args": {"query": "今日AI新闻"}
    },
    "postProcessPrompt": "整理成3条早报，每条不超过40字",
    "createdAt": "2026-03-10T00:00:00.000Z",
    "updatedAt": "2026-03-10T00:00:00.000Z"
  }
]
```

不变量：
- `id` 全局唯一。
- `cronExpr` 新增/更新时必须校验。
- `skill.name` 必须在技能注册表存在。

---

## 6. 安全模型：Path Jailing

AI 相关读写只能落在 `.stupidClaw`，任何路径穿越直接拒绝。

```ts
const WORKSPACE_DIR = path.resolve(process.cwd(), ".stupidClaw");

export function resolveSafePath(targetPath: string): string {
  const resolved = path.resolve(WORKSPACE_DIR, targetPath);
  if (!resolved.startsWith(WORKSPACE_DIR)) {
    throw new Error("SecurityError: path outside .stupidClaw is forbidden");
  }
  return resolved;
}
```

规则：
- Skill 禁止直接接收绝对路径写文件。
- 读写统一走 `resolveSafePath()`。
- 默认拒绝 `../`、符号链接越界、空路径。

---

## 7. 模块设计

### 7.1 `engine.ts`

职责：
- 初始化 `pi-mono` 会话与模型驱动。
- 注入 `profile.md` + 近期 history 作为系统上下文。
- 执行 tool call 循环，最大回合数默认 3。

### 7.2 `transport/*` 与 `gateway.ts`

默认模式（推荐）：
- `polling.ts` 持续调用 `getUpdates` 拉取消息。
- 适用于本机开发与个人部署，零公网依赖。

增强模式（可选）：
- `webhook.ts` 通过公网 HTTPS 回调接收消息。
- 适用于云服务器和需要低延迟回调的场景。

`gateway.ts` 只在 webhook 模式启用，负责 HTTP 接入。

职责：
- 接收 Telegram Webhook（仅 webhook 模式）。
- 解析消息并调用 `engine.chat()`。
- 将最终结果发回 Telegram。

限制：
- 不做业务决策，不做复杂状态机。

### 7.3 `skills/registry.ts`

职责：
- 注册技能元数据（name/category/exposure/schema）。
- 支持两类曝光策略：
  - `always`：首轮即暴露（例如 `get_system_time`）。
  - `on_demand`：模型明确意图后再暴露。

### 7.4 `cron.ts`

职责：
- 每分钟扫描 `cron_jobs.json`。
- 命中后执行对应 Skill。
- 把 Skill 结果交给模型润色，再推送 Telegram。
- 将执行记录写回 history。

---

## 8. 关键流程

### 8.1 用户消息闭环

1. Telegram -> polling 或 webhook。
2. transport 层抽取统一事件 `chatId/text`。
3. 读取 `profile.md` + `history recent`。
4. 调用模型（仅暴露 `always` skills）。
5. 若模型请求工具：执行并回填，再次调用模型。
6. 产出回复并发送。
7. 用户消息、tool call、助手消息全部写入当日 jsonl。

### 8.2 定时任务闭环

1. Cron tick 扫描任务。
2. 触发任务 -> 调用指定 Skill。
3. Skill 结果 + `postProcessPrompt` -> 模型整理。
4. 主动发消息给 Telegram。
5. 记录 `cron_run` 事件到 history。

---

## 9. 配置与启动

最小环境变量：
- `MINIMAX_API_KEY`
- `MINIMAX_MODEL=MiniMax-M2.5`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_MODE=polling`（默认，可选 `webhook`）
- `TELEGRAM_WEBHOOK_SECRET`（建议）

初始化要求：
- 首次启动自动创建 `.stupidClaw/profile.md`。
- 首次启动自动创建 `.stupidClaw/cron_jobs.json`（空数组）。
- 首次写历史时自动创建 `.stupidClaw/history/`。

---

## 10. 错误处理策略

- 文件不存在：自动创建默认文件，不中断主流程。
- JSON 损坏：备份到 `*.broken.<timestamp>` 后重建空结构。
- Skill 参数非法：返回结构化错误，允许模型重试一次。
- LLM 超时：重试 1 次，失败后返回降级文本。
- Telegram 发送失败：记录错误，重试最多 2 次。

---

## 11. 测试最小集

- 单元测试：
  - `resolveSafePath()` 越界拦截。
  - history 按日追加与读取。
  - `cron_jobs.json` 校验与增删改。
- 集成测试：
  - Polling -> Tool Call -> Reply 全链路（默认）。
  - Webhook -> Tool Call -> Reply 全链路（可选）。
  - Cron -> Skill -> 主动推送全链路。

---

## 12. 里程碑

- M1：对话闭环 + history 日志。
- M2：技能注册 + 渐进式披露。
- M3：`profile.md` 记忆注入与更新。
- M4：Cron 调度 + 主动推送。
- M5：Path Jailing 与回归测试完善。

这就是可落地版本，不耍花活，先把主干跑通。

---

## 13. 分期落地结构与关键代码（开发计划锚点）

### 13.1 第 0 期（发刊词）
- 结构：`README.md` 或首篇文章稿。
- 关键代码：无，实现边界定义与目录草图。

### 13.2 第 1 期（Polling）
- 结构：`src/index.ts`、`src/engine.ts`、`src/transport/polling.ts`。
- 关键代码：
  - `getUpdates(offset)` + `offset = updateId + 1`
  - `engine.chat({ chatId, text })`
  - `sendMessage(chatId, replyText)`

### 13.3 第 2 期（Webhook）
- 结构：`src/gateway.ts`、`src/transport/webhook.ts`、`src/transport/index.ts`。
- 关键代码：
  - `TELEGRAM_MODE` 路由
  - webhook payload -> 统一消息结构映射

### 13.4 第 3 期（Skills + History）
- 结构：`src/skills/contracts.ts`、`src/skills/registry.ts`、`src/memory/history-store.ts`。
- 关键代码：
  - `always/on_demand` 暴露策略
  - jsonl 追加写入（append-only）

### 13.5 第 4 期（Profile）
- 结构：`src/memory/profile-store.ts`、`src/skills/memory/update_profile.ts`。
- 关键代码：
  - 对话前注入 profile
  - 按段落更新而非整文件覆盖

### 13.6 第 5 期（Path Jailing）
- 结构：`src/memory/workspace-path.ts` + 文件类 skills 全接入。
- 关键代码：
  - `resolveSafePath()`
  - 越界拒绝与错误结构化返回

### 13.7 第 6 期（Cron）
- 结构：`src/cron.ts`、`.stupidClaw/cron_jobs.json`、`src/skills/cron/manage_cron_jobs.ts`。
- 关键代码：
  - cron 匹配执行
  - 主动推送 Telegram
  - `cron_run` 历史落盘

### 13.8 第 7 期（发布）
- 结构：`README.md`、`.env.example`、`public/troubleshooting.md`。
- 关键代码：
  - 启动命令与配置校验
  - 可选 `bun build --compile` 单文件构建
