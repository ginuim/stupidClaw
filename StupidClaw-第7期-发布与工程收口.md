# StupidClaw 第 7 期：发布与工程收口

## 这期要解决什么问题

前 6 期把 StupidClaw 从零搭起来了：

- 第 1 期：Polling 跑通消息闭环
- 第 2 期：Webhook 可选增强
- 第 3 期：技能系统 + 历史记录
- 第 4 期：Profile 长期记忆
- 第 5 期：Path Jailing 安全沙盒
- 第 6 期：Cron 主动触发

最后这一期只做一件事：**让新读者能在 15 分钟内从 clone 到跑通**。

这不是"加功能"，而是把代码和文档都收拾干净，让项目真正可以交付出去。

---

## 这期产出

```text
README.md               # 5 分钟启动指南（第 1 期已有，补全细节）
.env.example            # 完整环境变量模板
public/troubleshooting.md # 常见故障排查
```

不需要加新代码，只需要把文档补齐。

---

## README.md（5 分钟启动）

README 只做一件事：让陌生人能跑起来。不讲原理，不讲架构，只讲步骤。

关键内容：

**1. 克隆与安装**

```bash
git clone https://github.com/your-name/stupidClaw.git
cd stupidClaw
pnpm install
```

**2. 配置环境变量**

```bash
cp .env.example .env
```

打开 `.env`，至少填写：

- `TELEGRAM_BOT_TOKEN`：从 BotFather 创建 Bot 后获取
- `MINIMAX_API_KEY`：从 MiniMax 开放平台获取

**3. 启动**

```bash
pnpm dev
```

看到 `[transport] polling started` 就代表跑起来了。去 Telegram 找你的 Bot，发一条消息，它会回复你。

---

## .env.example

```env
TELEGRAM_BOT_TOKEN=
MINIMAX_API_KEY=
MINIMAX_MODEL=MiniMax-M2.5
TELEGRAM_MODE=polling
TELEGRAM_WEBHOOK_URL=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_PATH=/telegram/webhook
PORT=8787
DEBUG_STUPIDCLAW=0
DEBUG_PROMPT=1
```

每个变量的作用：

| 变量 | 必填 | 说明 |
|------|------|------|
| `TELEGRAM_BOT_TOKEN` | 是 | BotFather 给的 token |
| `MINIMAX_API_KEY` | 推荐 | 不填走 fallback 回显 |
| `MINIMAX_MODEL` | 否 | 默认 `MiniMax-M2.5` |
| `TELEGRAM_MODE` | 否 | `polling`（默认）或 `webhook` |
| `TELEGRAM_WEBHOOK_URL` | Webhook 时 | 公网 HTTPS 回调地址 |
| `DEBUG_STUPIDCLAW` | 否 | `1` 开启引擎调试日志 |
| `DEBUG_PROMPT` | 否 | `1` 打印完整 prompt |

---

## 故障排查文档结构

`public/troubleshooting.md` 按真实故障场景组织，不按模块。每个场景格式：

1. 现象（报错信息或行为描述）
2. 原因
3. 解法（可执行命令）

核心场景：

**启动即崩溃**

最常见原因：缺 `TELEGRAM_BOT_TOKEN`，或上次进程未退出导致 lock 文件残留。

```bash
# 清除残留锁文件
rm .stupidClaw/polling.lock
```

**Bot 无回复**

检查 `MINIMAX_API_KEY` 是否有效，用 `DEBUG_STUPIDCLAW=1` 开启详细日志追踪。

**Webhook 收不到消息**

验证 Webhook 是否真的注册成功：

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

本地开发直接用 Polling，省事。

**Cron 不触发**

检查 cron 表达式格式，确认 `enabled: true`，查当日 history 文件确认执行日志。

---

## 第 7 期没有新代码的原因

一个工程到了可以发布的状态，不应该再加功能。加功能会引入新的 bug，让文档更难维护，让新用户更难上手。

这期的工作是：

- 把已有的东西整理清楚
- 让陌生人能看懂
- 让常见问题有答案

这就是工程收口的全部意义。如果你在做一个可以长期运行的项目，这一步比"再加一个功能"重要得多。

---

## 本期验收清单

- [ ] `git clone` 后按 README 操作，不超过 15 分钟跑通
- [ ] `.env.example` 包含所有必要变量且有说明注释
- [ ] `public/troubleshooting.md` 覆盖启动失败、Bot 无回复、Webhook 故障、Cron 不触发四个场景
- [ ] 新读者不需要看源码就能排查常见问题

---

## 整套教程回顾

7 期下来，StupidClaw 做了什么：

```
第 1 期  ←─ Polling 最小闭环（能跑通就是胜利）
第 2 期  ←─ Webhook 增强（不改业务层，只换传输）
第 3 期  ←─ 技能系统（按需披露，不是越多越好）
第 4 期  ←─ Profile 长期记忆（文件就够，不用数据库）
第 5 期  ←─ Path Jailing（沙盒先行，不是事后补丁）
第 6 期  ←─ Cron 主动触发（从被动变主动）
第 7 期  ←─ 工程收口（能交付才算完成）
```

总代码量控制在合理范围内，没有引入数据库、没有做复杂 UI、没有用"高级"框架。这不是能力不够，而是刻意为之。

回归纯粹。
