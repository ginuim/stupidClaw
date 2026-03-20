import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  PROVIDERS,
  getProviderDef,
  getProviderModels,
  createDefaultConfig,
  createProviderConfig,
  type AppConfig,
} from "./providers";

// 全局状态
let ws: WebSocket | null = null;
let isConnected = false;
let currentChatId = `desktop_${Date.now()}`;
let config: AppConfig = createDefaultConfig();
let editingProviderId: string | null = null;

const WS_TOKEN = "stupid-claw-desktop-token";
const WS_URL = "ws://localhost:8080";
const STORAGE_KEY = "stupidclaw_config";

// DOM 元素
const chatWindow = document.getElementById("chatWindow") as HTMLDivElement;
const messageInput = document.getElementById("messageInput") as HTMLTextAreaElement;
const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
const backendStatus = document.getElementById("backendStatus") as HTMLSpanElement;
const settingsPanel = document.getElementById("settingsPanel") as HTMLDivElement;
const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement;
const closeSettings = document.getElementById("closeSettings") as HTMLButtonElement;
const saveSettings = document.getElementById("saveSettings") as HTMLButtonElement;
const minimizeBtn = document.getElementById("minimizeBtn") as HTMLButtonElement;
const closeBtn = document.getElementById("closeBtn") as HTMLButtonElement;

// 标签页
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");

// 添加供应商弹窗
const addProviderModal = document.getElementById("addProviderModal") as HTMLDivElement;
const addProviderBtn = document.getElementById("addProviderBtn") as HTMLButtonElement;
const closeModal = document.getElementById("closeModal") as HTMLButtonElement;
const cancelAddProvider = document.getElementById("cancelAddProvider") as HTMLButtonElement;
const confirmAddProvider = document.getElementById("confirmAddProvider") as HTMLButtonElement;
const providerSelect = document.getElementById("providerSelect") as HTMLSelectElement;

// 编辑供应商弹窗
const editProviderModal = document.getElementById("editProviderModal") as HTMLDivElement;
const closeEditModal = document.getElementById("closeEditModal") as HTMLButtonElement;
const cancelEditProvider = document.getElementById("cancelEditProvider") as HTMLButtonElement;
const confirmEditProvider = document.getElementById("confirmEditProvider") as HTMLButtonElement;
const deleteProviderBtn = document.getElementById("deleteProviderBtn") as HTMLButtonElement;
const editProviderName = document.getElementById("editProviderName") as HTMLDivElement;
const editApiKey = document.getElementById("editApiKey") as HTMLInputElement;
const editBaseUrl = document.getElementById("editBaseUrl") as HTMLInputElement;
const editModelSelect = document.getElementById("editModelSelect") as HTMLSelectElement;
const editCustomModel = document.getElementById("editCustomModel") as HTMLInputElement;
const apiKeyItem = document.getElementById("apiKeyItem") as HTMLDivElement;
const baseUrlItem = document.getElementById("baseUrlItem") as HTMLDivElement;
const customModelItem = document.getElementById("customModelItem") as HTMLDivElement;

// 通用配置
const portInput = document.getElementById("portInput") as HTMLInputElement;

// 初始化
async function init() {
  loadConfig();
  initProviderSelect();
  renderProvidersList();
  renderActiveProvider();
  updateGeneralSettings();

  // 启动后端并连接 WebSocket
  try {
    const imUrl: string = await invoke("start_backend");
    console.log("StupidIM URL:", imUrl);
    
    // 显示 StupidIM 网页端连接入口
    const imLink = document.getElementById("imWebUrl") as HTMLAnchorElement;
    if (imLink) {
      imLink.href = imUrl;
      imLink.textContent = "打开网页 IM";
      imLink.style.display = "inline-block";
    }
    
    setTimeout(connectWebSocket, 2000);
  } catch (error) {
    console.error("Failed to start backend:", error);
    updateStatus("error");
  }

  setupEventListeners();
}

// 加载配置
function loadConfig() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      config = { ...createDefaultConfig(), ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error("Failed to load config:", e);
    config = createDefaultConfig();
  }
}

// 保存配置
function saveConfig() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.error("Failed to save config:", e);
  }
}

// 初始化供应商选择下拉框
function initProviderSelect() {
  providerSelect.innerHTML = '<option value="">请选择...</option>';
  PROVIDERS.forEach((provider) => {
    const option = document.createElement("option");
    option.value = provider.value;
    option.textContent = provider.name;
    providerSelect.appendChild(option);
  });
}

// 更新通用设置显示
function updateGeneralSettings() {
  portInput.value = config.port;
}

// 渲染供应商列表
function renderProvidersList() {
  const list = document.getElementById("providersList") as HTMLDivElement;
  list.innerHTML = "";

  if (config.providers.length === 0) {
    list.innerHTML = '<div class="empty-text" style="padding: 20px; text-align: center; color: var(--text-secondary);">暂无配置，点击上方按钮添加</div>';
    return;
  }

  config.providers.forEach((providerConfig) => {
    const providerDef = getProviderDef(providerConfig.providerValue);
    if (!providerDef) return;

    const item = document.createElement("div");
    item.className = "provider-item";
    if (config.activeProviderId === providerConfig.id) {
      item.classList.add("active");
    }

    const modelName = providerConfig.selectedModel
      ? getModelDisplayName(providerConfig.providerValue, providerConfig.selectedModel)
      : "未选择模型";

    item.innerHTML = `
      <div class="provider-info">
        <div class="provider-name">${providerDef.name}</div>
        <div class="model-name">${modelName}</div>
      </div>
      <div class="provider-actions">
        ${config.activeProviderId === providerConfig.id ? '<span class="check-icon">✓</span>' : ""}
        <button class="btn-icon" data-id="${providerConfig.id}" title="编辑">✏️</button>
      </div>
    `;

    // 点击切换激活
    item.addEventListener("click", (e) => {
      const target = e.target as HTMLElement;
      if (target.classList.contains("btn-icon") || target.closest(".btn-icon")) {
        e.stopPropagation();
        openEditModal(providerConfig.id);
      } else {
        setActiveProvider(providerConfig.id);
      }
    });

    list.appendChild(item);
  });
}

// 获取模型显示名称
function getModelDisplayName(providerValue: string, modelValue: string): string {
  const models = getProviderModels(providerValue);
  const model = models.find((m) => m.value === modelValue);
  if (model) return model.name;

  // 自定义模型，提取 model id
  const parts = modelValue.split(":");
  return parts.length > 1 ? parts[1] : modelValue;
}

// 设置激活的供应商
function setActiveProvider(id: string) {
  config.activeProviderId = id;
  saveConfig();
  renderProvidersList();
  renderActiveProvider();
}

// 渲染当前激活的供应商
function renderActiveProvider() {
  const display = document.getElementById("activeProviderDisplay") as HTMLDivElement;

  if (!config.activeProviderId) {
    display.innerHTML = '<span class="empty-text">未配置供应商，请添加并选择一个</span>';
    return;
  }

  const providerConfig = config.providers.find((p) => p.id === config.activeProviderId);
  if (!providerConfig) {
    display.innerHTML = '<span class="empty-text">未配置供应商，请添加并选择一个</span>';
    return;
  }

  const providerDef = getProviderDef(providerConfig.providerValue);
  if (!providerDef) {
    display.innerHTML = '<span class="empty-text">供应商配置错误</span>';
    return;
  }

  const modelName = providerConfig.selectedModel
    ? getModelDisplayName(providerConfig.providerValue, providerConfig.selectedModel)
    : "未选择模型";

  display.innerHTML = `
    <div class="provider-name">${providerDef.name}</div>
    <div class="model-name">${modelName}</div>
  `;
}

// 打开添加供应商弹窗
function openAddModal() {
  providerSelect.value = "";
  addProviderModal.classList.add("show");
}

// 关闭添加供应商弹窗
function closeAddModal() {
  addProviderModal.classList.remove("show");
}

// 确认添加供应商
function confirmAddProviderFn() {
  const providerValue = providerSelect.value;
  if (!providerValue) {
    alert("请选择一个供应商");
    return;
  }

  // 检查是否已存在
  const exists = config.providers.some((p) => p.providerValue === providerValue);
  if (exists) {
    alert("该供应商已配置");
    return;
  }

  const newConfig = createProviderConfig(providerValue);
  config.providers.push(newConfig);

  // 如果是第一个供应商，自动激活
  if (config.providers.length === 1) {
    config.activeProviderId = newConfig.id;
  }

  saveConfig();
  renderProvidersList();
  renderActiveProvider();
  closeAddModal();

  // 自动打开编辑弹窗
  openEditModal(newConfig.id);
}

// 打开编辑供应商弹窗
function openEditModal(id: string) {
  editingProviderId = id;
  const providerConfig = config.providers.find((p) => p.id === id);
  if (!providerConfig) return;

  const providerDef = getProviderDef(providerConfig.providerValue);
  if (!providerDef) return;

  editProviderName.textContent = providerDef.name;
  editApiKey.value = providerConfig.apiKey;
  editBaseUrl.value = providerConfig.baseUrl || "";

  // 显示/隐藏 API Key 输入
  if (providerDef.envKey) {
    apiKeyItem.style.display = "block";
    editApiKey.placeholder = `输入 ${providerDef.envKey}`;
  } else {
    apiKeyItem.style.display = "none";
  }

  // 显示/隐藏 Base URL 输入
  if (providerDef.isCustom) {
    baseUrlItem.style.display = "block";
    editBaseUrl.placeholder = providerDef.defaultBaseUrl || "http://localhost:11434/v1";
  } else {
    baseUrlItem.style.display = "none";
  }

  // 填充模型选择
  editModelSelect.innerHTML = '<option value="">请选择模型...</option>';
  const models = getProviderModels(providerConfig.providerValue);

  if (models.length > 0) {
    // 有预定义模型
    models.forEach((model) => {
      const option = document.createElement("option");
      option.value = model.value;
      option.textContent = model.name;
      if (model.value === providerConfig.selectedModel) {
        option.selected = true;
      }
      editModelSelect.appendChild(option);
    });
    customModelItem.style.display = "none";
  } else {
    // 自定义模型
    const customOption = document.createElement("option");
    customOption.value = "custom";
    customOption.textContent = "自定义模型...";
    editModelSelect.appendChild(customOption);
    customModelItem.style.display = "block";

    // 如果有已保存的自定义模型，填充
    if (providerConfig.selectedModel) {
      const parts = providerConfig.selectedModel.split(":");
      editCustomModel.value = parts.length > 1 ? parts[1] : providerConfig.selectedModel;
    } else {
      editCustomModel.value = "";
    }
  }

  // 监听模型选择变化
  editModelSelect.onchange = () => {
    if (editModelSelect.value === "custom") {
      customModelItem.style.display = "block";
    } else {
      customModelItem.style.display = "none";
    }
  };

  editProviderModal.classList.add("show");
}

// 关闭编辑供应商弹窗
function closeEditModalFn() {
  editProviderModal.classList.remove("show");
  editingProviderId = null;
}

// 保存编辑的供应商
function saveEditProvider() {
  if (!editingProviderId) return;

  const providerConfig = config.providers.find((p) => p.id === editingProviderId);
  if (!providerConfig) return;

  const providerDef = getProviderDef(providerConfig.providerValue);
  if (!providerDef) return;

  // 更新 API Key
  if (providerDef.envKey) {
    providerConfig.apiKey = editApiKey.value.trim();
  }

  // 更新 Base URL
  if (providerDef.isCustom) {
    providerConfig.baseUrl = editBaseUrl.value.trim();
  }

  // 更新模型选择
  if (editModelSelect.value === "custom") {
    const customModel = editCustomModel.value.trim();
    if (customModel) {
      providerConfig.selectedModel = `${providerConfig.providerValue}:${customModel}`;
    }
  } else if (editModelSelect.value) {
    providerConfig.selectedModel = editModelSelect.value;
  }

  saveConfig();
  renderProvidersList();
  renderActiveProvider();
  closeEditModalFn();
}

// 删除供应商
function deleteProvider() {
  if (!editingProviderId) return;

  if (!confirm("确定要删除这个供应商配置吗？")) return;

  config.providers = config.providers.filter((p) => p.id !== editingProviderId);

  // 如果删除的是激活的供应商，重置激活状态
  if (config.activeProviderId === editingProviderId) {
    config.activeProviderId = config.providers.length > 0 ? config.providers[0].id : null;
  }

  saveConfig();
  renderProvidersList();
  renderActiveProvider();
  closeEditModalFn();
}

// 连接 WebSocket
async function connectWebSocket() {
  try {
    updateStatus("connecting");

    ws = new WebSocket(`${WS_URL}/?token=${WS_TOKEN}&chatId=${currentChatId}`);

    ws.onopen = () => {
      console.log("WebSocket connected");
      isConnected = true;
      updateStatus("connected");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (e) {
        console.error("Failed to parse message:", e);
      }
    };

    ws.onclose = () => {
      console.log("WebSocket disconnected");
      isConnected = false;
      updateStatus("error");

      // 尝试重连
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      isConnected = false;
      updateStatus("error");
    };
  } catch (error) {
    console.error("Failed to connect WebSocket:", error);
    updateStatus("error");
  }
}

// 处理 WebSocket 消息
function handleWebSocketMessage(data: any) {
  console.log("Received message:", data);

  switch (data.type) {
    case "message":
      // 后端 StupidIM 发送的消息格式
      addBotMessage(data.text);
      removeTypingIndicator();
      break;
    case "text":
      addBotMessage(data.text);
      break;
    case "chunk":
      appendToLastMessage(data.chunk);
      break;
    case "done":
      removeTypingIndicator();
      break;
    case "error":
      addBotMessage(`❌ 错误: ${data.error}`);
      removeTypingIndicator();
      break;
    default:
      console.log("Unknown message type:", data.type);
  }
}

// 发送消息
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !isConnected) return;

  // 添加用户消息到界面
  addUserMessage(text);

  // 清空输入框
  messageInput.value = "";
  messageInput.style.height = "auto";

  // 显示打字指示器
  showTypingIndicator();

  // 发送消息到后端
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(
      JSON.stringify({
        type: "message",
        text: text,
      })
    );
  }
}

// 添加用户消息
function addUserMessage(text: string) {
  const messageDiv = document.createElement("div");
  messageDiv.className = "message user";
  messageDiv.innerHTML = `
    <div class="message-header">你</div>
    <div class="bubble">${escapeHtml(text)}</div>
  `;
  chatWindow.appendChild(messageDiv);
  scrollToBottom();
}

// 添加机器人消息
function addBotMessage(text: string) {
  removeTypingIndicator();
  const messageDiv = document.createElement("div");
  messageDiv.className = "message bot";
  messageDiv.innerHTML = `
    <div class="message-header">StupidClaw</div>
    <div class="bubble">${formatMessage(text)}</div>
  `;
  chatWindow.appendChild(messageDiv);
  scrollToBottom();
}

// 追加到上一条消息
function appendToLastMessage(text: string) {
  const lastMessage = chatWindow.querySelector(".message.bot:last-child");
  if (lastMessage) {
    const bubble = lastMessage.querySelector(".bubble");
    if (bubble) {
      bubble.innerHTML += escapeHtml(text);
      scrollToBottom();
    }
  }
}

// 显示打字指示器
function showTypingIndicator() {
  removeTypingIndicator();
  const indicator = document.createElement("div");
  indicator.className = "typing-indicator";
  indicator.id = "typingIndicator";
  indicator.innerHTML = `
    <div class="dot"></div>
    <div class="dot"></div>
    <div class="dot"></div>
  `;
  chatWindow.appendChild(indicator);
  scrollToBottom();
}

// 移除打字指示器
function removeTypingIndicator() {
  const indicator = document.getElementById("typingIndicator");
  if (indicator) {
    indicator.remove();
  }
}

// 滚动到底部
function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 转义 HTML
function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// 格式化消息（简单的代码块支持）
function formatMessage(text: string): string {
  // 简单的代码块处理
  text = text.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    '<pre><code>$2</code></pre>'
  );

  // 行内代码
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 换行
  text = text.replace(/\n/g, "<br>");

  return text;
}

// 更新状态显示
function updateStatus(status: "connecting" | "connected" | "error") {
  const dot = backendStatus.querySelector(".status-dot") as HTMLSpanElement;
  dot.className = `status-dot status-${status}`;

  const statusText = {
    connecting: "连接中...",
    connected: "已连接",
    error: "连接失败",
  };
  backendStatus.lastChild!.textContent = ` ${statusText[status]}`;
}

// 设置事件监听
function setupEventListeners() {
  // 发送消息
  sendBtn.addEventListener("click", sendMessage);

  messageInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // 自动调整输入框高度
  messageInput.addEventListener("input", () => {
    messageInput.style.height = "auto";
    messageInput.style.height = `${Math.min(messageInput.scrollHeight, 120)}px`;
  });

  // 设置面板
  settingsBtn.addEventListener("click", () => {
    settingsPanel.classList.add("open");
  });

  closeSettings.addEventListener("click", () => {
    settingsPanel.classList.remove("open");
  });

  // 保存设置
  saveSettings.addEventListener("click", () => {
    config.port = portInput.value || "8080";
    saveConfig();
    settingsPanel.classList.remove("open");
    alert("配置已保存，重启应用后生效");
  });

  // 标签页切换
  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");

      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      document.getElementById(`${tab}Tab`)?.classList.add("active");
    });
  });

  // 添加供应商
  addProviderBtn.addEventListener("click", openAddModal);
  closeModal.addEventListener("click", closeAddModal);
  cancelAddProvider.addEventListener("click", closeAddModal);
  confirmAddProvider.addEventListener("click", confirmAddProviderFn);

  // 编辑供应商
  closeEditModal.addEventListener("click", closeEditModalFn);
  cancelEditProvider.addEventListener("click", closeEditModalFn);
  confirmEditProvider.addEventListener("click", saveEditProvider);
  deleteProviderBtn.addEventListener("click", deleteProvider);

  // 窗口控制
  minimizeBtn.addEventListener("click", () => {
    getCurrentWindow().minimize();
  });

  closeBtn.addEventListener("click", async () => {
    await invoke("stop_backend");
    await getCurrentWindow().close();
  });

  // 点击弹窗外部关闭
  addProviderModal.addEventListener("click", (e) => {
    if (e.target === addProviderModal) closeAddModal();
  });

  editProviderModal.addEventListener("click", (e) => {
    if (e.target === editProviderModal) closeEditModalFn();
  });
}

// 启动应用
init();
