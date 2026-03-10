# StupidClaw 开发待办

每次修改或开发代码后需更新本文件，勾选已完成项。

当前开发分支：`phase-1-polling`

---

## 第 0 期（发刊词）

- [ ] 发刊词文章
- [ ] 项目空仓脚手架与目录草图

---

## 第 1 期：Polling 最小闭环

- [x] `src/transport/polling.ts`
- [x] `src/engine.ts`
- [x] `src/index.ts`
- [ ] 验收：用户发消息 Bot 能回复
- [ ] 验收：断开重连后 Polling 恢复
- [ ] 验收：整条链路日志可追踪

---

## 第 2 期：Webhook 升级

- [ ] `src/gateway.ts`
- [ ] `src/transport/index.ts`（polling | webhook 切换）
- [ ] `.env` 新增 `TELEGRAM_MODE`
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

- [ ] README.md（5 分钟启动）
- [x] .env.example
- [ ] 常见故障排查文档
- [ ] 验收：新读者 clone 到跑通不超过 15 分钟
