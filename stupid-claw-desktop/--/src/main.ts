import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

// 全局状态
let ws: WebSocket | null = null;
let isConnected = false;
let currentChatId = `desktop_${Date.now()}`;
const WS_TOKEN = "stupid-claw-desktop-token";
const WS_URL = "ws://localhost:8080";

// DOM 元素
const chatWindow = document.getElementById("chatWindow") as HTMLDivElement;
const messageInput = document.getElementById(
  "messageInput"
) as HTMLTextAreaElement;
const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
const backendStatus = document.getElementById("backendStatus") as HTMLSpanElement;
const settingsPanel = document.getElementById("settingsPanel") as HTMLDivElement;
const settingsBtn = document.getElementById("settingsBtn") as HTMLButtonElement;
const closeSettings = document.getElementById("closeSettings") as HTMLButtonElement;
const minimizeBtn = document.getElementById("minimizeBtn") as HTMLButtonElement;
const closeBtn = document.getElementById("closeBtn") as HTMLButtonElement;
const saveSettings = document.getElementById("saveSettings") as HTMLButtonElement;

// 初始化
async function init() {
  setupEventListeners();
  setupWindowControls();
  await connectWebSocket();
  await checkBackendStatus();
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
    messageInput.style.height = `${Math.min(
      messageInput.scrollHeight,
      120
    )}px`;
  });

  // 设置面板
  settingsBtn.addEventListener("click", () => {
    settingsPanel.classList.add("open");
  });

  closeSettings.addEventListener("click", () => {
    settingsPanel.classList.remove("open");
  });

  saveSettings.addEventListener("click", saveSettingsHandler);
}

// 窗口控制
function setupWindowControls() {
  const appWindow = getCurrentWindow();

  minimizeBtn.addEventListener("click", () => {
    appWindow.minimize();
  });

  closeBtn.addEventListener("click", () => {
    appWindow.hide();
  });
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
  switch (data.type) {
    case "message":
      hideTypingIndicator();
      addMessage("bot", data.text);
      showNotification("StupidClaw", data.text.substring(0, 50) + "...");
      break;
    case "action":
      if (data.action === "typing") {
        showTypingIndicator();
      }
      break;
    default:
      console.log("Unknown message type:", data);
  }
}

// 发送消息
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text || !isConnected) return;

  // 添加用户消息到界面
  addMessage("user", text);

  // 发送到服务器
  ws?.send(text);

  // 清空输入框
  messageInput.value = "";
  messageInput.style.height = "auto";

  // 显示打字指示器
  showTypingIndicator();
}

// 添加消息到聊天窗口
function addMessage(sender: "user" | "bot", text: string) {
  const messageDiv = document.createElement("div");
  messageDiv.className = `message ${sender}`;

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  // 处理 Markdown 样式的代码块
  const formattedText = formatMessage(text);
  bubble.innerHTML = formattedText;

  messageDiv.appendChild(bubble);
  chatWindow.appendChild(messageDiv);

  // 滚动到底部
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 格式化消息（简单的代码块处理）
function formatMessage(text: string): string {
  // 处理代码块 ```code```
  let formatted = text.replace(
    /```(\w+)?\n([\s\S]*?)```/g,
    '<pre><code>$2</code></pre>'
  );

  // 处理行内代码 `code`
  formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");

  // 处理换行
  formatted = formatted.replace(/\n/g, "<br>");

  return formatted;
}

// 显示打字指示器
function showTypingIndicator() {
  // 移除已存在的指示器
  hideTypingIndicator();

  const indicator = document.createElement("div");
  indicator.className = "typing-indicator";
  indicator.id = "typingIndicator";
  indicator.innerHTML = `
    <span class="dot"></span>
    <span class="dot"></span>
    <span class="dot"></span>
  `;

  chatWindow.appendChild(indicator);
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

// 隐藏打字指示器
function hideTypingIndicator() {
  const indicator = document.getElementById("typingIndicator");
  if (indicator) {
    indicator.remove();
  }
}

// 更新状态显示
function updateStatus(status: "connecting" | "connected" | "error") {
  const statusDot = backendStatus.querySelector(".status-dot");

  statusDot?.classList.remove("status-connecting", "status-connected", "status-error");

  switch (status) {
    case "connecting":
      statusDot?.classList.add("status-connecting");
      backendStatus.innerHTML = '<span class="status-dot status-connecting"></span> 连接中...';
      break;
    case "connected":
      statusDot?.classList.add("status-connected");
      backendStatus.innerHTML = '<span class="status-dot status-connected"></span> 已连接';
      break;
    case "error":
      statusDot?.classList.add("status-error");
      backendStatus.innerHTML = '<span class="status-dot status-error"></span> 连接失败';
      break;
  }
}

// 检查后端状态
async function checkBackendStatus() {
  try {
    const status = await invoke<string>("get_backend_status");
    console.log("Backend status:", status);

    if (status === "running" && !isConnected) {
      await connectWebSocket();
    }
  } catch (error) {
    console.error("Failed to check backend status:", error);
  }
}

// 显示系统通知
async function showNotification(title: string, body: string) {
  try {
    let permissionGranted = await isPermissionGranted();
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === "granted";
    }

    if (permissionGranted) {
      sendNotification({ title, body });
    }
  } catch (error) {
    console.error("Failed to show notification:", error);
  }
}

// 保存设置
async function saveSettingsHandler() {
  const apiKey = (document.getElementById("apiKeyInput") as HTMLInputElement)
    .value;
  const model = (document.getElementById("modelSelect") as HTMLSelectElement)
    .value;

  // 这里可以将设置保存到本地存储或发送到后端
  console.log("Saving settings:", { apiKey, model });

  // 关闭设置面板
  settingsPanel.classList.remove("open");

  // 显示提示
  showNotification("StupidClaw", "设置已保存");
}

// 启动应用
init();
