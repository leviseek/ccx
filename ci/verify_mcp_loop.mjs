#!/usr/bin/env node
// v1.0 基准6（roadmap §8.2）：MCP 自然语言闭环——建场景 → 放精灵 → 加脚本 → 截图 → 构建
// 单 daemon 会话内工具链串联（services-spec §7 剧情），无人工干预；退出码 0=通过
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { RpcClient } from "../packages/service-core/src/client.mjs";

const root = resolve(import.meta.dirname, "..");
const cli = join(root, "packages", "cli", "bin", "ccx.mjs");
const daemonEntry = join(root, "packages", "service-core", "bin", "daemon.mjs");

function ccx(args) {
  const r = spawnSync(process.execPath, [cli, ...args], { encoding: "utf8", cwd: root, timeout: 30000 });
  let parsed = null;
  try { parsed = JSON.parse(r.stdout || "{}"); } catch {}
  return { status: r.status, parsed, raw: r.stdout, err: r.stderr };
}

const dir = mkdtempSync(join(tmpdir(), "ccx-mcp-loop-"));
let failures = 0;
function check(ok, what) {
  if (!ok) { console.error("FAIL: " + what); ++failures; } else { console.log("ok: " + what); }
}

const client = new RpcClient(process.execPath, [daemonEntry], { cwd: root });

async function callTool(name, args = {}) {
  const out = await client.request("mcp.callTool", { name, arguments: args });
  try { return JSON.parse(out.content[0].text); } catch { return out.content[0].text; }
}

try {
  await new Promise((resolve2, reject) => {
    const off = client.onEvent((m) => {
      if (m.method === "system.ready") { off(); resolve2(); }
    });
    setTimeout(() => reject(new Error("daemon 未就绪")), 2500);
  });

  // 1) scene.open
  const sceneFile = join(dir, "ai.scene.json");
  writeFileSync(sceneFile, JSON.stringify({ schema: "ccx.scene/1", meta: { name: "ai" }, entities: [], systems: [] }));
  let r = await callTool("scene.open", { path: sceneFile });
  check(r.ok === true, "MCP scene.open");

  // 2) scene.apply：建实体 + 精灵 + 脚本组件（命令包在 command 字段，daemon 契约）
  r = await callTool("scene.apply", { command: { op: "create_entity", name: "hero" } });
  check(r.ok === true, "MCP create_entity");
  r = await callTool("scene.apply", { command: { op: "add_component", id: 1, type: "ccx.Sprite", data: { atlas: 1, material: 1 } } });
  check(r.ok === true, "MCP add Sprite 组件");
  r = await callTool("scene.apply", { command: { op: "add_component", id: 1, type: "game.Health", data: { max: 100, current: 77 } } });
  check(r.ok === true, "MCP add Health 组件");

  // 3) scene.query 验证实体
  r = await callTool("scene.query");
  const q = JSON.stringify(r);
  check(q.includes("hero") && q.includes("ccx.Sprite"), "MCP scene.query 命中精灵");

  // 4) scene.save
  r = await callTool("scene.save", { path: sceneFile });
  check(r.ok === true, "MCP scene.save");
  const saved = readFileSync(sceneFile, "utf8");
  check(saved.includes("ccx.Sprite") && saved.includes("hero"), "保存场景含精灵");

  // 5) 截图：frame dump（CLI 通道；同一交付链）
  const outPpm = join(dir, "ai.ppm");
  const fd = ccx(["frame", "dump", sceneFile, "--out", outPpm, "--size", "160x90"]);
  check(fd.status === 0 && existsSync(outPpm), "帧导出（截图）");

  // 6) build.run（MCP 工具；web 平台）
  r = await callTool("build.run", { outDir: join(dir, "bundle"), platform: "web-desktop" });
  const br = JSON.stringify(r);
  check(br.includes("ok") && !br.includes('"ok":false'), "MCP build.run");

  if (failures === 0) {
    console.log("ALL MCP LOOP GATES PASSED (v1.0 基准6)");
    process.exit(0);
  }
  console.error(failures + " MCP LOOP FAILURE(S)");
  process.exit(1);
} finally {
  client.close();
  rmSync(dir, { recursive: true, force: true });
}
