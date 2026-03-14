import { Type } from "@mariozechner/pi-ai";
import type { SkillDefinition } from "../contracts.js";

interface BraveSearchResult {
  title: string;
  url: string;
  description: string;
}

interface BraveSearchResponse {
  web?: {
    results?: BraveSearchResult[];
  };
}

export function createWebSearchSkill(): SkillDefinition {
  return {
    name: "web_search",
    description: "用 Brave Search 搜索互联网，返回相关网页标题、链接与摘要",
    exposure: "on_demand",
    tool: {
      name: "web_search",
      label: "Web Search",
      description:
        "Search the web using Brave Search API. Returns top results with title, URL, and description.",
      parameters: Type.Object({
        q: Type.String({ description: "搜索关键词" }),
        count: Type.Optional(
          Type.Number({ description: "返回结果数，默认 5，最多 10" })
        )
      }),
      execute: async (_toolCallId, rawParams) => {
        const params = rawParams as { q: string; count?: number };
        const apiKey = process.env.BRAVE_SEARCH_API_KEY;

        if (!apiKey) {
          return {
            content: [
              {
                type: "text",
                text: "错误：未配置 BRAVE_SEARCH_API_KEY，请在 .env 中填写后重启。"
              }
            ],
            details: {}
          };
        }

        const count = Math.min(params.count ?? 5, 10);
        const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(params.q)}&count=${count}&text_decorations=false`;

        const res = await fetch(url, {
          headers: {
            Accept: "application/json",
            "X-Subscription-Token": apiKey
          }
        });

        if (!res.ok) {
          return {
            content: [
              {
                type: "text",
                text: `搜索请求失败：HTTP ${res.status} ${res.statusText}`
              }
            ],
            details: {}
          };
        }

        const data = (await res.json()) as BraveSearchResponse;
        const results = data.web?.results ?? [];

        if (results.length === 0) {
          return {
            content: [{ type: "text", text: "未找到相关结果。" }],
            details: {}
          };
        }

        const text = results
          .map(
            (r, i) =>
              `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description ?? ""}`.trimEnd()
          )
          .join("\n\n");

        return {
          content: [{ type: "text", text }],
          details: {}
        };
      }
    }
  };
}
