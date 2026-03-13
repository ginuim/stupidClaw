# 模型配置指南

本文说明如何配置 StupidClaw 使用的大语言模型。

StupidClaw 基于 `pi-mono` 底座，底座内置了对主流云端供应商的支持，并通过 `models.json` 文件支持本地模型和任意兼容 OpenAI / Anthropic 规范的服务。

---

## 配置格式 `STUPID_MODEL`

在 `.env` 中，通过一个变量选择当前使用的模型：

```
STUPID_MODEL=provider:model_id
```

- `provider` 是供应商标识符（见下方完整列表）
- `model_id` 是该供应商下的模型 ID

**示例：**

```dotenv
STUPID_MODEL=minimax:MiniMax-M2.5
STUPID_MODEL=openai:gpt-4o
STUPID_MODEL=anthropic:claude-3-5-sonnet-20241022
STUPID_MODEL=ollama:llama3.1:8b
```

> 注意：如果模型 ID 本身带冒号（如 Ollama 的 `llama3.1:8b`），整体写法为 `ollama:llama3.1:8b`，代码会以第一个冒号为分界点拆分，因此 provider 为 `ollama`，model_id 为 `llama3.1:8b`。

如果不填 `STUPID_MODEL`，且检测到 `MINIMAX_API_KEY`，默认使用 `MiniMax-M2.5`。

---

## 支持的云端供应商

### pi-mono 原生内置

以下供应商由 pi-mono 底层直接支持，只需填写对应 API Key 即可使用。

| 供应商标识符 (provider) | 供应商名称 | 需要的环境变量 |
| :--- | :--- | :--- |
| `anthropic` | Anthropic (Claude) | `ANTHROPIC_API_KEY` |
| `openai` | OpenAI (GPT) | `OPENAI_API_KEY` |
| `google` | Google Gemini | `GEMINI_API_KEY` |
| `mistral` | Mistral AI | `MISTRAL_API_KEY` |
| `groq` | Groq | `GROQ_API_KEY` |
| `cerebras` | Cerebras | `CEREBRAS_API_KEY` |
| `xai` | xAI (Grok) | `XAI_API_KEY` |
| `openrouter` | OpenRouter（聚合平台） | `OPENROUTER_API_KEY` |
| `huggingface` | Hugging Face | `HF_TOKEN` |
| `minimax` | MiniMax (国际站) | `MINIMAX_API_KEY` |
| `minimax-cn` | MiniMax (国内站) | `MINIMAX_CN_API_KEY` |

### StupidClaw 扩展支持

以下供应商通过 StupidClaw 在启动时自动注册，同样只需填写 API Key 即可直接使用。

| 供应商标识符 (provider) | 供应商名称 | 需要的环境变量 |
| :--- | :--- | :--- |
| `deepseek` | DeepSeek 官方 | `DEEPSEEK_API_KEY` |
| `kimi` | Kimi / Moonshot AI | `MOONSHOT_API_KEY` |
| `dashscope` | 阿里云 DashScope (Qwen) | `DASHSCOPE_API_KEY` |
| `bigmodel` | 智谱 bigmodel.cn (GLM) | `ZHIPU_API_KEY` |

**配置示例（选一个填即可）：**

```dotenv
# 使用 Anthropic Claude
STUPID_MODEL=anthropic:claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=sk-ant-xxxx

# 使用 OpenAI GPT-4o
STUPID_MODEL=openai:gpt-4o
OPENAI_API_KEY=sk-xxxx

# 使用 Groq（速度极快，免费额度充裕）
STUPID_MODEL=groq:llama-3.3-70b-versatile
GROQ_API_KEY=gsk_xxxx

# 使用 DeepSeek 官方
STUPID_MODEL=deepseek:deepseek-chat
DEEPSEEK_API_KEY=sk-xxxx

# 使用 Kimi（Moonshot AI）
STUPID_MODEL=kimi:moonshot-v1-128k
MOONSHOT_API_KEY=sk-xxxx

# 使用阿里云 DashScope（Qwen）
STUPID_MODEL=dashscope:qwen-max
DASHSCOPE_API_KEY=sk-xxxx

# 使用智谱 GLM
STUPID_MODEL=bigmodel:glm-4-flash
ZHIPU_API_KEY=xxxx

# 通过 OpenRouter 使用聚合模型（含 DeepSeek R1、Kimi K2 等）
STUPID_MODEL=openrouter:deepseek/deepseek-r1
OPENROUTER_API_KEY=sk-or-xxxx
```

---

## 云端特殊配置

### Amazon Bedrock

不需要 API Key，使用 AWS 身份认证：

```dotenv
# 方式一：AWS Profile
AWS_PROFILE=your-profile

# 方式二：IAM 密钥
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# 可选（默认 us-east-1）
AWS_REGION=us-west-2
```

然后在 `STUPID_MODEL` 里填：

```dotenv
STUPID_MODEL=amazon-bedrock:us.anthropic.claude-sonnet-4-20250514-v1:0
```

### Azure OpenAI

```dotenv
AZURE_OPENAI_API_KEY=...
AZURE_OPENAI_BASE_URL=https://your-resource.openai.azure.com
# 可选
AZURE_OPENAI_API_VERSION=2024-02-01
```

```dotenv
STUPID_MODEL=azure-openai-responses:gpt-4o
```

### Google Vertex AI

```bash
gcloud auth application-default login
export GOOGLE_CLOUD_PROJECT=your-project
export GOOGLE_CLOUD_LOCATION=us-central1
```

```dotenv
STUPID_MODEL=google-vertex:gemini-1.5-pro
```

---

## 本地模型（Ollama / LM Studio / vLLM）

本地模型需要通过 **`~/.pi/agent/models.json`** 文件注册，不能直接通过 `.env` 配置。

### 第一步：创建 models.json

创建或编辑 `~/.pi/agent/models.json`：

```bash
mkdir -p ~/.pi/agent
```

**Ollama 示例：**

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "llama3.1:8b" },
        { "id": "qwen2.5-coder:7b" }
      ]
    }
  }
}
```

> Ollama 需要 API Key 字段，但实际上忽略它，填任意值即可。

**LM Studio 示例：**

```json
{
  "providers": {
    "lmstudio": {
      "baseUrl": "http://localhost:1234/v1",
      "api": "openai-completions",
      "apiKey": "lm-studio",
      "models": [
        { "id": "qwen2.5-coder-7b-instruct" }
      ]
    }
  }
}
```

**vLLM 示例：**

```json
{
  "providers": {
    "vllm": {
      "baseUrl": "http://localhost:8000/v1",
      "api": "openai-completions",
      "apiKey": "VLLM_API_KEY",
      "models": [
        { "id": "Qwen/Qwen2.5-Coder-7B-Instruct" }
      ]
    }
  }
}
```

### 第二步：在 .env 中选择模型

```dotenv
STUPID_MODEL=ollama:llama3.1:8b
# 或
STUPID_MODEL=lmstudio:qwen2.5-coder-7b-instruct
```

---

## 自定义兼容接口

如果你有自己的 OpenAI 或 Anthropic 兼容服务（如企业私有部署、API 中转站），有两种接入方式。

### 方式一：通过 `npx stupid-claw init` 向导配置

运行初始化向导时，选择"自定义 OpenAI 兼容接口"或"自定义 Anthropic 兼容接口"，向导会依次提示输入 Base URL 和 API Key，并自动写入 `.env`：

```dotenv
STUPID_MODEL=custom-openai:gpt-4o
CUSTOM_OPENAI_API_KEY=sk-xxxx
CUSTOM_OPENAI_BASE_URL=https://api.my-company.com/v1
```

Anthropic 兼容同理：

```dotenv
STUPID_MODEL=custom-anthropic:claude-3-5-sonnet-20241022
CUSTOM_ANTHROPIC_API_KEY=xxxx
CUSTOM_ANTHROPIC_BASE_URL=https://proxy.example.com
```

### 方式二：通过 `~/.pi/agent/models.json` 配置

适合需要精细控制模型元数据（context window、cost 等）的场景：

```json
{
  "providers": {
    "my-proxy": {
      "baseUrl": "https://api.my-company.com/v1",
      "api": "openai-completions",
      "apiKey": "MY_API_KEY",
      "models": [
        {
          "id": "gpt-4o",
          "name": "GPT-4o (企业中转)"
        }
      ]
    }
  }
}
```

```dotenv
STUPID_MODEL=my-proxy:gpt-4o
MY_API_KEY=xxxx
```

如果服务使用 Anthropic 规范，将 `"api"` 改为 `"anthropic-messages"` 即可。
