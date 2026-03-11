import { WebSocketServer, type WebSocket } from "ws";
import type { MessageHandler } from "./index.js";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import fs from "node:fs";
import path from "node:path";

export function handleStupidIMRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
  if (req.method === "GET" && (pathname === "/" || pathname === "/im")) {
    const htmlPath = path.resolve(process.cwd(), "public/im.html");
    if (fs.existsSync(htmlPath)) {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      res.end(fs.readFileSync(htmlPath, "utf-8"));
      return true;
    }
  }
  return false;
}

export function startStupidIM(
  token: string,
  onMessage: MessageHandler,
  server?: import("node:http").Server
): void {
  let wss: WebSocketServer;
  let baseUrl = "";

  if (server) {
    wss = new WebSocketServer({ server });
    console.log(`[boot] StupidIM attached to existing HTTP server`);
    baseUrl = `http://localhost:${process.env.PORT || "8787"}`;
  } else {
    const port = Number(process.env.PORT ?? "8787");
    const httpServer = createServer((req, res) => {
      if (!handleStupidIMRequest(req, res)) {
        res.writeHead(404);
        res.end("Not Found");
      }
    });
    
    httpServer.listen(port, "0.0.0.0", () => {
      console.log(`[boot] StupidIM HTTP Server started on port ${port}`);
    });
    wss = new WebSocketServer({ server: httpServer });
    baseUrl = `http://localhost:${port}`;
  }

  const defaultChatId = process.env.STUPID_IM_CHAT_ID || `user_${Math.random().toString(36).slice(2, 10)}`;
  const wsUrl = baseUrl.replace("http", "ws");
  
  const clientUrl = new URL(baseUrl);
  clientUrl.searchParams.set("token", token);
  clientUrl.searchParams.set("chatId", defaultChatId);
  clientUrl.searchParams.set("url", wsUrl);

  console.log(`\n==================================================`);
  console.log(`🟢 StupidIM 网页端已启动！请按住 Command/Ctrl 点击下方链接：`);
  console.log(`\x1b[36m\x1b[4m${clientUrl.toString()}\x1b[0m`);
  console.log(`==================================================\n`);

  wss.on("connection", (ws: WebSocket, req) => {
    // 简单的认证：要求 URL 参数带上 token，比如 ws://localhost:8080/?token=secret
    const url = new URL(req.url ?? "", `ws://${req.headers.host ?? "localhost"}`);
    if (url.searchParams.get("token") !== token) {
      ws.close(4001, "Unauthorized");
      return;
    }

    // 这里我们用连接本身的一个唯一ID作为 chatId，也可以由客户端传上来
    const chatId = url.searchParams.get("chatId") || Math.random().toString(36).slice(2);

    ws.on("message", async (data) => {
      const text = data.toString().trim();
      if (!text) return;

      try {
        await onMessage({
          chatId,
          text,
          reply: async (replyText: string) => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: "message", text: replyText }));
            }
          },
          sendChatAction: async () => {
            if (ws.readyState === ws.OPEN) {
              ws.send(JSON.stringify({ type: "action", action: "typing" }));
            }
          }
        });
      } catch (error) {
        console.error(`[error] StupidIM message handling failed:`, error);
      }
    });

    ws.on("error", (error) => {
      console.error(`[error] StupidIM connection error:`, error);
    });
  });
}
