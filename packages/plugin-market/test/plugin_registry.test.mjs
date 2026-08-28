import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parsePluginManifest, installPlugin, listPlugins, getPlugin } from "../src/plugin_registry.mjs";
import { getBuilder, listBuilders } from "../../build-service/src/builder_registry.mjs";

test("plugin: 清单解析与校验", () => {
  const dir = mkdtempSync(join(tmpdir(), "ccx-plug-"));
  try {
    writeFileSync(join(dir, "ccx-plugin.json"), JSON.stringify({ name: "toon-builder", version: "1.0.0", type: "builder", platform: "web-desktop", entry: "./index.mjs" }));
    const m = parsePluginManifest(dir);
    assert.equal(m.name, "toon-builder");
    assert.equal(m.type, "builder");
    assert.equal(m.platform, "web-desktop");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("plugin: 非法清单拒绝", () => {
  const dir = mkdtempSync(join(tmpdir(), "ccx-plug2-"));
  try {
    writeFileSync(join(dir, "ccx-plugin.json"), JSON.stringify({ version: "1.0" })); // 缺 name
    assert.equal(parsePluginManifest(dir), null);
    writeFileSync(join(dir, "ccx-plugin.json"), JSON.stringify({ name: "x", version: "1", type: "3d" }));
    assert.equal(parsePluginManifest(dir), null);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("plugin: 安装/列举/获取", () => {
  const dir = mkdtempSync(join(tmpdir(), "ccx-plug3-"));
  try {
    const m = parsePluginManifest(dir);
    assert.equal(m, null, "无清单目录 -> null");
    writeFileSync(join(dir, "ccx-plugin.json"), JSON.stringify({ name: "ascii-importer", version: "0.2.1", type: "importer" }));
    const m2 = parsePluginManifest(dir);
    const r = installPlugin(m2);
    assert.equal(r.ok, true);
    const list = listPlugins();
    assert.ok(list.some((p) => p.name === "ascii-importer" && p.type === "importer"));
    const got = getPlugin("ascii-importer");
    assert.equal(got.version, "0.2.1");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("M4 exit 2: builder 型插件安装即注册（build.configure 可用）", () => {
  const dir = mkdtempSync(join(tmpdir(), "ccx-plugb-"));
  try {
    writeFileSync(join(dir, "ccx-plugin.json"), JSON.stringify({ name: "wasteland-builder", version: "1.0.0", type: "builder", platform: "wasteland", displayName: "Wasteland" }));
    const m = parsePluginManifest(dir);
    const r = installPlugin(m);
    assert.equal(r.ok, true);
    assert.equal(getPlugin("wasteland-builder").activated, true);
    const b = getBuilder("wasteland");
    assert.ok(b, "builder 已注册");
    assert.equal(b.displayName, "Wasteland");
    assert.ok(listBuilders().some((x) => x.platform === "wasteland"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
