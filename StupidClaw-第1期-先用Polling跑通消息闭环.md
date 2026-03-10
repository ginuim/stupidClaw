# StupidClaw 第 1 期：先用 Polling 跑通消息闭环，再谈复杂架构

## 这期要解决什么问题

很多 Agent 项目一上来就做公网 Webhook、HTTPS、反向代理、消息队列。  
结果是：功能没跑通，复杂度先爆炸。

这一期我们只做一件事：  
**在本机用 Telegram Long Polling 跑通 “用户发消息 -> Agent 回复” 的最小闭环。**

约束很硬：
- 基于 `pi-mono`（`@mariozechner/pi-coding-agent`）做会话驱动，不自造内核。
- 不上数据库，不上 Web 管理后台。
- 先保证可运行、可重启、可追踪。

---

## 最小数据结构（先定数据，再写代码）

这一期只有 4 个核心数据：

1. 入站消息
```ts
type IncomingMessage = {
  updateId: number;
  chatId: string;
  text: string;
};
```

2. 出站消息
```ts
type OutgoingMessage = {
  chatId: string;
  replyText: string;
};
```

3. 运行时状态：`offset`
```ts
let offset = 0;
```

4. 会话状态：`chatId -> pi session`
```ts
Map<string, AgentSession>
```

不变量：
- 每处理一条 update 后，必须推进 `offset = updateId + 1`，防止重复消费。
- 每个 `chatId` 绑定一个会话，避免上下文串线。
- 任何时刻只能有一个 polling 进程工作（单实例锁）。

---

## 项目结构（第 1 期）

```text
src/
├─ index.ts                 # 启动、主循环、单实例锁
├─ engine.ts                # pi-mono 会话驱动
└─ transport/
   └─ polling.ts            # Telegram getUpdates / sendMessage
```

---

## 关键实现（最小链路代码）

### 1) Polling 拉取与回复发送

`src/transport/polling.ts` 做三件事：
- `getUpdates(token, offset)` 拉消息
- `sendMessage(token, chatId, text)` 发回复
- 遇到 `HTTP 409` 自动 `deleteWebhook` 后重试（避免 webhook/polling 冲突）

这个 409 处理是实战里非常高频的坑，不处理就会一直拉取失败。

### 2) pi-mono 会话驱动

`src/engine.ts` 里不再手写模型 HTTP 调用，而是：
- 用 `createAgentSession` 创建会话
- 用 `ModelRegistry` 自动解析 MiniMax 模型
- 用 `tools: []` 先跑最小会话循环

最小调用路径：
```ts
const { session } = await createAgentSession({
  authStorage,
  modelRegistry,
  model,
  sessionManager: SessionManager.inMemory(),
  tools: [],
  thinkingLevel: "off"
});

await session.prompt(text);
```

### 3) 主循环与单实例锁

`src/index.ts`：
- 启动时创建 `.stupidClaw/polling.lock`
- 已有锁则直接退出，避免多进程重复回复
- 主循环固定为：
```ts
while (true) {
  const messages = await getUpdates(token, offset);
  for (const message of messages) {
    offset = Math.max(offset, message.updateId + 1);
    const result = await chat({ chatId: message.chatId, text: message.text });
    await sendMessage(token, message.chatId, result.replyText);
  }
}
```

---

## 运行与验收

### 环境变量

至少填写：
- `TELEGRAM_BOT_TOKEN`
- `MINIMAX_API_KEY`（不填会走 fallback 回显）

### 启动命令

```bash
pnpm install
pnpm dev
```

### 验收清单（本期）

- [x] 用户发消息，Bot 能回复
- [x] 进程重启后，Polling 能恢复拉取
- [x] 链路日志可追踪（含 `chatId/updateId/text`）

---

## 本期踩坑复盘

1. **重复回复三次**  
根因：同时起了多个 polling 进程。  
修复：加单实例锁文件 `.stupidClaw/polling.lock`。

2. **`getUpdates` 返回 409**  
根因：bot 还挂着 webhook。  
修复：409 时自动 `deleteWebhook`，然后重试 `getUpdates`。

3. **`pnpm dev` 起不来（`bun: command not found`）**  
根因：本机没装 bun。  
修复：开发启动改用 `tsx`，并在入口显式加载 `.env`。

---

## 为什么这一期只做这些

因为这才是工程最小闭环：  
先证明“消息能进、模型能回、进程可重启、日志可追踪”。

没有这个闭环，后面讲 Skills、记忆、Cron 都是空中楼阁。  
有了这个闭环，第 2 期再上 Webhook 才是增量，而不是推倒重来。

---

## 下一期预告

第 2 期我们做一件事：  
**在不改业务层的前提下，把传输层从 Polling 升级为 Webhook。**

目标不是炫技，而是保持同一份 `engine.chat()` 逻辑，在两种传输模式下都稳定可用。
