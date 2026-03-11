import assert from "node:assert/strict";
import test from "node:test";
import { isCronExprMatch } from "../cron.js";

test("isCronExprMatch: 每天 8 点命中", () => {
  const hit = new Date("2026-03-10T08:00:00");
  const miss = new Date("2026-03-10T08:01:00");
  assert.equal(isCronExprMatch("0 8 * * *", hit), true);
  assert.equal(isCronExprMatch("0 8 * * *", miss), false);
});

test("isCronExprMatch: 支持步进与列表", () => {
  const at10 = new Date("2026-03-10T10:30:00");
  const at11 = new Date("2026-03-10T11:30:00");
  assert.equal(isCronExprMatch("*/15 9-11 * * *", at10), true);
  assert.equal(isCronExprMatch("0,30 9-11 * * *", at10), true);
  assert.equal(isCronExprMatch("0,30 9-11 * * *", at11), true);
});

test("isCronExprMatch: 非法表达式返回 false", () => {
  const now = new Date("2026-03-10T08:00:00");
  assert.equal(isCronExprMatch("* * * *", now), false);
  assert.equal(isCronExprMatch("70 8 * * *", now), false);
  assert.equal(isCronExprMatch("x 8 * * *", now), false);
});
