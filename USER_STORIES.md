# StupidClaw 用户故事

本文档记录 StupidClaw 的用户故事（User Stories），用于指导功能开发和优先级排序。

---

## 用户故事索引

- [US-004: IM 抽象层（抹平层）](#us-004-im-抽象层抹平层) ⭐ Phase 1
- [US-005: Markdown 消息渲染](#us-005-markdown-消息渲染) ⭐ Phase 1
- [US-002: 图片/文件消息支持](#us-002-图片文件消息支持) ⭐ Phase 2
- [US-003: 消息引用功能](#us-003-消息引用功能) ⭐ Phase 2
- [US-001: IM 文件浏览器功能](#us-001-im-文件浏览器功能) ⭐ Phase 3
- [US-006: Agent 状态可视化](#us-006-agent-思考与动作状态可视化) ⭐ Phase 3

---

## 开发阶段规划

### Phase 1: 基础能力建设
- **US-004**: IM 抽象层（接口抹平）
- **US-005**: Markdown/HTML 渲染

目标：把地基打牢，解决"看得见"和"接得住"的问题。

### Phase 2: 聊天体验补齐
- **US-002**: 图片/文件上传
- **US-003**: 消息引用

目标：补齐作为"聊天软件"的基础体验。

### Phase 3: Agent 特性增强
- **US-001**: 文件浏览器 + 历史消息 + Diff View + Token 估算
- **US-006**: Agent 状态可视化

目标：让 StupidClaw 从"聊天机器人"蜕变成"超级助理"。

---

## US-004: IM 抽象层（抹平层）

### 背景

StupidClaw 目前主要支持 Web IM (StupidIM) 和 Telegram 两种 IM 渠道。未来可能接入更多 IM 平台（如 Discord、Slack、微信等）。需要在后端做一层抽象，统一消息格式和交互模式，避免每个 IM 平台都需要单独适配。

### 目标用户

- 开发者：新增 IM 支持时只需实现适配器，无需修改核心逻辑
- 用户：无论使用哪种 IM，功能体验一致

### 功能需求

| 优先级 | 需求描述 |
|--------|----------|
| P0 | 定义统一的 IM 消息格式 (IMMessage) |
| P0 | 抽象 IM 适配器接口 (IMAdapter) |
| P0 | 重构现有 StupidIM 适配器 |
| P0 | 重构现有 Telegram 适配器 |
| P1 | 支持消息类型的统一处理（文字、图片、文件、引用） |
| P1 | 支持 Action 的统一处理（typing、mark read） |
| P2 | 新增 IM 平台时只需实现适配器，无需改动核心 |

### 技术方案

#### 架构设计

```
┌─────────────────────────────────────────────────────────┐
│                      核心层 (Core)                       │
│  - 业务逻辑处理                                          │
│  - Agent 调用                                            │
│  - 消息路由                                               │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │ IMMessage (统一格式)
                            │
┌─────────────────────────────────────────────────────────┐
│                    IM 抽象层 (IM Layer)                  │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │  IMAdapter      │  │  IMAdapter     │  ...         │
│  │  (接口定义)     │  │  (接口定义)    │               │
│  └────────┬────────┘  └────────┬────────┘               │
│           │                     │                         │
│  ┌────────▼────────┐  ┌────────▼────────┐               │
│  │  StupidIM       │  │  Telegram        │               │
│  │  Adapter        │  │  Adapter         │               │
│  └─────────────────┘  └─────────────────┘               │
└─────────────────────────────────────────────────────────┘
```

#### 统一消息格式（使用 Discriminated Unions）

```typescript
// ============ 基础类型 ============
interface BaseMessage {
  id: string;
  chatId: string;
  timestamp: number;
  sender: {
    id: string;
    name?: string;
    type: 'user' | 'agent' | 'system';
  };
}

// ============ 附件类型 ============
type Attachment =
  | { type: 'image'; urlOrPath: string; name?: string }
  | { type: 'file'; urlOrPath: string; name?: string }
  | { type: 'local_path'; urlOrPath: string; name?: string };

// ============ 可辨识联合类型 (Discriminated Unions) ============
type IMMessage = BaseMessage & (
  | {
      type: 'text';
      content: {
        text: string;
        attachments?: Attachment[];
        quoteId?: string;
      };
    }
  | {
      type: 'thought';
      content: {
        text: string; // Agent 正在思考的碎碎念
      };
    }
  | {
      type: 'tool_call';
      content: {
        toolName: string;
        toolInput: Record<string, any>;
      };
    }
  | {
      type: 'tool_result';
      content: {
        toolName: string;
        summary: string;
        isError?: boolean;
      };
    }
);

// ============ 适配器接口 ============
interface IMAdapter {
  // 发送消息
  sendMessage(chatId: string, message: IMMessage): Promise<void>;

  // 发送 Action（如 typing）
  sendAction(chatId: string, action: 'typing' | 'mark_read'): Promise<void>;

  // 处理收到的消息
  onMessage(handler: (message: IMMessage) => void): void;

  // 处理 Action
  onAction(handler: (chatId: string, action: string) => void): void;
}
```

**使用 Discriminated Unions 的好处**：
- 前端渲染时可以根据 `message.type` 自动推导正确的 `content` 结构
- TypeScript 类型检查更严格，避免访问不存在的字段
- 代码更清爽，US-004 和 US-006 的需求完美整合

#### 文件传输模式区分（重要！）

必须明确区分两种文件模式，避免用户和大模型混淆：

| 模式 | 类型 | 说明 | 示例 |
|------|------|------|------|
| **传引用 (local_path)** | 路径指针 | 用户从文件浏览器选择 workspace 文件，只需发送路径，Agent 依靠本地权限自己去读 | `/.stupidClaw/workspace/doc.txt` |
| **传内容 (file)** | 硬拷贝 | 用户从手机相册上传截图，必须转成 Base64 或临时 URL 塞进 Prompt | `data:image/png;base64,...` |

#### 适配器实现要点

| 平台 | 支持的功能 |
|------|-----------|
| StupidIM (Web) | 文字、图片、文件、引用、typing、Markdown 渲染 |
| Telegram | 文字、图片、文件、引用、typing、mark read（Markdown 有截断限制） |

### 验收标准

- [ ] 定义统一的 IMMessage 格式
- [ ] 抽象出 IMAdapter 接口
- [ ] StupidIM 适配器实现 IMAdapter 接口
- [ ] Telegram 适配器实现 IMAdapter 接口
- [ ] 新增一个简单 IM 平台只需实现适配器

### 风险与约束

- 不同 IM 平台的能力差异较大，完全抹平需要做功能降级
- 现有代码迁移需要较多改动，建议逐步重构

---

## US-001: IM 文件浏览器功能

### 背景

当前 StupidIM (Web IM) 仅支持简单的文字对话，无法查看和操作电脑上的文件系统。用户希望能够在 IM 中方便地查看 `.stupidClaw/workspace` 目录下的文件，并与 Agent 交互。

### 目标用户

- 需要通过手机/平板等移动设备与本地 Agent 交互的用户
- 希望在 IM 中直接查看和操作 workspace 文件的用户

### 功能需求

| 优先级 | 需求描述 |
|--------|----------|
| P0 | 底部弹窗 (Bottom Sheet) 形式展示文件选择器（移动端友好） |
| P0 | 快捷面板展示"最近文件"（Agent 最近修改的 5 个文件） |
| P0 | 支持多选文件，选中后发送到聊天上下文 |
| P0 | Agent 修改 workspace 文件后，IM 实时收到通知 |
| P0 | 支持上传本地文件到 workspace（传内容模式） |
| P0 | 聊天消息中的路径可点击，点击后预览文件 |
| P0 | IM 启动后自动拉取历史消息目录 |
| P0 | 支持按天查看历史对话，多选对话作为上下文发给 Agent |
| P0 | Token 估算器：显示当前上下文 token 占比，进度条变红时禁止添加 |
| P0 | 文件修改差异对比 (Diff View)：Git Diff 风格展示修改内容 |
| P1 | 在 IM 中预览图片文件 |
| P1 | 在 IM 中预览 PDF 文档 |
| P2 | 支持多级目录浏览 |
| P2 | 文件搜索功能 |

### 技术方案

#### 整体架构

```
┌─────────────────┐     WebSocket      ┌─────────────────┐
│   Web 前端 (im.html) │◄──────────────►│  Node.js 后端   │
│  - 文件浏览器面板  │                  │  - 文件列表 API │
│  - 多选发送       │                  │  - 文件上传     │
│  - 预览图片/PDF  │                  │  - 目录监控     │
└─────────────────┘                  └─────────────────┘
```

#### 前端 UI 设计 (`public/im.html`)

1. **输入框 + 底部弹窗入口**
   ```
   ┌─────────────────────────────────────────────────┐
   │              聊天消息区域                        │
   │                                                 │
   ├─────────────────────────────────────────────────┤
   │ [Token 估算器: ████████░░ 60%]                  │
   │ [已选文件: doc.txt, app.js x]                   │
   │ [引用: "请帮我看看..." x]                        │
   ├─────────────────────────────────────────────────┤
   │ [+] [输入框...]                          [发送] │
   └─────────────────────────────────────────────────┘

   点击 [+] → 底部弹窗 (Bottom Sheet):
   ┌─────────────────────────────────────────────────┐
   │  ──────  (拖动手柄)                              │
   │  [最近文件]  [workspace]  [历史消息]  [上传]      │
   ├─────────────────────────────────────────────────┤
   │  最近文件 (Agent 最近修改):                       │
   │  □ result.png      2分钟前                        │
   │  □ analysis.py    5分钟前                        │
   │  □ README.md      10分钟前                       │
   └─────────────────────────────────────────────────┘
   ```

2. **底部弹窗 (Bottom Sheet) 设计**
   - **拖动手柄**：顶部可拖动，类似微信/小红书
   - **Tab 切换**：`最近文件` | `workspace` | `历史消息` | `上传`
   - **最近文件 (Recent Files)**：Agent 最近修改的 5 个文件，移动端优先展示
   - **workspace**：目录树展示，支持多选
   - **历史消息**：按天查看对话
   - **上传**：选择本地文件上传（传内容模式）

3. **Token 估算器**
   - 位于输入框上方，显示当前上下文 token 占比
   - **显示绝对数值**：`65k / 128k`（高级用户关心具体剩余量）
   - 简单估算：1 汉字 ≈ 1.5 token，1 英文 ≈ 1 token
   - 进度条：绿色 (<60%) → 黄色 (60-80%) → 红色 (>80%)
   - 进度条变红时，禁止添加更多文件，提示"上下文过长"
   - **可配置 max_tokens**：允许用户在配置中设置当前模型的上下文上限
     - 例如：Claude 3.5 = 200k，GPT-4o = 128k

4. **文件上传功能**
   - 点击"上传"Tab，选择本地文件
   - 支持拖拽上传
   - 支持粘贴剪贴板图片
   - 上传到 workspace 指定目录（传内容模式）

#### 后端改动 (`src/transport/stupid-im.ts`)

1. **文件列表接口**
   - 添加 WebSocket 命令 `!files` 或 HTTP API `/api/files?dir=xxx`
   - 返回 `.stupidClaw/workspace` 目录下的文件列表

2. **文件上传接口**
   - 添加 HTTP API `POST /api/upload`
   - 将上传文件保存到 workspace

3. **文件内容服务**
   - 添加 HTTP API `/api/file?path=xxx` 用于读取文件内容
   - 支持图片、PDF 等二进制文件

4. **目录监控**
   - 使用 `chokidar` 监听 workspace 目录变化
   - 文件变更时通过 WebSocket 推送给前端

5. **历史消息接口**
   - 扫描 `.stupidClaw/history/` 目录，获取按日期的 jsonl 文件列表
   - 提供 API 读取指定日期的对话记录
   - 格式：`/.stupidClaw/history/2026-03-10.jsonl`

#### 路径识别与预览

1. **路径识别**
   - 监听聊天消息渲染，识别以 `.stupidClaw/` 开头的路径
   - 或识别特殊标记格式：`[文件名](/.stupidClaw/workspace/xxx)`
   - 将路径转换为可点击的链接

2. **点击预览**
   - 点击路径后，调用后端 `/api/file?path=xxx` 获取内容
   - 图片：直接显示
   - PDF：用 iframe/pdf.js 预览
   - 文本：显示文本内容

#### 历史消息功能

1. **历史消息目录**
   - IM 连接成功后，自动获取 `/.stupidClaw/history/` 下的日期列表
   - 显示格式：`2026-03-10`, `2026-03-11`, ...

2. **日期面板**
   - 点击日期展开该天的对话列表
   - 每条对话显示：时间 + 首条消息摘要
   - 支持多选对话

3. **发送到聊天**
   - 选中对话后，格式化内容发送到当前聊天
   - 格式示例：
     ```
     --- 以下是历史对话 ---
     [2026-03-10 14:30] 用户: 请帮我看看这个文件
     [2026-03-10 14:31] Agent: 好的，我来看一下...
     ---
     ```

4. **JSONL 格式**
   - 每行一个 JSON 对象：
     ```json
     {"timestamp": 1710052200000, "role": "user", "content": "请帮我看看这个文件"}
     {"timestamp": 1710052260000, "role": "assistant", "content": "好的，我来看一下..."}
     ```

#### 文件修改差异对比 (Diff View)

当 Agent 修改了 workspace 中的文件时，后端计算差异并推送 Diff 卡片：

1. **Diff 计算**
   - 使用 `diff` 算法计算文本文件的差异
   - 只对文本文件（代码、文档）生成 Diff
   - 二进制文件（图片、PDF）不生成 Diff
   - **⚠️ 性能保护锁**：只对 **小于 100KB** 的文本文件计算 Diff
     - 超过限制的文件：只提示 `[文件已修改]`，不展示 Diff 卡片
     - 原因：5MB 的 `package-lock.json` 或混淆后的 `app.min.js` 会让 Node.js CPU 100% 或浏览器卡死

2. **Diff 卡片展示**
   ```
   ┌─────────────────────────────────────────┐
   │ 📝 app.js 已修改                         │
   │ ───────────────────────────────────────│
   │ - const oldValue = 1;                  │ (删除-红色)
   │ + const newValue = 2;                  │ (新增-绿色)
   │ - console.log(oldValue);               │ (删除-红色)
   │ + console.log('debug:', newValue);     │ (新增-绿色)
   │                                          │
   │ [预览文件] [接受]                         │
   └─────────────────────────────────────────┘
   ```
   - 绿色：新增内容
   - 红色：删除内容
   - 点击"预览文件"可查看完整文件

### 验收标准

- [ ] 底部弹窗 (Bottom Sheet) 形式展示文件选择器
- [ ] 快捷面板展示"最近文件"
- [ ] 用户可以多选文件并发送到聊天
- [ ] Agent 修改 workspace 文件后，IM 显示 Diff 卡片
- [ ] 用户可以上传本地文件到 workspace
- [ ] 聊天消息中的 `.stupidClaw/` 路径可点击
- [ ] 点击路径可以预览文件（图片/PDF/文本）
- [ ] IM 启动后自动拉取历史消息日期列表
- [ ] 可以按天查看历史对话
- [ ] 可以多选历史对话作为上下文发送
- [ ] Token 估算器正常工作，显示绝对数值 (如 65k/128k)
- [ ] Token 估算器进度条变红时禁止添加
- [ ] 断开重连后文件列表自动刷新

### 风险与约束

- Web 端无法直接读取本地文件系统，必须通过后端服务
- 大文件预览需要考虑性能问题
- 目录监控需要注意避免频繁推送
- 历史消息文件可能较大，需要分页或懒加载
- 路径识别需要考虑安全，避免路径穿越攻击

---

## US-002: 图片/文件消息支持

### 背景

用户希望能够发送图片和文件给 Agent 进行分析，同时也需要能够接收 Agent 返回的文件。当前仅支持文字对话。

### 目标用户

- 使用视觉模型（如 GPT-4V、Claude Vision）的用户
- 需要和 Agent 双向传输文件的用户

### 功能需求

| 优先级 | 需求描述 |
|--------|----------|
| P0 | 用户可以上传/发送图片给 Agent |
| P0 | 用户可以上传/发送文件给 Agent |
| P0 | Agent 可以发送图片/文件给用户 |
| P0 | 图片/文件消息在聊天中正确展示 |
| P1 | 支持拖拽上传 |
| P1 | 支持粘贴剪贴板图片 |
| P2 | 支持多文件同时发送 |

### 技术方案

#### 消息流程

```
用户上传图片 → 后端保存 → 返回 URL/ID → 发送给 Agent → Agent 回复
                                                                   ↓
用户查看 ← 后端提供文件服务 ← Agent 返回文件 URL ← 处理 Agent 回复
```

#### 前端改动 (`public/im.html`)

1. **上传组件**
   - 添加上传按钮（支持图片和文件）
   - 支持拖拽上传
   - 支持粘贴剪贴板图片

2. **消息展示**
   - 图片：缩略图显示，点击查看大图
   - 文件：文件名 + 文件图标 + 下载按钮
   - 支持点击预览

#### 后端改动

1. **文件接收**
   - WebSocket 支持二进制消息
   - 或 HTTP API 上传接口

2. **文件存储**
   - 保存到临时目录或 workspace
   - 生成唯一 ID 和 URL

3. **模型调用**
   - 将图片/文件以合适的方式传给模型（URL 或 Base64）

### 验收标准

- [ ] 用户可以上传图片并发送给 Agent
- [ ] 用户可以上传文件并发送给 Agent
- [ ] Agent 能够识别图片/文件内容并回复
- [ ] Agent 可以发送图片/文件给用户
- [ ] 双向文件传输正常工作

### 风险与约束

- 需要确认当前使用的模型是否支持视觉能力
- 大文件需要压缩处理以减少 Token 消耗
- 需要清理临时文件

---

## US-003: 消息引用功能

### 背景

用户希望能够引用之前的聊天内容，让 Agent 更清楚地理解上下文。例如："请继续修改你上次提到的那个文件" 或 "基于刚才的分析结果帮我优化代码"。

### 目标用户

- 需要在长对话中引用上下文的用户
- 希望让 Agent 更准确理解意图的用户

### 功能需求

| 优先级 | 需求描述 |
|--------|----------|
| P0 | 左滑引用 (Swipe to Reply)：移动端通用交互，向左滑动消息即可引用 |
| P0 | PC 端支持右键/长按点击消息，选择"引用" |
| P0 | 引用消息以 Quote 形式展示在输入框上方 |
| P0 | 发送消息时同时带上引用的消息内容 |
| P1 | 支持引用多条消息 |
| P2 | 支持引用文件（引用 US-001 中的文件） |

### 技术方案

#### 前端改动 (`public/im.html`)

1. **引用交互**
   - **移动端：左滑引用 (Swipe to Reply)**
     - 按住消息向左滑动，触发引用
     - 类似 Telegram、微信、WhatsApp 的交互
     - 滑动距离超过阈值后松手，输入框进入引用模式
   - **PC 端：右键/长按菜单**
     - 右键点击消息弹出菜单
     - 选择"引用"选项
   - 选中"引用"后，输入框上方显示引用内容
   - 引用内容可取消（点击 X 按钮）

2. **引用展示**
   - 引用消息以折叠形式展示（显示首行或摘要）
   - 点击可展开查看完整引用
   - 样式：
     ```
     ┌─────────────────────────────────────┐
     │ > 引用: "请帮我看看这个文件..."     x │
     ├─────────────────────────────────────┤
     │ [输入框...]                         │
     └─────────────────────────────────────┘
     ```

3. **消息数据结构**
   ```typescript
   interface Message {
     id: string;
     text: string;
     sender: 'user' | 'bot';
     quote?: {
       messageId: string;
       preview: string; // 引用消息的预览
     };
   }
   ```

#### 后端改动

1. **引用消息处理**
   - 解析消息中的引用信息
   - 将引用内容拼接为 Prompt 的一部分
   - 格式示例：`> [引用用户消息]: 这是一段引用内容\n\n 用户新消息`

### 验收标准

- [ ] 用户可以引用之前的消息
- [ ] 引用的消息在输入框上方正确显示
- [ ] Agent 能够感知到引用内容并正确回复
- [ ] 可以取消引用

### 风险与约束

- 引用内容会增加 Token 消耗，需要考虑限制引用长度
- 引用已删除的消息需要处理边界情况

---

## US-005: Markdown 消息渲染

### 背景

Agent 返回的消息通常包含 Markdown 格式（代码块、链接、列表等）。StupidIM 需要支持 Markdown 渲染，而 Telegram 由于平台限制需要做特殊处理。

### 目标用户

- 希望获得更好阅读体验的用户
- 需要查看 Agent 返回代码的用户

### 功能需求

| 优先级 | 需求描述 |
|--------|----------|
| P0 | StupidIM 支持 Markdown 渲染 |
| P0 | 支持代码块高亮 |
| P0 | 支持链接、图片、列表等 |
| P0 | Telegram 使用 HTML 模式（而非 MarkdownV2） |
| P0 | Telegram 长消息分段发送（4096 字符限制） |
| P2 | 代码块支持复制功能 |

### 技术方案

#### StupidIM 前端改动

1. **引入 Markdown 渲染库**
   - 使用 `marked` 或 `markdown-it`
   - 使用 `highlight.js` 做代码高亮

2. **消息渲染**
   - 将 bot 消息以 Markdown 格式渲染
   - 用户消息保持纯文本
   - 需要防止 XSS：使用 DOMPurify 过滤

#### Telegram 处理（重要！）

1. **放弃 MarkdownV2，改用 HTML 模式**
   - **血泪教训**：Telegram 的 `MarkdownV2` 对转义字符（`.` `-` `+` `(` `)` 等）要求极其变态！
   - 大模型生成的 Markdown 中包含大量这些字符，正则转义稍有不慎就会 `400 Bad Request` 并**丢弃整条消息**
   - **解决方案**：将 Markdown 转成 HTML，使用 `parse_mode: 'HTML'`
   - 只需要过滤掉 Telegram 不支持的 HTML 标签（如 `<script>`），稳定性提升 100 倍

2. **消息截断问题（⚠️ 隐形杀手）**
   - Telegram 对消息长度有限制（4096 字符）
   - **坑点**：如果粗暴按 4000 字符切断字符串，可能正好切在 HTML 标签中间！
     - 例如：第一段以 `<a href="htt` 结尾，第二段以 `p://xxx">链接</a>` 开头
     - 这会导致两段 HTML 都不完整，Telegram 报 `400 Bad Request: can't parse entities`
   - **解决方案**：**切分 Markdown 字符串**（寻找最近的 `\n\n` 换行符），切分完后再分别转成 HTML 发送

   ```typescript
   // 安全切分 Markdown
   function splitMarkdown(markdown: string, maxLen: number = 3800): string[] {
     const paragraphs = markdown.split(/\n\n+/);
     const chunks: string[] = [];
     let current = '';

     for (const p of paragraphs) {
       if ((current + '\n\n' + p).length > maxLen) {
         if (current) chunks.push(current);
         current = p;
       } else {
         current = current ? current + '\n\n' + p : p;
       }
     }
     if (current) chunks.push(current);
     return chunks;
   }

   // 逐段发送
   for (const chunk of splitMarkdown(markdown)) {
     await sendMessage(chatId, toTelegramHTML(chunk));
   }
   ```

3. **HTML 到 Telegram HTML 的转换**
   ```typescript
   // Markdown → HTML → Telegram HTML
   function toTelegramHTML(markdown: string): string {
     // 1. Markdown → HTML (使用 marked)
     const html = marked.parse(markdown);

     // 2. HTML → Telegram HTML
     return html
       .replace(/<pre><code class="(\w+)">/g, '<pre><code>') // 去掉语言 class
       .replace(/<\/code><\/pre>/g, '</code></pre>')
       .replace(/<a href="([^"]+)">([^<]+)<\/a>/g, '<a href="$1">$2</a>') // 保留链接
       .replace(/<[^>]+>/g, ''); // 去掉其他不支持的标签
   }
   ```

### 验收标准

- [ ] StupidIM 中 Agent 消息正确渲染 Markdown
- [ ] 代码块有语法高亮
- [ ] Telegram 使用 HTML 模式发送消息
- [ ] Telegram 长消息分段发送，不丢失内容
- [ ] XSS 防护正常工作

### 风险与约束

- Telegram 平台限制较多，需要降级处理
- HTML 模式对代码块支持不如 Markdown，需要测试

---

## US-006: Agent 思考与动作状态可视化

### 背景

Agent 和普通人的最大区别是：**Agent 会思考、会调用工具（操作电脑）、会持续修改文件**。当用户让 Agent "帮我分析一下 workspace 里的日志并生成图表"时，Agent 可能会执行：读文件 -> 思考 -> 写代码 -> 报错 -> 修改代码 -> 返回图表。这个过程可能长达 1-2 分钟。

如果只用传统 IM 的纯文本回复，体验会很像**盲盒**——用户不知道 Agent 正在做什么。

### 目标用户

- 需要了解 Agent 工作状态的用户
- 想要追踪 Agent 操作过程的用户
- 希望在使用长期上下文时知道 Agent 进度的用户

### 功能需求

| 优先级 | 需求描述 |
|--------|----------|
| P0 | Agent 思考中 (Thinking)：显示"正在思考"状态 |
| P0 | Agent 调用工具 (Tool Calling)：显示正在调用的工具名称和输入 |
| P0 | 工具执行结果：显示工具返回结果摘要 |
| P0 | 状态消息以灰色小字渲染，可折叠/展开 |
| P1 | Agent 错误状态：显示错误信息和建议 |
| P2 | 支持语音播报（可选） |

### 技术方案

#### IMMessage 结构扩展

```typescript
// Agent 专属消息类型
type MessageType = 'text' | 'thought' | 'tool_call' | 'tool_result';

interface AgentMessage {
  type: 'thought' | 'tool_call' | 'tool_result';
  agentState: 'thinking' | 'tool_calling' | 'idle';
  toolName?: string;        // 工具名称，如 "readFile"
  toolInput?: any;         // 工具输入参数
  toolOutput?: any;        // 工具输出（摘要）
  content: string;         // 状态描述文字
}
```

#### 前端渲染设计

```
用户消息: "帮我分析一下日志"

[Agent 状态消息 - 可折叠]
🔄 *[Agent 正在读取 logs.txt...]*
🔄 *[Agent 正在分析数据...]*

[Agent 消息 - 已折叠]
📊 *Agent: 分析完成！图表如下...*
(点击可展开查看思考过程)
```

#### 状态类型说明

| 状态 | 图标 | 示例 |
|------|------|------|
| thinking | 🔄 | "Agent 正在思考..." |
| tool_calling | 🔧 | "Agent 正在调用 readFile..." |
| tool_result | ✅ | "readFile 返回 150 行" |
| error | ❌ | "执行失败: 文件不存在" |

#### 折叠/展开逻辑

- 默认折叠：避免刷屏，用户只看结果
- 点击展开：查看详细过程
- 自动折叠：新消息来临时折叠旧状态
- 保留最近 5 条状态，其他自动隐藏

### 验收标准

- [ ] Agent 思考时显示状态消息
- [ ] Agent 调用工具时显示工具名称和输入
- [ ] 工具执行结果显示摘要
- [ ] 状态消息默认折叠，点击可展开
- [ ] 状态消息以灰色小字渲染

### 风险与约束

- 状态消息可能刷屏，需要限制显示数量
- 工具输入/输出可能很大，需要截断或摘要
- 并行工具调用需要正确处理

---

## 待补充

> TODO: 后续补充更多用户故事...

