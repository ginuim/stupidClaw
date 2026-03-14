import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Type } from "@mariozechner/pi-ai";
import type { SkillDefinition } from "../contracts.js";

const execFileAsync = promisify(execFile);

export function createClaudeCodeSkill(): SkillDefinition {
  return {
    name: "claude_code",
    description:
      "调用本机安装的 Claude Code 执行编程任务：写代码、修复 bug、重构、阅读项目等。Claude Code 会直接读写目标目录的文件。",
    exposure: "on_demand",
    tool: {
      name: "claude_code",
      label: "Claude Code",
      description:
        "Run Claude Code (claude --print) to perform a coding task in a target directory. Claude Code will read and write files autonomously.",
      parameters: Type.Object({
        task: Type.String({
          description: "要完成的编程任务，用自然语言描述，越具体越好"
        }),
        workDir: Type.Optional(
          Type.String({
            description:
              "目标项目目录的绝对路径，不填则使用当前工作目录"
          })
        )
      }),
      execute: async (_toolCallId, rawParams) => {
        const params = rawParams as { task: string; workDir?: string };
        const cwd = params.workDir ?? process.cwd();

        let stdout: string;
        let stderr: string;

        try {
          const result = await execFileAsync(
            "claude",
            [
              "--print",
              "--dangerously-skip-permissions",
              "--no-session-persistence",
              "--output-format",
              "text",
              params.task
            ],
            {
              cwd,
              timeout: 5 * 60 * 1000, // 5 分钟超时
              maxBuffer: 10 * 1024 * 1024 // 10MB
            }
          );
          stdout = result.stdout;
          stderr = result.stderr;
        } catch (err: unknown) {
          const e = err as NodeJS.ErrnoException & {
            stdout?: string;
            stderr?: string;
          };
          if (e.code === "ENOENT") {
            return {
              content: [
                {
                  type: "text",
                  text: "错误：本机未安装 claude CLI，请先安装 Claude Code（npm install -g @anthropic-ai/claude-code）。"
                }
              ],
              details: {}
            };
          }
          const output = [e.stdout, e.stderr].filter(Boolean).join("\n").trim();
          return {
            content: [
              {
                type: "text",
                text: `Claude Code 执行失败：${e.message}\n${output}`
              }
            ],
            details: {}
          };
        }

        const output = [stdout, stderr].filter(Boolean).join("\n").trim();

        return {
          content: [
            {
              type: "text",
              text: output || "（Claude Code 执行完毕，无输出）"
            }
          ],
          details: { cwd }
        };
      }
    }
  };
}
