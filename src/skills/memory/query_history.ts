import { Type } from "@mariozechner/pi-ai";
import { queryHistory } from "../../memory/history-store.js";
import type { SkillDefinition } from "../contracts.js";

export function createQueryHistorySkill(): SkillDefinition {
  return {
    name: "query_history",
    description: "查询某天的历史对话事件，支持按 chatId 过滤",
    exposure: "on_demand",
    tool: {
      name: "query_history",
      label: "Query History",
      description: "Query history events from .stupidClaw/history by date",
      parameters: Type.Object({
        date: Type.Optional(
          Type.String({
            description: "日期，格式 YYYY-MM-DD。默认今天。"
          })
        ),
        chatId: Type.Optional(
          Type.String({
            description: "可选 chatId 过滤。默认使用当前会话 chatId。"
          })
        ),
        limit: Type.Optional(
          Type.Number({
            description: "最多返回多少条，默认 20，最大 200。"
          })
        )
      }),
      execute: async (_toolCallId, rawParams) => {
        const params = rawParams as {
          date?: string;
          chatId?: string;
          limit?: number;
        };
        const events = await queryHistory({
          date: params.date,
          chatId: params.chatId,
          limit: params.limit
        });
        return {
          content: [
            {
              type: "text",
              text: events.length
                ? JSON.stringify(events, null, 2)
                : "[]"
            }
          ],
          details: {}
        };
      }
    }
  };
}
