import { Type } from "@mariozechner/pi-ai";
import {
  updateProfile,
  type ProfileSection
} from "../../memory/profile-store";
import type { SkillDefinition } from "../contracts";

const ALLOWED_SECTIONS = ["stable_facts", "preferences", "constraints"] as const;

export function createUpdateProfileSkill(): SkillDefinition {
  return {
    name: "update_profile",
    description: "更新 profile.md 的指定 section，用于长期记忆",
    exposure: "on_demand",
    tool: {
      name: "update_profile",
      label: "Update Profile",
      description: "Update a specific profile section in .stupidClaw/profile.md",
      parameters: Type.Object({
        section: Type.String({
          description:
            "要更新的 section：stable_facts | preferences | constraints"
        }),
        facts: Type.Array(
          Type.String({
            description: "要写入的事实列表，每项一条"
          })
        ),
        mode: Type.Optional(
          Type.String({
            description: "append(默认) 或 replace"
          })
        )
      }),
      execute: async (_toolCallId, rawParams) => {
        const params = rawParams as {
          section: string;
          facts: string[];
          mode?: string;
        };

        if (!ALLOWED_SECTIONS.includes(params.section as ProfileSection)) {
          return {
            content: [
              {
                type: "text",
                text: "更新失败：section 非法，只能是 stable_facts/preferences/constraints。"
              }
            ],
            details: {}
          };
        }

        const mode = params.mode === "replace" ? "replace" : "append";
        const facts = Array.isArray(params.facts) ? params.facts : [];
        const updated = await updateProfile({
          section: params.section as ProfileSection,
          facts,
          mode
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: true,
                  section: params.section,
                  mode,
                  profile: updated
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
