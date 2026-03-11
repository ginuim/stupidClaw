import { Type } from "@mariozechner/pi-ai";
import type { SkillDefinition } from "../contracts.js";

export function createGetSystemTimeSkill(): SkillDefinition {
  return {
    name: "get_system_time",
    description: "获取当前系统时间（ISO 和本地字符串）",
    exposure: "always",
    tool: {
      name: "get_system_time",
      label: "Get System Time",
      description: "Get current system time",
      parameters: Type.Object({}),
      execute: async () => {
        const now = new Date();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  nowIso: now.toISOString(),
                  nowLocal: now.toLocaleString("zh-CN", {
                    hour12: false
                  })
                },
                null,
                2
              )
            }
          ],
          details: {}
        };
      }
    }
  };
}
