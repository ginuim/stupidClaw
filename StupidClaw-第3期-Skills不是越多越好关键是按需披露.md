# StupidClaw 第 3 期：Skills 不是越多越好，关键是按需披露

## 这期要解决什么问题

前两期我们只解决了“消息能收能回”。  
但一个能长期跑的 Agent，迟早会遇到两个问题：

1. 工具太多，模型首轮就乱用；
2. 没有可回溯历史，模型无法基于事实做后续动作。

这一期只做最小闭环：

- 用 `always/on_demand` 做渐进式披露；
- 用 `.stupidClaw/history/YYYY-MM-DD.jsonl` 落历史；
- 给模型一个明确入口：先查技能目录，再按需调用。

---

## 最小数据结构（先定数据，再写代码）

### 1) Skill 元数据

```ts
type SkillExposure = "always" | "on_demand";

type SkillMeta = {
  name: string;
  description: string;
  exposure: SkillExposure;
};
```

不变量：
- `always`：首轮可见，给模型“入口能力”；
- `on_demand`：不在首轮全量展开，只在需要时通过目录发现。

### 2) Skill 可执行合同

```ts
type SkillDefinition = SkillMeta & {
  tool: ToolDefinition;
};
```

不变量：
- `name/description` 必须和 `tool` 对齐；
- `tool.execute` 返回可序列化结果，避免隐式状态。

### 3) 历史事件

```ts
type HistoryEvent = {
  ts: string;
  chatId: string;
  role: "user" | "assistant";
  type: "message" | "tool_call" | "tool_result";
  text?: string;
  tool?: string;
  args?: Record<string, unknown>;
  result?: string;
  isError?: boolean;
};
```

不变量：
- 每条事件只追加，不回写；
- 以 UTC 日期分片到 `YYYY-MM-DD.jsonl`；
- 查询按 `date/chatId/limit` 过滤。

---

## 第 3 期项目结构

```text
src/
├─ skills/
│  ├─ contracts.ts
│  ├─ registry.ts
│  ├─ system/get_system_time.ts
│  ├─ system/list_available_skills.ts
│  ├─ system/skill_creator.ts
│  └─ memory/query_history.ts
└─ memory/history-store.ts
```

---

## 关键实现

### 1) 技能注册表：把“入口能力”和“扩展能力”分开

`src/skills/registry.ts` 的核心是分层而不是堆功能：

- `always`：`get_system_time`、`list_available_skills`
- `on_demand`：`query_history`、`skill_creator`

这比“全量曝光所有技能”简单且稳定：  
首轮只给模型最少动作，降低误调用概率。

### 2) 技能目录工具：先查目录，再做决策

`list_available_skills` 返回统一 JSON：

- `skills`: 名称 + 暴露级别 + 描述
- `guidance`: 明确使用顺序（先 always，再 on_demand）

这就是“渐进式披露”的最小协议，不需要复杂路由器。

### 3) 历史落盘：append-only JSONL

`appendHistoryEvent()` 只做三件事：

1. 确保目录存在；
2. 根据 `ts` 算出日期文件；
3. `appendFile` 追加一行 JSON。

没有 ORM，没有索引，没有“聪明缓存”。  
先保证可追踪，再谈性能。

### 4) 历史查询：按日期回溯 + chatId 过滤

`queryHistory()` 支持：

- `date`（默认今天）
- `chatId`（可选）
- `limit`（默认 20，最大 200）

另外补了一个稳态修复：  
读取历史时若遇到坏行（非法 JSON），会跳过该行继续返回结果，而不是整次查询失败。

---

## 本期验收结果

### 验收项 1：首轮只暴露常驻技能

通过。  
从注册表定义和实际会话日志都能看到：首轮优先调用 `list_available_skills`，再决定是否调用 `query_history`。

### 验收项 2：模型可先查目录再按需调用

通过。  
当用户问“你有哪些技能”时，模型先调用 `list_available_skills`；  
当需要回溯上下文时，再调用 `query_history`，符合“先目录，后按需”。

### 验收项 3：重启后历史仍在，且可按日期回溯

通过（含容错修复）。  
历史文件持续写入 `.stupidClaw/history/2026-03-10.jsonl`，并可按 `date` 查询。  
针对历史文件中的坏行，查询逻辑已改为跳过坏行，避免整次回溯失败。

---

## 运行与验证（最小步骤）

```bash
pnpm install
pnpm dev
```

手工验证建议：

1. 连续发几条消息，包含一次工具调用场景（如“你有哪些技能”）；
2. 重启进程后再次询问“回顾今天的对话”；
3. 确认 `.stupidClaw/history/当天日期.jsonl` 持续追加；
4. 确认模型行为是“先列技能，再按需调用历史查询”。

---

## 踩坑复盘

1. **把 skills 当成全部能力**  
接入 skills 后，曾误把基础工具清空，导致模型以为不能读写文件。  
结论：skills 是增量，不是替代内建工具。

2. **JSONL 坏行导致整次查询失败**  
历史文件一旦出现坏行，直接 `JSON.parse` 会中断整个回溯。  
修复：读取时跳过坏行，保证“可回溯优先”。

---

## 本期结论

技能系统真正重要的不是“技能数量”，而是“披露顺序”。  
`always/on_demand` 这套最小分层，已经足够把模型从“乱调用”拉回“先发现再执行”。

有了这层约束，下一期做 `profile.md` 长期记忆时，系统不会失控，只会增量变强。

---

## 下一期预告

第 4 期我们只做一件事：  
把“短期历史”升级为“长期用户画像”，引入 `profile.md` + `update_profile`，实现跨轮、跨重启记忆。
