import path from "node:path";

const STUPIDCLAW_ROOT = path.resolve(process.cwd(), ".stupidClaw");

function normalizeRelativePath(targetPath: string): string {
  const trimmed = targetPath.trim();
  if (!trimmed) {
    throw new Error("路径不能为空。");
  }
  if (path.isAbsolute(trimmed)) {
    throw new Error("不允许绝对路径。");
  }

  const normalized = path.normalize(trimmed).replace(/\\/g, "/");
  if (!normalized || normalized === ".") {
    throw new Error("路径不能为空。");
  }

  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) {
    throw new Error("不允许路径穿越（..）。");
  }

  return normalized;
}

export function getStupidClawRootPath(): string {
  return STUPIDCLAW_ROOT;
}

export function resolveSafePath(targetPath: string): string {
  const normalized = normalizeRelativePath(targetPath);
  return path.resolve(STUPIDCLAW_ROOT, normalized);
}
