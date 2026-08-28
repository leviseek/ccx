// M2 exit 1 verify wrapper
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const script = join(import.meta.dirname, "..", "..", "..", "ci", "verify_editor_game.mjs");

test("M2 exit 1: mini-game via command surface (zero hand-edit)", () => {
  const r = spawnSync(process.execPath, [script], { encoding: "utf8", timeout: 60000 });
  assert.equal(r.status, 0, "editor-game exit 0 " + (r.stdout || "") + (r.stderr || ""));
  assert.match(r.stdout || "", /ALL EDITOR-GAME GATES PASSED/);
});
