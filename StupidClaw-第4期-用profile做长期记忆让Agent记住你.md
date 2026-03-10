# StupidClaw 第 4 期：用 profile 做长期记忆，让 Agent 记住你

## 这期要解决什么问题

第 3 期我们有了 `history`，但它是流水账，不是稳定事实。  
用户说过一次“我不吃香菜”，下一轮模型可能忘，重启后更可能忘。

这期只做一件事：  
把“长期稳定事实”沉淀到 `.stupidClaw/profile.md`，并给模型一个可控更新入口。

---

## 最小数据结构（先定数据，再写代码）

### 1) profile 的分段结构

```ts
type ProfileSection = "stable_facts" | "preferences" | "constraints";

type ProfileData = {
  stable_facts: string[];
  preferences: string[];
  constraints: string[];
};
```

不变量：
- 只允许写固定 section，拒绝自由拼 section 名；
- 每条事实是一个 bullet 字符串；
- 去重、去空，避免记忆越写越脏。

### 2) 更新协议

```ts
type UpdateProfileInput = {
  section: ProfileSection;
  facts: string[];
  mode?: "append" | "replace";
};
```

不变量：
- `append` 默认追加并去重；
- `replace` 只替换目标 section；
- 不提供“整文件覆盖”能力，避免模型误伤。

---

## 第 4 期项目结构

```text
src/
├─ memory/
│  └─ profile-store.ts
├─ skills/
│  └─ memory/
│     └─ update_profile.ts
└─ engine.ts  (会话前注入 profile)
```

---

## 关键实现

### 1) profile-store：数据层只做一件事

`src/memory/profile-store.ts` 的职责非常窄：

- 确保 `.stupidClaw/profile.md` 存在；
- 解析固定 `## section` + `- fact`；
- 执行 `append/replace` 更新并回写。

没有数据库，没有“记忆向量化”，没有复杂索引。  
我们现在只需要“稳定可读写 + 可重启保留”。

### 2) update_profile Skill：把写权限收紧

`src/skills/memory/update_profile.ts` 只暴露三个 section：

- `stable_facts`
- `preferences`
- `constraints`

并且只接受 `facts[] + mode`。  
这比让模型直接写文件更稳：权限小，错误面就小。

### 3) 引擎前置注入：每轮都带上 profile

在 `src/engine.ts` 里，每次 `prompt()` 前先读取 `profile.md`，再把它和当前用户消息拼成一个输入。  
这样模型每轮都有同一份长期记忆，不依赖“刚好翻到历史记录”。

---

## 为什么不用更“高级”的方案

你可以上向量库、记忆打分、自动压缩摘要。  
但现在这么做只会把复杂度炸开：

- 新增依赖与运维面；
- 难以解释“为什么记住/为什么忘记”；
- 教程读者很难一次跑通。

`profile.md` 的优势是：可读、可改、可审计。  
先把确定性做出来，再谈智能化增强。

---

## 本期验收清单

- [x] 存在 `.stupidClaw/profile.md`，且有固定 section
- [x] `update_profile` 只能更新指定 section，不支持整文件自由覆盖
- [x] 每轮对话前会注入 profile 内容
- [ ] 实测：用户声明偏好后，下一轮与重启后均能正确记住
