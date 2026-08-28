#!/usr/bin/env node
// ccx-cli（M1：create / scene new 落地；doctor/version 保留）
// 约定：--json 机器可读；--no-interactive 适配 CI。
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { buildAtlasFromDir } from '../../asset-service/src/atlas_builder.mjs';
import { cookWithCompression } from '../../asset-service/src/cook.mjs';
import { createBundleManifest } from '../../build-service/src/bundle.mjs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CommandBus } from '../../scene-service/src/commands.mjs';
import { diffScenes } from '../../scene-service/src/diff.mjs';
import { renderPlan } from '../../scene-service/src/render_plan.mjs';
import { RpcClient } from '../../service-core/src/client.mjs';

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const positional = args.filter((a) => !a.startsWith('--'));
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--at') flags.at = args[++i];
    if (args[i] === '--type') flags.type = args[++i];
    if (args[i] === '--out') flags.out = args[++i];
    if (args[i] === '--root') flags.root = args[++i];
    if (args[i] === '--platform') flags.platform = args[++i];
    if (args[i] === '--project') flags.project = args[++i];
  }
  const sub = positional[0] ?? 'doctor';

  function emit(obj) {
    console.log(jsonMode ? JSON.stringify(obj, null, 2) : JSON.stringify(obj));
    if (!obj.ok) process.exitCode = 1;
  }

  function dirNonEmpty(dir) {
    try {
      return readdirSync(dir).length > 0;
    } catch {
      return false;
    }
  }

  // —— create <path>：项目脚手架（2D 模板）——
  if (sub === 'create') {
    const target = positional[1] ? resolve(positional[1]) : null;
    if (!target) return emit({ ok: false, error: '用法: ccx create <path> [--type 2d]' });
    if (flags.type && flags.type !== '2d') {
      return emit({ ok: false, error: '目前只支持 2d（范围声明见 README）' });
    }
    if (existsSync(target) && dirNonEmpty(target)) {
      return emit({ ok: false, error: '目标目录非空: ' + target });
    }
    mkdirSync(target, { recursive: true });
    cpSync(join(here, '..', 'templates', 'project'), target, { recursive: true });
    return emit({
      ok: true,
      created: target,
      template: '2d',
      files: ['ccx.project.json', 'scenes/main.scene.json', 'scripts/main.ts'],
    });
  }

  // —— scene apply <file> --cmd ...：见下方 apply 分支 ——
  // —— scene new [--at path]：空场景（ADR-003 v1）——
  if (sub === 'scene' && positional[1] === 'new') {
    const out = flags.at ? resolve(flags.at) : resolve('scenes/new.scene.json');
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({
      schema: 'ccx.scene/1',
      meta: { name: 'New Scene', generator: 'ccx-cli' },
      entities: [],
      systems: [],
    }, null, 2) + '\n');
    return emit({ ok: true, created: out, schema: 'ccx.scene/1' });
  }

  // —— scene apply <file> --cmd '<json>'（可多次）：CommandBus 唯一写路径 ——
  if (sub === 'scene' && positional[1] === 'apply') {
    const file = positional[2] ? resolve(positional[2]) : null;
    if (!file || !existsSync(file)) {
      return emit({ ok: false, error: '用法: ccx scene apply <file> --cmd '<json>'（可多次）' });
    }
    const cmds = args.filter((a, i) => args[i - 1] === '--cmd');
    if (cmds.length === 0) return emit({ ok: false, error: '缺少 --cmd' });
    let json;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      return emit({ ok: false, error: '场景文件解析失败: ' + e.message });
    }
    const bus = CommandBus.fromSceneFile(json);
    const applied = [];
    for (const raw of cmds) {
      let cmd;
      try {
        cmd = JSON.parse(raw);
      } catch (e) {
        return emit({ ok: false, error: '--cmd 不是合法 JSON: ' + raw });
      }
      try {
        bus.apply(cmd);
      } catch (e) {
        return emit({ ok: false, error: '命令执行失败: ' + e.message });
      }
      applied.push(cmd.op);
    }
    const out = bus.toSceneFile();
    out.meta.generator = 'ccx-cli scene apply';
    writeFileSync(file, JSON.stringify(out, null, 2) + '\n');
    return emit({
      ok: true,
      file,
      applied,
      entityCount: out.entities.length,
      note: 'undo/redo 属会话内能力（SceneService），CLI 一次性提交',
    });
  }

  // —— scene diff <a> <b>：结构化差异（ADR-003 §4.3）——
  if (sub === 'scene' && positional[1] === 'diff') {
    const fa = positional[2];
    const fb = positional[3];
    if (!fa || !fb || !existsSync(fa) || !existsSync(fb)) {
      return emit({ ok: false, error: '用法: ccx scene diff <a.scene.json> <b.scene.json>' });
    }
    let ja;
    let jb;
    try {
      ja = JSON.parse(readFileSync(fa, 'utf8'));
      jb = JSON.parse(readFileSync(fb, 'utf8'));
    } catch {
      return emit({ ok: false, error: '场景文件解析失败' });
    }
    const changes = diffScenes(ja, jb);
    if (jsonMode) return emit({ ok: true, changes });
    if (changes.length === 0) return emit({ ok: true, changes: [], summary: '无差异' });
    return emit({
      ok: true,
      changes: changes.length,
      summary: changes.map((c) => {
        const head = c.kind === 'entity'
          ? c.op + ' ' + c.name
          : c.id + '.' + (c.path ? c.path.join('.') : c.componentType);
        return (c.op === 'set' ? '~ ' : c.op === 'add' ? '+ ' : '- ') + head +
               (c.value !== undefined ? ' = ' + JSON.stringify(c.value) : '');
      }).join('\n'),
    });
  }

  // —— render plan <file>：渲染计划（场景 -> 稳定排序 -> 合批）——
  if (sub === 'render' && positional[1] === 'plan') {
    const file = positional[2] ? resolve(positional[2]) : null;
    if (!file || !existsSync(file)) {
      return emit({ ok: false, error: '用法: ccx render plan <scene.json>' });
    }
    let json;
    try {
      json = JSON.parse(readFileSync(file, 'utf8'));
    } catch (e) {
      return emit({ ok: false, error: '场景文件解析失败: ' + e.message });
    }
    const plan = renderPlan(json);
    if (flags.out) {
      // 产物：渲染计划 JSON 写盘（工具/CI 消费）
      const outPath = resolve(flags.out);
      mkdirSync(dirname(outPath), { recursive: true });
      writeFileSync(outPath, JSON.stringify({ schema: 'ccx.renderplan/1', ...plan }, null, 2) + '\n');
    }
    if (jsonMode) return emit({ ok: true, file, out: flags.out ?? null, ...plan });
    return emit({
      ok: true,
      summary:
        plan.sprites + ' sprites -> ' + plan.batches.length + ' batches',
      batches: plan.batches.map((b) =>
        'atlas=' + b.atlas + ' mat=' + b.material + ' x' + b.count + '@' + b.first).join(' | '),
    });
  }

  // —— demo all：端到端编排（open -> apply -> save -> build -> cook）——
  if (sub === 'demo' && positional[1] === 'all') {
    const steps = [];
    const push = (name, data) => steps.push({ name, ...data, ok: !!data.ok });
    const daemonEntry = resolve(join(here, '..', '..', 'service-core', 'bin', 'daemon.mjs'));
    const client = new RpcClient(process.execPath, [daemonEntry]);
    try {
      await new Promise((resolve, reject) => {
        const off = client.onEvent((m) => {
          if (m.method === 'system.ready') {
            off();
            resolve();
          }
        });
        setTimeout(() => reject(new Error('daemon 未就绪')), 2500);
      });
      // 1) open
      const fixture = resolve(join(here, '..', '..', '..', 'examples', 'scenes', 'render_plan.scene.json'));
      const open = await client.request('scene.open', { path: fixture });
      push('scene.open', { entities: open.entities, ok: open.ok });
      if (!open.ok) return emit({ ok: false, steps });
      // 2) apply
      const a1 = await client.request('scene.apply', { command: { op: 'create_entity', name: 'npc', parent: 1 } });
      const a2 = await client.request('scene.apply', { command: { op: 'add_component', id: 2, type: 'game.Health', data: { max: 80 } } });
      push('scene.apply', { entities: a2.entities, ok: a2.ok });
      // 3) save
      const savePath = resolve(join(here, '..', '..', '..', 'build', 'local', 'demo-all.scene.json'));
      const saved = await client.request('scene.save', { path: savePath });
      push('scene.save', { entities: saved.ok ? (await client.request('scene.query')).entities.length : -1, ok: saved.ok });
      // 4) build
      const run = await client.request('build.run', { platform: 'web-desktop', project: 'demo-all' });
      push('build.run', { trace: run.trace ? run.trace.filter((t) => t.status === 'ok').length : 0, ok: run.ok });
      // 5) cook（本地）
      const assetsDir = resolve(join(here, '..', '..', '..', 'build', 'local', 'demo-assets'));
      mkdirSync(assetsDir, { recursive: true });
      writeFileSync(join(assetsDir, 'hero.png'), 'png');
      writeFileSync(join(assetsDir, 'coin.png'), 'png');
      const scanned = [];
      for (const name of readdirSync(assetsDir)) {
        const full = join(assetsDir, name);
        scanned.push({ uuid: 'demo-' + name, path: full, sourceFormat: 'png', sizeBytes: 3 });
      }
      let cookOk = 0;
      for (const a of scanned) {
        const r2 = await cookWithCompression(a, 'android');
        if (r2.artifact.parts.every((x) => x.ok !== false)) cookOk += 1;
      }
      push('cook', { scanned: scanned.length, cookOk, ok: true });
      return emit({ ok: steps.every((s) => s.ok), steps, note: 'demo-all 端到端串起 open/apply/save/build/cook' });
    } finally {
      client.close();
    }
  }

  // —— service demo：spawn stdio daemon -> RPC 调用 -> 退出 ——
  if (sub === 'service' && positional[1] === 'demo') {
    const daemonEntry = resolve(join(here, '..', '..', 'service-core', 'bin', 'daemon.mjs'));
    const client = new RpcClient(process.execPath, [daemonEntry]);
    try {
      await new Promise((resolve, reject) => {
        const off = client.onEvent((m) => {
          if (m.method === 'system.ready') {
            off();
            resolve();
          }
        });
        setTimeout(() => reject(new Error('daemon 未就绪')), 2000);
      });
      const list = await client.request('asset.list');
      return emit({ ok: true, daemon: 'stdio', assets: list.assets.length });
    } finally {
      client.close();
    }
  }

  // —— atlas pack --root <dir> --out <atlas.json>：png 目录 -> ccx.atlas/1 ——
  if (sub === 'atlas' && positional[1] === 'pack') {
    const rootDir = flags.root ?? positional[2];
    const out = flags.out ? resolve(flags.out) : resolve('atlas.json');
    if (!rootDir || !existsSync(rootDir)) {
      return emit({ ok: false, error: '用法: ccx atlas pack --root <dir> [--out <atlas.json>]' });
    }
    const atlas = buildAtlasFromDir(rootDir);
    if (!atlas) return emit({ ok: false, error: '没有可打包的 png（或图集装不下）' });
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(atlas, null, 2) + '\n');
    return emit({ ok: true, items: atlas.items.length, width: atlas.width, height: atlas.height, out });
  }
  // —— scene atlas <atlas.json> --out <scene.json>：图集 -> Sprite 场景 ——
  if (sub === 'scene' && positional[1] === 'atlas') {
    const atlasFile = positional[2];
    if (!atlasFile || !existsSync(atlasFile)) {
      return emit({ ok: false, error: '用法: ccx scene atlas <atlas.json> [--out <scene.json>]' });
    }
    let atlas;
    try {
      atlas = JSON.parse(readFileSync(atlasFile, 'utf8'));
    } catch {
      return emit({ ok: false, error: 'atlas 文件解析失败' });
    }
    const out = flags.out ? resolve(flags.out) : resolve('scenes/atlas.scene.json');
    mkdirSync(dirname(out), { recursive: true });
    const entities = atlas.items.map((it, i) => ({
      id: i + 1,
      name: it.name,
      parent: null,
      components: [{ type: 'ccx.Sprite', data: { atlas: 1, material: 1 } }],
    }));
    const sceneDoc = {
      schema: 'ccx.scene/1',
      meta: { name: 'AtlasScene', generator: 'ccx-cli scene atlas', atlas: atlasFile },
      entities,
      systems: [],
    };
    writeFileSync(out, JSON.stringify(sceneDoc, null, 2) + '\n');
    return emit({ ok: true, entities: entities.length, out, from: atlasFile });
  }

  // —— cook --root <dir> [--platform <p>]：资产扫描 -> Cook -> bundle 一步 ——
  if (sub === 'cook') {
    const rootDir = flags.root ?? positional[1];
    const platform = flags.platform ?? 'android';
    if (!rootDir || !existsSync(rootDir)) {
      return emit({ ok: false, error: '用法: ccx cook --root <dir> [--platform <p>]' });
    }
    const assets = [];
    for (const name of readdirSync(rootDir)) {
      const full = join(rootDir, name);
      const st = statSync(full);
      if (st.isFile()) {
        assets.push({
          uuid: await import('node:crypto').then(() => 'cook-' + name),
          path: full,
          sourceFormat: name.split('.').pop() ?? 'bin',
          sizeBytes: st.size,
        });
      }
    }
    let okCount = 0;
    let failCount = 0;
    const results = [];
    for (const a of assets) {
      const r = await cookWithCompression({ uuid: a.uuid, sourceFormat: a.sourceFormat,
                                             sizeBytes: a.sizeBytes }, platform);
      const ok = r.artifact.parts.every((p) => p.ok !== false);
      results.push({ uuid: a.uuid, ok, parts: r.artifact.parts.length });
      if (ok) okCount += 1;
      else failCount += 1;
    }
    const bundle = createBundleManifest({
      project: flags.project ?? 'demo',
      platform,
      assets: assets.map((a) => ({ uuid: a.uuid, path: a.path })),
      config: {},
    });
    return emit({
      ok: true,
      platform,
      scanned: assets.length,
      okCount,
      failCount,
      bundleId: bundle.buildId,
      results,
      note: '真实压缩器可经 registerCompressor 接入（M2 原生 worker）',
    });
  }

  // —— build --platform <p> [--project <name>]：经 daemon 走 Builder RPC ——
  if (sub === 'build') {
    const platform = flags.platform ?? positional[1];
    if (!platform) {
      return emit({ ok: false, error: '用法: ccx build --platform <p> [--project <name>]' });
    }
    const daemonEntry = resolve(join(here, '..', '..', 'service-core', 'bin', 'daemon.mjs'));
    const client = new RpcClient(process.execPath, [daemonEntry]);
    try {
      await new Promise((resolve, reject) => {
        const off = client.onEvent((m) => {
          if (m.method === 'system.ready') {
            off();
            resolve();
          }
        });
        setTimeout(() => reject(new Error('daemon 未就绪')), 2500);
      });
      const cfg = await client.request('build.configure', { platform });
      if (!cfg.ok) return emit({ ok: false, error: '构建失败: ' + cfg.error });
      const run = await client.request('build.run', {
        platform,
        project: flags.project ?? 'demo',
      });
      if (!run.ok) {
        const errStep = run.trace?.find((t) => t.status === 'error');
        return emit({ ok: false, error: '构建失败: ' + (errStep?.error ?? 'hooks 出错') });
      }
      return emit({
        ok: true,
        platform,
        traceSteps: run.trace.filter((t) => t.status === 'ok').length,
        buildId: run.manifest?.buildId ?? null,
      });
    } finally {
      client.close();
    }
  }

  // —— doctor / version ——
  if (sub === 'version') return emit({ ok: true, name: '@ccx/cli', version: '0.1.0', milestone: 'M1' });
  if (sub === 'doctor') {
    const cwd = process.cwd();
    const git = spawnSync('git', ['--version'], { encoding: 'utf8' });
    const checks = {
      node: process.version,
      git: git.status === 0 ? git.stdout.trim() : 'missing',
      'engine/ 骨架': existsSync(join(cwd, 'engine', 'foundation', 'include')),
      'packages/ 骨架': existsSync(join(cwd, 'packages')),
      'docs/ 规格': existsSync(join(cwd, 'docs', 'engine-spec.md')),
      'ci/gates': existsSync(join(cwd, 'ci', 'gates')),
      'CMakeLists': existsSync(join(cwd, 'CMakeLists.txt')),
      'mise.toml': existsSync(join(cwd, '.mise.toml')),
      'examples/ 场景': existsSync(join(cwd, 'examples', 'scenes', 'sample.scene.json')),
      'vendor/ 纪律': existsSync(join(cwd, 'engine', 'platform', 'vendor', 'pal', 'UPSTREAM.md')),
      '构建产物（本地）': existsSync(join(cwd, 'build', 'local', 'engine', 'tests',
                                            'ccx_foundation_tests.exe')),
    };
    const failed = Object.entries(checks).filter(([, v]) => v === false || v === 'missing');
    return emit({
      ok: failed.length === 0,
      tool: 'ccx doctor',
      cwd,
      checks,
      hint: failed.length > 0
        ? '缺失项：' + failed.map(([k]) => k).join(', ') +
          '（详见 README 执行状态表与 GITHUB-SETUP.md）'
        : '环境齐备；下一步：git push 触发 CI（GITHUB-SETUP.md）',
    });
  }
  return emit({
    ok: false,
    error: 'unknown subcommand: ' + sub,
    usage: 'ccx create|scene new|doctor|version [--json]',
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
