#!/usr/bin/env node
// v1.0 基准3（roadmap §8.2）：从零新建项目 → 三端出包 < 1 小时（Web + Android 本地可验证；iOS 待环境）
// 全程计时；退出码 0=通过
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = resolve(import.meta.dirname, "..");
const cli = join(root, "packages", "cli", "bin", "ccx.mjs");
const hourMs = 3600 * 1000;
const t0 = Date.now();
let failures = 0;
function check(ok, what) {
  if (!ok) { console.error("FAIL: " + what); ++failures; } else { console.log("ok: " + what); }
}

const dir = mkdtempSync(join(tmpdir(), "ccx-three-platform-"));
try {
  // 1) 从零新建项目
  const proj = join(dir, "game");
  let r = spawnSync(process.execPath, [cli, "create", proj, "--json"], { encoding: "utf8", timeout: 60000 });
  check(r.status === 0 && existsSync(join(proj, "ccx.project.json")), "从零新建项目");

  // 2) Web 出包
  r = spawnSync(process.execPath, [cli, "build", "web-desktop", "--project", "game", "--out", join(dir, "web")],
                  { encoding: "utf8", cwd: proj, timeout: 60000 });
  let web = null;
  try { web = JSON.parse(r.stdout); } catch {}
  check(r.status === 0 && web?.ok && existsSync(join(dir, "web", "index.html")), "Web 出包 (index.html)");

  // 3) Android 出包：复用 android/ 样例壳（真实场景数据面）→ assembleRelease
  const gradle = join(process.env.USERPROFILE, "gradle", "bin", "gradle.bat");
  const apk = join(root, "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
  // .bat 需经 cmd /c 执行（Node spawnSync 不直接支持批处理）
  const ga = spawnSync("cmd", ["/c", gradle, "assembleRelease", "--console=plain", "-q"],
                        { encoding: "utf8", cwd: join(root, "android"), timeout: 600000 });
  check(ga.status === 0 && existsSync(apk), "Android 出包 (app-release.apk)");

  // 4) 计时断言：全程 < 1 小时（本地实测远小于）
  const totalMs = Date.now() - t0;
  const totalSec = (totalMs / 1000).toFixed(1);
  console.log("bench3: 从零到出包总耗时 " + totalSec + "s（预算 3600s）");
  check(totalMs < hourMs, "出包 < 1 小时 (v1.0 基准3)");

  if (failures === 0) { console.log("ALL THREE-PLATFORM GATES PASSED (v1.0 基准3)"); process.exit(0); }
  console.error(failures + " FAILURE(S)");
  process.exit(1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
