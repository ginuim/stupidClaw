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

## 内置云端供应商

以下供应商已内置在 pi-mono 中，只需填写对应 API Key 即可直接使用。

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
| `kimi-coding` | Kimi for Coding | `KIMI_API_KEY` |
| `minimax` | MiniMax (国际站) | `MINIMAX_API_KEY` |
| `minimax-cn` | MiniMax (国内站) | `MINIMAX_CN_API_KEY` |
| `vercel-ai-gateway` | Vercel AI Gateway | `AI_GATEWAY_API_KEY` |
| `zai` | ZAI | `ZAI_API_KEY` |

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

# 通过 OpenRouter 使用 DeepSeek（DeepSeek 无内置 provider，推荐走这条路）
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

## 其他符合 OpenAI 规范的自定义服务

如果你的模型服务提供了兼容 OpenAI 的接口（如企业私有部署、API 中转站等），同样通过 `models.json` 配置：

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

`.env` 中选择：

```dotenv
STUPID_MODEL=my-proxy:gpt-4o
MY_API_KEY=xxxx
```

如果服务使用 Anthropic 规范：

```json
{
  "providers": {
    "my-anthropic-proxy": {
      "baseUrl": "https://proxy.example.com",
      "api": "anthropic-messages",
      "apiKey": "MY_PROXY_KEY",
      "models": [
        { "id": "claude-3-5-sonnet-20241022" }
      ]
    }
  }
}
```

---

## 为什么 DeepSeek 没有内置 provider？

pi-mono 内置的 provider 列表是官方维护的，DeepSeek 目前没有直接列入。有两种方法使用 DeepSeek：

**方法一（推荐）：通过 OpenRouter**

OpenRouter 接入了 DeepSeek 等几乎所有主流模型，申请一个 OpenRouter Key 即可：

```dotenv
STUPID_MODEL=openrouter:deepseek/deepseek-r1
OPENROUTER_API_KEY=sk-or-xxxx
```

**方法二：通过 models.json 配置 DeepSeek 官方接口**

DeepSeek 提供兼容 OpenAI 的接口：

```json
{
  "providers": {
    "deepseek": {
      "baseUrl": "https://api.deepseek.com/v1",
      "api": "openai-completions",
      "apiKey": "DEEPSEEK_API_KEY",
      "models": [
        { "id": "deepseek-chat" },
        { "id": "deepseek-reasoner" }
      ]
    }
  }
}
```

```dotenv
STUPID_MODEL=deepseek:deepseek-chat
DEEPSEEK_API_KEY=sk-xxxx
```
