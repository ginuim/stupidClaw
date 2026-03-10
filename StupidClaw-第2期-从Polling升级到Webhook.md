# StupidClaw 第 2 期：从 Polling 升级到 Webhook，不改业务层

## 这期要解决什么问题

第 1 期我们已经把本机 Polling 闭环跑通。  
接下来真正的工程问题不是“能不能接 Webhook”，而是：

**能不能在升级传输层时，不动业务层。**

如果每换一种接入方式都改一遍 `engine` 和回复流程，这个项目后面一定会烂掉。

这一期目标很克制：
- 引入 webhook 模式
- 保持 `engine.chat()` 和回复链路不变
- 通过 `TELEGRAM_MODE` 在 `polling | webhook` 之间切换

---

## 最小数据结构（统一消息模型）

传输层做再多事，最终都必须归一到同一个输入：

```ts
type IncomingMessage = {
  updateId?: number;
  chatId: string;
  text: string;
};
```

不变量：
- Polling 和 Webhook 都只能产出这个结构。
- 业务处理函数只认 `chatId/text`，不关心消息来源。
- `updateId` 在 webhook 场景允许缺失（日志时用 `-` 占位）。

---

## 第 2 期项目结构

```text
src/
├─ index.ts                    # 只保留统一业务处理回调
├─ gateway.ts                  # 轻量 HTTP webhook 入口
└─ transport/
   ├─ polling.ts               # 既有 polling 能力
   ├─ webhook.ts               # webhook 注册与 payload 映射
   └─ index.ts                 # 模式切换与统一入口
```

---

## 关键代码

### 1) 传输层统一入口

`src/transport/index.ts` 是这期核心：

```ts
export async function startTransport(token: string, onMessage: MessageHandler) {
  const mode = process.env.TELEGRAM_MODE ?? "polling";
  if (mode === "webhook") {
    await runWebhookMode(token, onMessage);
    return;
  }
  await runPollingMode(token, onMessage);
}
```

好处很直接：`index.ts` 不再依赖具体传输实现。

### 2) Webhook 模式最小实现

`src/transport/webhook.ts` 做三件事：
- 启动时调用 `setWebhook`
- HTTP 收到 Telegram update 后映射为 `IncomingMessage`
- 调用统一 `onMessage(message)` 进入业务层

### 3) Gateway 只做接入，不做业务

`src/gateway.ts` 明确边界：
- 校验路径和 method
- 校验可选 secret header
- 解析 JSON 并回调 `onPayload`

没有状态机，没有业务判断，没有“顺手”逻辑。

### 4) 业务层保持不变

`src/index.ts` 现在只做：
- 启动时获取 `TELEGRAM_BOT_TOKEN`
- `startTransport(...)` 注册统一消息处理回调
- 回调里执行 `engine.chat()` 并 `sendMessage()`

这就是“传输升级但业务不动”的核心结果。

---

## 配置变更

`.env.example` 新增：

```bash
TELEGRAM_MODE=polling
TELEGRAM_WEBHOOK_URL=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_PATH=/telegram/webhook
PORT=8787
```

说明：
- 本机开发继续默认 `TELEGRAM_MODE=polling`
- 只有在公网可达时才切 `TELEGRAM_MODE=webhook`

---

## 本期进度与验收状态

已完成：
- [x] `src/gateway.ts`
- [x] `src/transport/index.ts`
- [x] `.env`/`.env.example` 增加模式配置
- [x] Polling 回归冒烟通过（第 2 期改造未破坏第 1 期能力）

暂未完成：
- [ ] `TELEGRAM_MODE=webhook` 公网回调验收

为什么没勾这项：  
Webhook 验收依赖公网地址与可达端口，这是部署条件，不是代码结构问题。  
这期先把架构改造做对，验收放到公网环境进行即可。

---

## 本期结论

这期最重要的不是“加了 webhook”，而是把系统做成了：

**传输层可替换，业务层不感知。**

这就是可维护性的起点。  
下一期做 Skills 时，消息怎么进来不再是问题，技能协议和历史存储才是重点。
