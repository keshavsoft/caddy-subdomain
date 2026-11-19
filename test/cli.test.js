import test from "node:test";
import assert from "node:assert/strict";
import { run, resolveDefaultPath } from "../src/cli.js";

test("resolveDefaultPath falls back correctly", () => {
  const custom = resolveDefaultPath("my.json");
  assert.ok(custom.endsWith("my.json"));
});

test("CLI exports run function", () => {
  assert.equal(typeof run, "function");
});
