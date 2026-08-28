// 插件市场骨架（roadmap M3/M4：插件市场可安装第三方 builder/importer）
// 插件 = 目录 + ccx-plugin.json 清单；registry 负责加载/注册/列举

import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { registerBuilder } from "../../build-service/src/builder_registry.mjs";

// 插件类型（contributes.builder / importer / inspector 协议对齐）
export const PLUGIN_TYPES = ["builder", "importer", "inspector"];

// 校验插件清单（ccx-plugin.json）：{ name, version, type, entry, platform? }
export function parsePluginManifest(dir) {
  const path = join(dir, "ccx-plugin.json");
  if (!existsSync(path)) return null;
  let manifest = null;
  try { manifest = JSON.parse(readFileSync(path, "utf8")); } catch { return null; }
  if (!manifest || typeof manifest.name !== "string" || !manifest.name) return null;
  if (!PLUGIN_TYPES.includes(manifest.type)) return null;
  if (typeof manifest.version !== "string") return null;
  manifest.dir = dir;
  return manifest;
}

// 插件注册表（进程内；pluginMarket.install/list 由 daemon 服务暴露）
const plugins = new Map();

export function installPlugin(manifest, { entry = null } = {}) {
  if (!manifest) return { ok: false, error: "清单无效" };
  const key = manifest.name + "@" + manifest.version;
  const plugin = { name: manifest.name, version: manifest.version, type: manifest.type, entry, dir: manifest.dir, platform: manifest.platform ?? null };
  // M4 出口②：builder 型插件安装即注册进构建链（build.configure/run 立刻可用）
  if (manifest.type === "builder" && manifest.platform) {
    try {
      registerBuilder({
        platform: manifest.platform,
        displayName: manifest.displayName ?? manifest.name,
        hooks: {},  // 第三方自定义 hooks 由 entry 模块导出（v1：默认空钩子，可覆盖）
      });
      plugin.activated = true;
    } catch (e) {
      return { ok: false, error: "builder 注册失败: " + e.message };
    }
  }
  plugins.set(key, plugin);
  return { ok: true, key };
}

export function listPlugins() {
  return [...plugins.values()].map((p) => ({ name: p.name, version: p.version, type: p.type, platform: p.platform }));
}

export function getPlugin(name) {
  for (const p of plugins.values()) if (p.name === name) return p;
  return null;
}
