# StupidClaw 开发待办

每次修改或开发代码后需更新本文件，勾选已完成项。

当前开发分支：`phase-2-webhook`

## 全局硬约束（必须满足）

- [x] 所有核心会话与工具调用流程必须基于 `pi-mono`，禁止自造一套并行 Agent 内核
- [x] 每期开始前新建分支（`phase-N` 或 `phase-N-描述`）
- [x] 每次代码改动后都要维护本文件
- [ ] 每期代码完成后同步更新教程文章

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
- [ ] 验收：两种模式均正常

---

## 第 3 期：技能系统

- [ ] `src/memory/history-store.ts`
- [ ] `src/skills/contracts.ts`
- [ ] `src/skills/registry.ts`
- [ ] 技能：get_system_time、list_available_skills、query_history
- [ ] 验收：渐进式披露、历史可按日期回溯

---

## 第 4 期：长期记忆 profile.md

- [ ] `src/memory/profile-store.ts`
- [ ] update_profile Skill
- [ ] 验收：跨轮与重启后记忆保留

---

## 第 5 期：安全沙盒

- [ ] `src/memory/workspace-path.ts`
- [ ] 文件类 Skill 接入路径解析
- [ ] 验收：越权路径被拒绝、合法路径正常

---

## 第 6 期：Cron 主动触发

- [ ] `.stupidClaw/cron_jobs.json`
- [ ] `src/cron.ts`
- [ ] manage_cron_jobs Skill
- [ ] 验收：定时任务可触发并推送

---

## 第 7 期：发布与工程收口

- [x] README.md（5 分钟启动）
- [x] .env.example
- [ ] 常见故障排查文档
- [ ] 验收：新读者 clone 到跑通不超过 15 分钟
