# StupidClaw 常见故障排查

---

## 启动即崩溃

**现象**：`pnpm dev` 后立即打印错误并退出。

**原因 1：缺少 `TELEGRAM_BOT_TOKEN`**

```
[fatal] Missing TELEGRAM_BOT_TOKEN
```

解法：`cp .env.example .env`，然后填入 BotFather 给你的 token。

**原因 2：重复启动（lock 文件残留）**

```
[fatal] Another polling instance is already running (lock file: .stupidClaw/polling.lock)
```

上次进程未正常退出，锁文件没有清理。

```bash
rm .stupidClaw/polling.lock
```

再重启即可。正常退出（Ctrl+C 或 SIGTERM）会自动清理锁文件。

---

## Bot 收到消息但没有回复

**排查步骤：**

1. 确认日志里有 `[ok] chatId=... updateId=...`，如果没有说明请求到 MiniMax 失败。
2. 检查 `MINIMAX_API_KEY` 是否填写，以及账户是否有余额。
3. 开启详细日志：

```bash
DEBUG_STUPIDCLAW=1 pnpm dev
```

4. 查看 `[debug][engine]` 输出，确认模型返回了什么。

**MiniMax API Key 未填写时的 fallback 行为：**

引擎会回显用户输入，而不是真正调用模型。这是刻意设计的 fallback，方便无 key 时验证传输层是否工作正常。

---

## Webhook 模式收不到消息

Webhook 需要公网 HTTPS 地址。本地开发建议优先用 Polling 模式（`TELEGRAM_MODE=polling`）。

如果你必须用 Webhook，排查清单：

1. `TELEGRAM_WEBHOOK_URL` 必须是 `https://` 开头的公网地址。
2. 该地址必须能被 Telegram 服务器访问（不能是 `localhost`）。
3. SSL 证书必须有效（自签名不行，除非上传给 Telegram）。
4. `PORT` 与实际监听端口一致。
5. 在 Telegram 控制台验证 webhook 是否设置成功：

```bash
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

返回结果中 `url` 字段应为你的回调地址，`last_error_message` 应为空。

**从 Webhook 切回 Polling：**

```bash
TELEGRAM_MODE=polling pnpm dev
```

Polling 启动时会自动调用 `deleteWebhook` 清除已注册的回调地址。

---

## Cron 定时任务没有触发

1. 检查 `.stupidClaw/cron_jobs.json` 中任务是否存在，`enabled` 是否为 `true`。
2. 检查 `cronExpr` 格式，StupidClaw 使用标准 5 段 cron 表达式（分 时 日 月 周）：

   ```
   # 每天早上 8 点
   0 8 * * *
   
   # 每小时整点
   0 * * * *
   
   # 每 5 分钟
   */5 * * * *
   ```

3. 系统时区与你的预期是否一致？Cron 按本机时区执行。
4. 查看当日 history 文件确认是否有触发记录：

   ```bash
   cat .stupidClaw/history/$(date +%Y-%m-%d).jsonl
   ```

5. 开启调试日志查看调度器输出：

   ```bash
   DEBUG_STUPIDCLAW=1 pnpm dev
   ```

---

## 技能（Skill）调用失败

**现象**：模型声称执行了操作但实际没有发生。

1. 确认技能已注册：让 Bot 执行 `list_available_skills` 列出所有可用技能。
2. 检查参数格式是否正确：开启 `DEBUG_PROMPT=1` 查看完整 prompt，确认工具描述是否清晰。
3. 文件类技能（读写）只允许操作 `.stupidClaw/` 目录下的文件。访问 `../src/` 或绝对路径会被拒绝：

   ```
   路径越界：不允许访问沙盒外的路径
   ```

---

## Profile 记忆丢失

Profile 保存在 `.stupidClaw/profile.md`，该文件不在 git 追踪范围内（`.gitignore` 中排除）。

- 如果你清空了 `.stupidClaw/` 目录，profile 会丢失。
- 重启进程不会丢失 profile，它是文件持久化的。
- 备份方式：定期复制 `.stupidClaw/profile.md` 到安全位置。

---

## 环境变量速查表

| 变量 | 必填 | 说明 |
|------|------|------|
| `TELEGRAM_BOT_TOKEN` | 是 | BotFather 提供的 Bot token |
| `MINIMAX_API_KEY` | 推荐 | 不填会走 fallback 回显，无法真正对话 |
| `MINIMAX_MODEL` | 否 | 默认 `MiniMax-M2.5` |
| `TELEGRAM_MODE` | 否 | `polling`（默认）或 `webhook` |
| `TELEGRAM_WEBHOOK_URL` | Webhook 时必填 | 公网 HTTPS 回调地址 |
| `TELEGRAM_WEBHOOK_SECRET` | 否 | Webhook 请求验签密钥 |
| `TELEGRAM_WEBHOOK_PATH` | 否 | 默认 `/telegram/webhook` |
| `PORT` | 否 | Webhook 监听端口，默认 `8787` |
| `DEBUG_STUPIDCLAW` | 否 | 设为 `1` 开启引擎调试日志 |
| `DEBUG_PROMPT` | 否 | 设为 `1` 打印每次发给模型的完整 prompt |
