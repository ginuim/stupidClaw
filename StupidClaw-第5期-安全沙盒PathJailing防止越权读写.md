# StupidClaw 第 5 期：安全沙盒 Path Jailing，防止越权读写

## 这期要解决什么问题

前几期已经让 Agent 能读写项目内文件。问题也很直接：  
如果路径不收口，模型一旦写出 `../src/index.ts` 这类路径，就可能越权改到不该动的地方。

这期只做一件事：  
把所有项目内文件落盘路径，统一收敛到 `.stupidClaw/` 目录，并在路径解析阶段拒绝越界。

---

## 最小数据结构（先定数据，再写代码）

```ts
const STUPIDCLAW_ROOT = path.resolve(process.cwd(), ".stupidClaw");

type SafePathRule = {
  input: string;          // 调用方传入的相对路径
  output: string;         // 解析后的绝对路径（一定在 .stupidClaw 内）
  reject: boolean;        // 是否拒绝
  reason?: string;        // 拒绝原因
};
```

不变量：
- 路径不能为空；
- 禁止绝对路径；
- 禁止 `..` 路径穿越；
- 最终路径必须落在 `.stupidClaw/` 下。

---

## 第 5 期项目结构

```text
src/
├─ memory/
│  ├─ workspace-path.ts   (新增：统一安全路径解析)
│  ├─ history-store.ts    (改造：history 路径走 resolveSafePath)
│  └─ profile-store.ts    (改造：profile 路径走 resolveSafePath)
├─ skills/
│  ├─ file-skills.ts      (改造：skills 目录路径走 resolveSafePath)
│  └─ system/
│     └─ skill_creator.ts (改造：创建技能文件路径走 resolveSafePath)
└─ engine.ts              (改造：Agent workspace 根路径走 resolveSafePath)
```

---

## 关键实现

### 1) `workspace-path.ts`：一处定义，处处复用

核心接口只有两个：
- `getStupidClawRootPath()`
- `resolveSafePath(targetPath)`

`resolveSafePath` 做的事情很克制：
- trim 后判空；
- 拒绝绝对路径；
- `normalize` 后检查是否含 `..`；
- 通过 `path.resolve(STUPIDCLAW_ROOT, normalized)` 生成最终路径。

没有“策略对象”、没有“可插拔后端”。  
路径安全是硬约束，不需要花哨抽象。

### 2) 所有文件落盘点统一接入

把原来散落在各处的 `path.resolve(process.cwd(), ".stupidClaw", ...)` 收拢为统一入口：

- `engine.ts`：`WORKSPACE_ROOT = resolveSafePath("workspace")`
- `history-store.ts`：history 目录与日期文件都走 `resolveSafePath`
- `profile-store.ts`：`profile.md` 走 `resolveSafePath`
- `file-skills.ts`：加载 `.stupidClaw/skills` 走 `resolveSafePath`
- `skill_creator.ts`：创建 `skills/<name>/SKILL.md` 走 `resolveSafePath`

这样做的意义很朴素：  
路径规则只维护一份，减少“有的地方忘了加校验”的概率。

### 3) 越权路径行为

当传入类似 `../src/index.ts`：
- 会在 `resolveSafePath` 的 `..` 检查阶段直接拒绝；
- 调用方拿不到最终文件路径，自然不会触发读写。

合法路径（如 `history/2026-03-10.jsonl`、`skills/foo/SKILL.md`）保持正常工作。

---

## 为什么不用更复杂的沙盒设计

你当然可以做：
- 多层 ACL；
- 路径白名单 DSL；
- 外挂策略引擎。

但当前项目目标是本地单用户、可读可跑教程。  
一层“统一路径解析 + 硬拒绝越界”就够了，复杂系统只会带来更多误配点。

先把边界打实，再谈精细权限。

---

## 本期验收清单

- [x] 新增 `src/memory/workspace-path.ts`
- [x] `engine/profile/history/skill_creator/file-skills` 全部接入统一安全路径解析
- [x] 越权路径（如 `../src/index.ts`）会被拒绝
- [x] 合法路径读写与加载保持正常
