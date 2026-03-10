# StupidClaw 第 6 期：Cron 主动触发，让 Agent 自己干活

## 这期要解决什么问题

前 5 期的 StupidClaw 只能“你问我答”。  
这在聊天场景够用，但一旦你要“每天 8 点固定推送”，被动模式就不够了。

这期只做一个最小闭环：
- 用 `.stupidClaw/cron_jobs.json` 存任务；
- 进程内定时扫描并匹配 cron；
- 命中后执行 Skill；
- 把结果写入 history，并主动发到 Telegram。

---

## 最小数据结构（先定数据，再写代码）

```ts
type CronJob = {
  id: string;                         // 任务唯一 id
  name: string;                       // 显示名
  enabled: boolean;                   // 开关
  cronExpr: string;                   // 5 段 cron，如 "0 8 * * *"
  targetChatId: string;               // 结果发给谁
  sessionKey?: string;                // 用哪个会话上下文执行
  task: {
    mode: "tool" | "prompt";          // 工具执行 or 提示词执行
    requirement: string;              // 人类可读任务要求
    skillNames: string[];             // 关联文件技能名（可选）
    prompt?: string;                  // mode=prompt 时使用
    toolName?: string;                // mode=tool 时使用
    toolArgs?: Record<string, unknown>;
  };
  lastTriggeredAt?: string;           // 上次触发时间（去重）
};
```

不变量：
- cron 持久化文件永远是 `{ jobs: CronJob[] }`；
- `enabled=false` 任务不执行；
- 同一分钟内同一任务最多执行一次；
- 执行结果必须进入 history，并尝试主动发消息。

---

## 第 6 期项目结构

```text
src/
├─ cron/
│  └─ jobs-store.ts                  (新增：cron_jobs.json 读写)
├─ cron.ts                           (新增：cron 匹配、调度、执行)
├─ skills/
│  ├─ cron/
│  │  └─ manage_cron_jobs.ts         (新增：list/add/update/remove/set_enabled)
│  └─ registry.ts                    (改造：注册 manage_cron_jobs)
└─ index.ts                          (改造：启动 cron scheduler)

.stupidClaw/
└─ cron_jobs.json                    (新增：任务持久化)
```

---

## 关键实现

### 1) `cron_jobs.json`：保持单一真实来源

任务不放内存，不放数据库，只放一个文件。  
`jobs-store.ts` 负责三件事：
- `ensureCronJobsFile()`：不存在就初始化；
- `readCronJobs()`：读文件并做最小结构校验；
- `writeCronJobs()`：整文件覆盖写回。

好处是：状态一眼可见，出问题直接看文件。

### 2) `manage_cron_jobs`：让模型能管理任务

这版只保留 5 个动作：
- `list`
- `add`
- `update`
- `remove`
- `set_enabled`

不做“模板任务系统”、不做“多租户权限层”。  
先把可用性打实，再谈扩展。

例如新增每天 21 点睡前故事（prompt 模式）：

```json
{
  "action": "add",
  "name": "bedtime-story",
  "cronExpr": "0 21 * * *",
  "mode": "prompt",
  "requirement": "生成儿童睡前故事，语气温柔，200-300字",
  "skillNames": ["tell_bedtime_story"],
  "prompt": "请使用 tell_bedtime_story 的规则，生成今晚睡前故事"
}
```

说明：`chatId` 可省略，默认使用当前对话会话的 chatId。

### 3) `cron.ts`：最小调度循环

`startCronScheduler()` 每 15 秒跑一次 `tick()`：
- 读取 `cron_jobs.json`；
- 用 `isCronExprMatch()` 匹配当前时间；
- 用 `lastTriggeredAt` 做“分钟级去重”；
- `mode=tool` 调 `runSkill()`，`mode=prompt` 调 `runPrompt()`；
- 追加 history（`tool_call/tool_result/message`）；
- 调 `sendMessage()` 主动推送 Telegram。

这套逻辑够解决“每天 8 点早报”。

### 4) 顶层上下文注入：chatId 与当前时间

每轮对话提示词顶层都注入 `runtime_context`：
- `chat_id`
- `now_iso`
- `now_local`

这样模型在创建定时任务时可以直接使用上下文，不需要反问用户“你的 chatId 是多少”。

---

## 为什么不直接引入第三方调度库

不是不能用，而是当前需求太小：
- 只要 5 段 cron；
- 单进程；
- 单文件存储。

直接写一个可读的匹配器和循环更稳，维护成本更低。  
这就是 KISS：别为“未来可能”提前背复杂度。

---

## 本期验收清单

- [x] 新增 `.stupidClaw/cron_jobs.json`
- [x] 新增 `src/cron.ts`
- [x] 新增 `manage_cron_jobs` Skill
- [x] 命中 cron 后能执行 Skill，并主动发 Telegram
- [x] 执行结果写入 history
