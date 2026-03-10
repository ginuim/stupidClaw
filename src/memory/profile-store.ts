import fs from "node:fs/promises";
import { getStupidClawRootPath, resolveSafePath } from "./workspace-path";

export type ProfileSection = "stable_facts" | "preferences" | "constraints";

export interface UpdateProfileInput {
  section: ProfileSection;
  facts: string[];
  mode?: "append" | "replace";
}

interface ProfileData {
  stable_facts: string[];
  preferences: string[];
  constraints: string[];
}

const WORKSPACE_DIR = getStupidClawRootPath();
const PROFILE_PATH = resolveSafePath("profile.md");
const SECTION_KEYS: ProfileSection[] = [
  "stable_facts",
  "preferences",
  "constraints"
];

function createEmptyProfileData(): ProfileData {
  return {
    stable_facts: [],
    preferences: [],
    constraints: []
  };
}

function uniqueFacts(facts: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of facts) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function parseProfile(content: string): ProfileData {
  const data = createEmptyProfileData();
  let currentSection: ProfileSection | null = null;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    const sectionMatch = /^##\s+(stable_facts|preferences|constraints)$/i.exec(line);
    if (sectionMatch) {
      currentSection = sectionMatch[1].toLowerCase() as ProfileSection;
      continue;
    }
    if (!currentSection) {
      continue;
    }
    const factMatch = /^-\s+(.+)$/.exec(line);
    if (factMatch) {
      const fact = factMatch[1].trim();
      if (fact !== "(empty)") {
        data[currentSection].push(fact);
      }
    }
  }

  for (const key of SECTION_KEYS) {
    data[key] = uniqueFacts(data[key]);
  }

  return data;
}

function toMarkdown(data: ProfileData): string {
  const lines: string[] = [
    "# StupidClaw Profile",
    "",
    "<!-- 仅保存长期稳定事实；短期上下文放 history -->",
    ""
  ];

  for (const section of SECTION_KEYS) {
    lines.push(`## ${section}`);
    if (data[section].length === 0) {
      lines.push("- (empty)");
    } else {
      for (const fact of data[section]) {
        lines.push(`- ${fact}`);
      }
    }
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

async function ensureProfileFile(): Promise<void> {
  await fs.mkdir(WORKSPACE_DIR, { recursive: true });
  try {
    await fs.access(PROFILE_PATH);
  } catch {
    await fs.writeFile(PROFILE_PATH, toMarkdown(createEmptyProfileData()), "utf-8");
  }
}

export async function readProfileMarkdown(): Promise<string> {
  await ensureProfileFile();
  return fs.readFile(PROFILE_PATH, "utf-8");
}

export async function updateProfile(input: UpdateProfileInput): Promise<ProfileData> {
  await ensureProfileFile();
  const current = await readProfileMarkdown();
  const data = parseProfile(current);
  const normalizedFacts = uniqueFacts(input.facts);

  if (input.mode === "replace") {
    data[input.section] = normalizedFacts;
  } else {
    data[input.section] = uniqueFacts([...data[input.section], ...normalizedFacts]);
  }

  await fs.writeFile(PROFILE_PATH, toMarkdown(data), "utf-8");
  return data;
}
