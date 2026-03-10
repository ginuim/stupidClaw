import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { getStupidClawRootPath, resolveSafePath } from "./workspace-path";

test("resolveSafePath: 合法相对路径会被解析到 .stupidClaw 下", () => {
  const resolved = resolveSafePath("history/2026-03-10.jsonl");
  const expected = path.resolve(process.cwd(), ".stupidClaw", "history", "2026-03-10.jsonl");

  assert.equal(resolved, expected);
  assert.ok(resolved.startsWith(getStupidClawRootPath()));
});

test("resolveSafePath: 拒绝路径穿越 ..", () => {
  assert.throws(
    () => resolveSafePath("../src/index.ts"),
    /不允许路径穿越/
  );
});

test("resolveSafePath: 拒绝绝对路径", () => {
  assert.throws(() => resolveSafePath("/tmp/evil.txt"), /不允许绝对路径/);
});

test("resolveSafePath: 拒绝空路径", () => {
  assert.throws(() => resolveSafePath(""), /路径不能为空/);
  assert.throws(() => resolveSafePath("   "), /路径不能为空/);
});
