#!/usr/bin/env node
// M2 exit 1 (roadmap): editor-internal mini-game, zero hand-edited JSON
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const cli = join(root, "packages", "cli", "bin", "ccx.mjs");
let failures = 0;
function check(ok, what) { if (!ok) { console.error("FAIL: " + what); ++failures; } else { console.log("ok: " + what); } }
function ccx(args, cwd1 = root) {
  const r = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", cwd: cwd1, timeout: 30000 });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout || "{}"); } catch {}
  return { status: r.status, parsed };
}

const dir = mkdtempSync(join(tmpdir(), "ccx-editor-game-"));
try {
  const proj = join(dir, "dodge");
  let r = ccx(["create", proj]);
  check(r.status === 0 && existsSync(join(proj, "ccx.project.json")), "create project (zero-handedit)");

  const scene = join(proj, "scenes", "game.scene.json");
  const cmds = [];
  cmds.push(JSON.stringify({ op: "create_entity", name: "canvas" }));
  cmds.push(JSON.stringify({ op: "create_entity", name: "player" }));
  cmds.push(JSON.stringify({ op: "add_component", id: 2, type: "ccx.Sprite", data: { atlas: 1, material: 1 } }));
  cmds.push(JSON.stringify({ op: "add_component", id: 2, type: "game.Health", data: { max: 100, current: 100 } }));
  cmds.push(JSON.stringify({ op: "set_transform", id: 2, position: [0, -100] }));
  for (let i = 0; i < 3; ++i) {
    cmds.push(JSON.stringify({ op: "create_entity", name: "mob" + i }));
    cmds.push(JSON.stringify({ op: "add_component", id: (3 + i), type: "ccx.Sprite", data: { atlas: 2, material: 1 } }));
    cmds.push(JSON.stringify({ op: "set_transform", id: (3 + i), position: [-60 + i * 60, 120] }));
  }
  const argsApply = ["scene", "apply", scene];
  for (const c1 of cmds) argsApply.push("--cmd", c1);
  r = ccx(argsApply);
  check(r.status === 0 && r.parsed?.ok === true, "command-based creation");
  check(r.parsed?.applied?.length === cmds.length, "all commands applied");

  const frame = join(dir, "game.ppm");
  r = ccx(["frame", "dump", scene, "--out", frame, "--size", "160x90"]);
  check(r.status === 0 && r.parsed?.quads === 4, "render 4 sprites (player+3 mobs)");
  check(existsSync(frame), "frame saved");

  if (failures === 0) { console.log("ALL EDITOR-GAME GATES PASSED (M2 exit 1)"); process.exit(0); }
  console.error(failures + " EDITOR-GAME FAILURE(S)");
  process.exit(1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
