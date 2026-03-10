import type { ToolDefinition } from "@mariozechner/pi-coding-agent";
import type { TSchema } from "@mariozechner/pi-ai";

export type SkillExposure = "always" | "on_demand";

export interface SkillMeta {
  name: string;
  description: string;
  exposure: SkillExposure;
}

export interface SkillContext {
  chatId: string;
}

export interface SkillDefinition<TParams extends TSchema = TSchema>
  extends SkillMeta {
  tool: ToolDefinition<TParams>;
}
