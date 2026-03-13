# StupidClaw 开发待办

每次修改或开发代码后需更新本文件，勾选已完成项。

当前开发分支：`phase-9-flexible-model`

## 全局硬约束（必须满足）

- [x] 所有核心会话与工具调用流程必须基于 `pi-mono`，禁止自造一套并行 Agent 内核
- [x] 每期开始前新建分支（`phase-N` 或 `phase-N-描述`）
- [x] 每次代码改动后都要维护本文件
- [x] 每期代码完成后同步更新教程文章

---

## 第 0 期（发刊词）

- [ ] 发刊词文章
- [ ] 项目空仓脚手架与目录草图

---

## 第 1 期：Polling 最小闭环（基于 pi-mono）

- [x] `src/transport/polling.ts`
- [x] `src/engine.ts`
- [x] `src/index.ts`
- [x] `src/engine.ts` 切换为 `pi-mono` 会话驱动（替换临时直调模型实现）
- [x] 接入 `pi-mono` 的最小 tool-call 循环（先支持常驻空工具集也行）
- [x] 第 1 期教程文章：`StupidClaw-第1期-先用Polling跑通消息闭环.md`
- [x] 验收：用户发消息 Bot 能回复
- [x] 验收：断开重连后 Polling 恢复
- [x] 验收：整条链路日志可追踪

---

## 第 2 期：Webhook 升级

- [x] `src/gateway.ts`
- [x] `src/transport/index.ts`（polling | webhook 切换）
- [x] `.env` 新增 `TELEGRAM_MODE`
- [x] 第 2 期教程文章：`StupidClaw-第2期-从Polling升级到Webhook.md`
- [ ] 验收：两种模式均正常（第二期先不做 webhook 公网验收，但 polling 已保持可用）

---

## 第 3 期：技能系统

- [x] `src/memory/history-store.ts`
- [x] `src/skills/contracts.ts`
- [x] `src/skills/registry.ts`
- [x] 技能：get_system_time、list_available_skills、query_history、skill_creator
- [x] 修复：接入 skills 后仍保留 pi-mono 内建基础工具（read/write/edit/bash）
- [x] 新增：Agent 文件工具工作目录固定为 `.stupidClaw/workspace`
- [x] 验收：渐进式披露、历史可按日期回溯
- [x] 第 3 期教程文章：`StupidClaw-第3期-Skills不是越多越好关键是按需披露.md`

---

## 第 4 期：长期记忆 profile.md

- [x] `src/memory/profile-store.ts`
- [x] update_profile Skill
- [x] 第 4 期教程文章：`StupidClaw-第4期-用profile做长期记忆让Agent记住你.md`
- [x] 优化身份提示词：设定模型身份为 StupidClaw，去掉“你是谁”硬编码分支
- [x] 抽取身份提示词模块：`src/prompt/identity.ts`
- [x] 修复回复重复：避免同时拼接 text_delta 与重复 text_end 内容
- [x] 增加提示词调试开关：`DEBUG_PROMPT=1` 时打印每次模型调用 prompt
- [x] 增加工具调试日志：打印会话可见工具名与自定义 skill 参数摘要
- [x] 加载 `.stupidClaw/skills` 文件技能到每次模型提示词，并输出 fileSkills 调试列表
- [ ] 验收：跨轮与重启后记忆保留

---

## 第 5 期：安全沙盒

- [x] `src/memory/workspace-path.ts`
- [x] 文件类 Skill 接入路径解析
- [x] 路径沙盒单测：`src/memory/workspace-path.test.ts`
- [x] 第 5 期教程文章：`StupidClaw-第5期-安全沙盒PathJailing防止越权读写.md`
- [x] 验收：越权路径被拒绝、合法路径正常

---

## 第 6 期：Cron 主动触发

- [x] `.stupidClaw/cron_jobs.json`
- [x] `src/cron.ts`
- [x] manage_cron_jobs Skill
- [x] 第 6 期增强：CronJob 增加 task 结构（mode/requirement/skillNames），支持 prompt 模式任务
- [x] 第 6 期增强：manage_cron_jobs 支持 update 动作（按 id 局部更新任务）
- [x] 第 6 期增强：身份提示词加入“定时任务意图 => 优先调用 manage_cron_jobs”规则
- [x] 第 6 期增强：manage_cron_jobs 支持 chatId 默认当前会话，不再强制用户手填
- [x] 第 6 期增强：每轮提示词顶层注入 runtime_context（chatId + 当前时间）
- [x] 第 6 期增强：mode=prompt 强制 skillNames 非空，执行时按技能名拼接调用提示词
- [x] 第 6 期增强：去掉 mode 字段，改用 toolName 是否存在区分执行路径，数据结构更简洁
- [x] 修复：manage_cron_jobs toolName/skillNames 描述不清，LLM 将 skill 名误填到 toolName 而非 skillNames
- [x] 第 6 期教程文章：`StupidClaw-第6期-Cron主动触发让Agent自己干活.md`
- [x] 验收：定时任务可触发并推送

---

## 第 7 期：发布与工程收口

- [x] README.md（5 分钟启动）
- [x] .env.example
- [x] Telegram 消息发送优化：markdown→HTML 渲染、typing indicator、超长消息切片
- [x] `public/troubleshooting.md` 常见故障排查文档
- [x] `public/getting-started.md` 快速上手指南
- [x] 第 7 期教程文章：`StupidClaw-第7期-发布与工程收口.md`
- [x] 优化：identity + file_skills 移入 system prompt，每轮 prompt 只传 runtime_context + profile + user_message
- [x] 修复：剥除回复中的 <think>...</think> 标签
- [x] 修复：typing indicator 持续刷新（每 4 秒），直到回复完成
- [x] 新增：制作并发布 `public/index.html` 项目介绍 Landing Page，集成文档中心入口
- [ ] 验收：新读者 clone 到跑通不超过 15 分钟

---

## 第 8 期：网页端简易 IM（StupidIM）

- [x] 新增：支持基于 WebSocket 的简易 IM（StupidIM）及其凭证校验
- [x] 优化：HTTP 与 WebSocket 端口复用
- [x] 优化：移除 STUPID_IM_PORT，统一使用 PORT（Webhook/Polling 均用同一端口）
- [x] 网页端：创建 `public/im.html` 作为独立的 IM 客户端
- [x] 体验：提供 npm run im 命令快速打开网页端并自动填充 Token 与参数
- [x] 优化：Landing Page 及 README / getting-started / 教程规划等 md 文案统一为「回归纯粹」
- [x] 优化：README 文档，完善链接与项目说明
- [ ] 撰写第 8 期教程文章

---

## 第 9 期：多模型支持与配置优化

- [x] 重构 `src/engine.ts`：从 `pickMiniMaxModel` 到更通用的 `pickModel`
- [x] 支持 `STUPID_MODEL=provider:model_id` 格式配置
- [x] 更新 `.env.example`：列出所有内置 provider，注释说明本地模型配置方式
- [x] 新增 `public/models.md`：完整模型配置指南，含供应商列表、本地模型、OpenAI/Anthropic 兼容配置
- [x] 更新 `public/getting-started.md`：简化模型配置说明，指向 models.md
- [x] 验收：支持 MiniMax、OpenAI、Groq 等模型切换
- [x] 修复：`OPENROUTER_API_KEY` 显式映射到 `openrouter` provider，避免错误回退到 `minimax-cn`
- [x] 优化：重写 API Key 缺失报错，优先按 `STUPID_MODEL` 给出可操作提示（避免误导为 minimax-cn）
- [x] 新增 `ensureWorkspaceDirs()`：启动时统一创建所有 `.stupidClaw` 子目录
- [ ] 撰写第 9 期教程文章

---

## 第 10 期：更高级的分发方式 (NPX & CLI)

- [x] 分支：`phase-9-npx-support` (当前分支)
- [x] 支持 `npx stupid-claw` 一键运行 (配置 bin)
- [x] 支持通过 `--config` 指定配置文件，或默认从 `process.cwd()` 加载
- [x] 优化入口文件，增加 Shebang 和错误引导（如未检测到 .env）
- [x] 支持 `pnpm build` 将项目编译为独立的 JS 文件用于 CLI 分发
- [x] 更新 `README.md` 和 `getting-started.md` 说明新的安装/运行方式
- [x] 修复：Node ESM 要求相对导入带 .js 扩展名，统一添加
- [x] 新增 `init` 子命令：将包内 `.env.example` 复制到当前目录 `.env`，并打印下一步操作提示
- [x] 优化无 `.env` 时的 warn 提示，直接告知用户运行 `npx stupid-claw init`
- [x] 引入 `@inquirer/prompts` + `picocolors`，将 `init` 升级为交互式配置向导（src/init.ts）
- [x] init 向导：先配置 LLM 供应商与模型，后配 Telegram（可留空，仅用 StupidIM）
- [x] init 向导：API Key 脱敏输入时提示用户「输入不显示属正常」
- [x] init 向导：按供应商提供多模型选项（Hunter Alpha、Healer Alpha 等）
- [ ] 验收：在空目录下执行 `npx stupid-claw init` 能逐步引导用户完成 .env 配置
