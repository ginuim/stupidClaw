import {
  createServer,
  type IncomingMessage as NodeIncomingMessage,
  type ServerResponse
} from "node:http";

export interface GatewayOptions<TPayload> {
  port: number;
  path: string;
  secretToken?: string;
  onPayload: (payload: TPayload) => Promise<void>;
  onServerCreated?: (server: import("node:http").Server) => void;
  onGet?: (req: NodeIncomingMessage, res: ServerResponse) => boolean;
}

function readRawBody(req: NodeIncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer | string) => {
      body += String(chunk);
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export async function startGateway<TPayload>(
  options: GatewayOptions<TPayload>
): Promise<void> {
  const server = createServer(
    async (req: NodeIncomingMessage, res: ServerResponse) => {
    const pathname = new URL(req.url ?? "/", "http://localhost").pathname;
    
    if (req.method === "GET" && options.onGet) {
      if (options.onGet(req, res)) {
        return;
      }
    }

    if (req.method !== "POST" || pathname !== options.path) {
      res.writeHead(404);
      res.end("Not Found");
      return;
    }

    if (options.secretToken) {
      const gotSecret = req.headers["x-telegram-bot-api-secret-token"];
      if (gotSecret !== options.secretToken) {
        res.writeHead(401);
        res.end("Unauthorized");
        return;
      }
    }

    try {
      const raw = await readRawBody(req);
      const payload = JSON.parse(raw) as TPayload;
      await options.onPayload(payload);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    } catch {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false }));
    }
    }
  );

  if (options.onServerCreated) {
    options.onServerCreated(server);
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options.port, "0.0.0.0", () => {
      resolve();
    });
  });
}
