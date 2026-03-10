# StupidClaw 教程期数规划 v3

## 定位

这套教程目标不是“功能堆满”，而是带读者用最小复杂度做出一个能长期运行的本地 Agent。  
总计 **7 期**，每期都有清晰产出、代码边界和验收标准。

核心叙事：
- 大智若愚：坚持 KISS，不做“看起来高级”的过度工程。
- File-System Only：记忆与任务都落在文本文件，不引入数据库。
- 站在 `badlogic/pi-mono` 肩膀上：复用成熟循环，不重复造轮子。
- Message as UI：用 Telegram 作为唯一交互面，先活下来再谈界面。

---

## 第 0 期（发刊词）：为什么是 StupidClaw

目标：
- 统一价值观：KISS、File-System Only、动静分离。
- 解释为什么选 `pi-mono` + `MiniMax M2.5`。

产出：
- 发刊词文章（理念 + 总体架构图）。
- 项目空仓脚手架与目录草图。

验收：
- 读者能在 5 分钟理解项目边界：不做数据库、不做复杂 UI、不做花哨中间层。

---

## 第 1 期：本机优先，跑通 Polling 最小闭环

目标：
- 用 `Telegram Long Polling + MiniMax` 在本机跑通一次真实消息往返。
- 不依赖公网地址、不依赖 HTTPS 证书，先把成功率拉满。

产出：
- `src/transport/polling.ts`
- `src/engine.ts`
- `src/index.ts`

验收：
- 用户发消息，Bot 能回复。
- 本机断开再重连后，Polling 能恢复拉取。
- 整条链路日志可追踪。

---

## 第 2 期：从 Polling 升级到 Webhook（可选增强）

目标：
- 在不改业务逻辑的前提下，从 Polling 升级到 Webhook。
- 抽象最小 `transport` 接口，支持 `polling/webhook` 两种模式切换。

产出：
- `src/gateway.ts`（Webhook 入口）
- `src/transport/index.ts`（模式选择：`polling | webhook`）
- `.env` 新增 `TELEGRAM_MODE`

验收：
- `TELEGRAM_MODE=polling` 本机可直接运行。
- `TELEGRAM_MODE=webhook` 在公网环境可正常回调。
- 两种模式回复一致，业务层不感知传输方式。

---

## 第 3 期：技能系统与渐进式披露

目标：
- 建立最小 Skill 合同。
- 实现 `always` 与 `on_demand` 两级披露。
- 建立 `.stupidClaw/history/YYYY-MM-DD.jsonl`，给 `query_history` 提供数据来源。

产出：
- `src/memory/history-store.ts`
- `src/skills/contracts.ts`
- `src/skills/registry.ts`
- `get_system_time`、`list_available_skills`、`query_history`

验收：
- 首轮只暴露常驻技能。
- 模型可先查技能目录再按需调用。
- 重启进程后历史仍在，且可按日期回溯当天对话。

---

## 第 4 期：长期记忆 `profile.md`

目标：
- 引入 `profile.md` 作为可读写长期记忆。
- 对话前注入，关键事实可更新。

产出：
- `src/memory/profile-store.ts`
- `update_profile` Skill

验收：
- 用户说“我不吃香菜”，下轮能记住。
- 重启后依然记住。

---

## 第 5 期：安全沙盒（Path Jailing）

目标：
- 完成 AI 文件访问隔离，防止误写 `src/`。

产出：
- `src/memory/workspace-path.ts`
- 所有文件类 Skill 接入安全路径解析。

验收：
- 访问 `../src/index.ts` 被拒绝。
- 合法路径读写正常。

---

## 第 6 期：Cron 主动触发能力

目标：
- 让 Agent 从被动回复进化为主动执行任务。

产出：
- `.stupidClaw/cron_jobs.json`
- `src/cron.ts`
- `manage_cron_jobs` Skill

验收：
- 设定“每天 8 点早报”可触发。
- 触发结果写入 history，且 Telegram 收到主动消息。

---

## 第 7 期：发布与工程收口

目标：
- 补齐可运行、可复现、可部署文档。

产出：
- `README.md`（5 分钟启动）
- `.env.example`
- 常见故障排查（Webhook、Cron、API Key）

验收：
- 新读者从 clone 到跑通不超过 15 分钟。

---

## 每期统一模板（写作规范）

- 先讲一个真实痛点（为什么要做）。
- 再给最小数据结构（别先讲代码）。
- 最后给一条完整链路代码（可复制运行）。
- 收尾放“本期验收清单”。

这套模板能显著减少读者掉队率，也能防止你写成概念堆砌文。

---

## 开发计划：每一期项目结构与关键代码

### 第 0 期（发刊词）

项目结构：
- `README.md`（发刊词版）
- `public/architecture.md`（可选，放架构图与边界）

关键代码：
- 无代码实现，重点是边界定义与目录草图。

### 第 1 期（Polling 最小闭环）

项目结构：
- `src/index.ts`（启动与主循环）
- `src/transport/polling.ts`（Telegram `getUpdates/sendMessage`）
- `src/engine.ts`（`pi-mono` + MiniMax 调用入口）

关键代码：
- `while(true) + getUpdates(offset)` 拉取循环。
- `offset = updateId + 1` 防重复消费。
- `engine.chat({ chatId, text }) -> sendMessage(chatId, replyText)` 主链路。

### 第 2 期（Webhook 增强）

项目结构：
- `src/gateway.ts`（Webhook 接入）
- `src/transport/webhook.ts`（Webhook 解析）
- `src/transport/index.ts`（`polling | webhook` 路由）

关键代码：
- `TELEGRAM_MODE` 模式分发。
- Webhook 入站统一映射为 `{ chatId, text }`。
- 保证业务层只依赖统一消息结构，不感知传输模式。

### 第 3 期（技能系统与历史）

项目结构：
- `src/skills/contracts.ts`
- `src/skills/registry.ts`
- `src/memory/history-store.ts`
- `src/skills/system/get_system_time.ts`
- `src/skills/system/list_available_skills.ts`
- `src/skills/memory/query_history.ts`

关键代码：
- Skill 合同：`name/description/schema/execute`。
- 暴露策略：`always` 与 `on_demand`。
- `history/YYYY-MM-DD.jsonl` 只追加不改写。

### 第 4 期（profile 长期记忆）

项目结构：
- `src/memory/profile-store.ts`
- `src/skills/memory/update_profile.ts`

关键代码：
- 会话前注入 `profile.md`。
- `update_profile` 仅允许更新指定段落，禁止整文件覆盖。
- 事实写入后可跨重启保留。

### 第 5 期（Path Jailing）

项目结构：
- `src/memory/workspace-path.ts`
- 所有文件类 Skill 统一接入路径解析

关键代码：
- `resolveSafePath(targetPath)` 路径归一化与越界拒绝。
- 禁止绝对路径、`../` 穿越、空路径。
- 读写范围硬限制在 `.stupidClaw/`。

### 第 6 期（Cron 主动触发）

项目结构：
- `src/cron.ts`
- `.stupidClaw/cron_jobs.json`
- `src/skills/cron/manage_cron_jobs.ts`

关键代码：
- 定时扫描并匹配 `cronExpr`。
- 命中后执行 Skill，再发 Telegram 主动消息。
- 执行结果写入当日 history。

### 第 7 期（发布收口）

项目结构：
- `README.md`
- `.env.example`
- `public/troubleshooting.md`

关键代码：
- `pnpm install` + `pnpm dev` 一键跑通命令。
- 常见故障最小排查脚本（token、mode、webhook 地址）。
- 可选：`bun build --compile` 生成独立可执行文件。
