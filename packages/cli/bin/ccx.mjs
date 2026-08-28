#!/usr/bin/env node
// ccx-cli（M1：create / scene new 落地；doctor/version 保留）
// 约定：--json 机器可读；--no-interactive 适配 CI。
import { spawn, spawnSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { closeSync, cpSync, existsSync, mkdirSync, openSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { buildAtlasFromDir } from '../../asset-service/src/atlas_builder.mjs';
import { cookWithCompression } from '../../asset-service/src/cook.mjs';
import { createBundleManifest } from '../../build-service/src/bundle.mjs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildView } from '../../editor-shell/src/viewmodel.mjs';
import { EditorShell } from '../../editor-shell/src/shell.mjs';
import { buildGif } from '../../editor-shell/src/gif.mjs';
import { parsePpm, ppmToBmp } from '../../editor-shell/src/ppm_to_bmp.mjs';
import { renderPreviewPage } from '../../editor-shell/src/preview_page.mjs';
import { CommandBus } from '../../scene-service/src/commands.mjs';
import { diffScenes } from '../../scene-service/src/diff.mjs';
import { renderPlan } from '../../scene-service/src/render_plan.mjs';
import { RpcClient } from '../../service-core/src/client.mjs';

const here = dirname(fileURLToPath(import.meta.url));

function countTestFilesSync(cwd) {
  let n = 0;
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      let st;
      try {
        st = statSync(full);
      } catch {
        continue;
      }
      if (st.isDirectory()) walk(full);
      else if (name.endsWith('.test.mjs')) ++n;
    }
  };
  try {
    walk(join(cwd, 'packages'));
  } catch {
    /* noop */
  }
  return n;
}

function countAddTestSync(cwd) {
  const cm = join(cwd, 'engine', 'tests', 'CMakeLists.txt');
  if (!existsSync(cm)) return 0;
  return readFileSync(cm, 'utf8').split('\n').filter((l) => l.trim().startsWith('add_test(')).length;
}

function buildDirName() {
  return resolve(join(process.cwd(), 'build', 'local'));
}

function isAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

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
    if (args[i] === '--size') flags.size = args[++i];
    if (args[i] === '--time') flags.time = args[++i];
    if (args[i] === '--count') flags.count = args[++i];
    if (args[i] === '--frame') flags.frame = args[++i];
    if (args[i] === '--times') flags.times = args[++i];
    if (args[i] === '--delay') flags.delay = args[++i];
    if (args[i] === '--gif') flags.gif = args[++i];
    if (args[i] === '--highlight') flags.highlight = args[++i];
    if (args[i] === '--demo') flags.demo = true;
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

  // —— editor preview <scene.json> [--out preview.html]：自包含预览页 ——
  if (sub === 'editor' && positional[1] === 'preview') {
    const sceneFile = positional[2];
    if (!sceneFile || !existsSync(sceneFile)) {
      return emit({ ok: false, error: '用法: ccx editor preview <scene.json> [--out <html>]' });
    }
    let doc;
    try {
      doc = JSON.parse(readFileSync(sceneFile, 'utf8'));
    } catch {
      return emit({ ok: false, error: '场景文件解析失败' });
    }
    const bus = CommandBus.fromSceneFile(doc);
    // 命令回路：--apply '<cmd>'（可多次）在生成前应用
    const applies = args.filter((a, i) => args[i - 1] === '--apply');
    for (const raw of applies) {
      let cmd;
      try {
        cmd = JSON.parse(raw);
      } catch {
        return emit({ ok: false, error: '--apply 不是合法 JSON' });
      }
      try {
        bus.apply(cmd);
      } catch (e) {
        return emit({ ok: false, error: '命令执行失败: ' + e.message });
      }
    }
    const shell = new EditorShell({ bus });
    shell.addPanel('hierarchy', 'left', 0);
    shell.addPanel('scene', 'center', 0);
    shell.addPanel('inspector', 'right', 10);
    shell.registerCommand('scene.save', '保存场景', () => {});
    const view = buildView(shell, bus);
    let html = renderPreviewPage(view, doc);
    // --frame <ppm>：渲染帧图嵌入（PPM -> BMP data URL，浏览器可显示）
    if (flags.frame && existsSync(flags.frame)) {
      const bmp = ppmToBmp(readFileSync(flags.frame));
      const dataUrl = 'data:image/bmp;base64,' + bmp.toString('base64');
      html = html.replace('</footer>',
        '<section id="frame-view"><img alt="render frame" src="' + dataUrl +
        '" style="image-rendering:pixelated;border:1px solid #333;max-width:100%"></section>' +
        '</footer>');
    }
    // --gif <file>：动画序列嵌入（GIF data URL）
    if (flags.gif && existsSync(flags.gif)) {
      const gifUrl = 'data:image/gif;base64,' + readFileSync(flags.gif).toString('base64');
      html = html.replace('</footer>',
        '<section id="anim-view"><img alt="frame animation" src="' + gifUrl +
        '" style="image-rendering:pixelated;border:1px solid #333;max-width:100%"></section>' +
        '</footer>');
    }
    const out = flags.out ? resolve(flags.out) : resolve('preview.html');
    writeFileSync(out, html);
    return emit({ ok: true, out, entities: view.scene.entityCount,
                  frame: flags.frame && existsSync(flags.frame) ? resolve(flags.frame) : null });
  }

  // —— demo all：端到端编排（open -> apply -> save -> build -> cook）——
  if (sub === 'demo' && positional[1] === 'all') {
    const steps = [];
    const stepStart = {};
    const push = (name, data) => {
      const ms = stepStart[name] ? Date.now() - stepStart[name] : 0;
      steps.push({ name, ...data, ok: !!data.ok, ms });
    };
    const tick = (name) => { stepStart[name] = Date.now(); };
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
      tick('scene.open');
      const fixture = resolve(join(here, '..', '..', '..', 'examples', 'scenes', 'render_plan.scene.json'));
      const open = await client.request('scene.open', { path: fixture });
      push('scene.open', { entities: open.entities, ok: open.ok });
      if (!open.ok) return emit({ ok: false, steps });
      // 2) apply
      tick('scene.apply');
      const a1 = await client.request('scene.apply', { command: { op: 'create_entity', name: 'npc', parent: 1 } });
      const a2 = await client.request('scene.apply', { command: { op: 'add_component', id: 2, type: 'game.Health', data: { max: 80 } } });
      push('scene.apply', { entities: a2.entities, ok: a2.ok });
      // 3) save
      tick('scene.save');
      const savePath = resolve(join(here, '..', '..', '..', 'build', 'local', 'demo-all.scene.json'));
      const saved = await client.request('scene.save', { path: savePath });
      push('scene.save', { entities: saved.ok ? (await client.request('scene.query')).entities.length : -1, ok: saved.ok });
      // 4) build
      tick('build.run');
      const run = await client.request('build.run', { platform: 'web-desktop', project: 'demo-all' });
      push('build.run', { trace: run.trace ? run.trace.filter((t) => t.status === 'ok').length : 0, ok: run.ok });
      // 5) profiler：记录 1 演示帧 + 快照
      tick('profiler.snapshot');
      await client.request('profiler.record', { frame: 1, frameTimeMs: 16.6, entities: 8 });
      const prof = await client.request('profiler.snapshot', { count: 5 });
      push('profiler.snapshot', { schema: prof.schema, frames: prof.frames.length, ok: true });
      // 6) frame gif（渲染帧动画序列）
      tick('frame.gif');
      {
        const fixture = resolve(join(here, '..', '..', '..', 'examples', 'scenes', 'render_plan.scene.json'));
        const dumpExe = resolve(join(here, '..', '..', '..', 'build', 'local', 'engine', 'tests', 'ccx_frame_dump.exe'));
        if (!existsSync(dumpExe)) {
          push('frame.gif', { ok: false, error: '未构建 ccx_frame_dump' });
          return emit({ ok: false, steps });
        }
        const outGif = resolve(join(here, '..', '..', '..', 'build', 'local', 'demo-anim.gif'));
        const ppmDir = resolve(join(here, '..', '..', '..', 'build', 'local'));
        const frameResults = [];
        for (const t of ['0', '0.1', '0.2']) {
          const ppm = join(ppmDir, 'demo-frame-' + t.replace('.', '_') + '.ppm');
          const fr = spawnSync(dumpExe, [fixture, ppm, '160', '90', t], { encoding: 'utf8' });
          if (fr.status !== 0) {
            push('frame.gif', { ok: false, error: '帧 t=' + t + ' 失败' });
            return emit({ ok: false, steps });
          }
          const { w, h, data } = parsePpm(readFileSync(ppm));
          const pixels = new Uint8Array(w * h * 4);
          for (let i = 0; i < w * h; ++i) {
            pixels[i * 4] = data[i * 3];
            pixels[i * 4 + 1] = data[i * 3 + 1];
            pixels[i * 4 + 2] = data[i * 3 + 2];
            pixels[i * 4 + 3] = 255;
          }
          frameResults.push({ w, h, pixels });
        }
        writeFileSync(outGif, buildGif(frameResults, { delayCs: 25 }));
        push('frame.gif', { frames: frameResults.length, ok: true });
      }
      // 7) contact.gif：碰撞时序动画（--contacts 自动高亮）
      tick('contact.gif');
      {
        const collideScene = resolve(join(here, '..', '..', '..', 'build', 'local', 'demo-collide.scene.json'));
        writeFileSync(collideScene, JSON.stringify({
          schema: 'ccx.scene/1', meta: {}, systems: [],
          entities: [
            { id: 1, name: 'hero', parent: null,
              components: [
                { type: 'ccx.Sprite', data: { atlas: 1, material: 1 } },
                { type: 'ccx.Collider', data: { hx: 25, hy: 25, layer: 1, mask: 2 } },
                { type: 'ccx.CurveAnim', data: { t0: 0, v0: 0, t1: 2, v1: 140 } },
              ] },
            { id: 2, name: 'pillar', parent: null,
              components: [
                { type: 'ccx.Transform', data: { position: [100, 0] } },
                { type: 'ccx.Sprite', data: { atlas: 2, material: 1 } },
                { type: 'ccx.Collider', data: { hx: 25, hy: 25, layer: 2, mask: 3 } },
              ] },
          ],
        }, null, 2) + '\n');
        const dumpExe2 = resolve(join(here, '..', '..', '..', 'build', 'local', 'engine', 'tests', 'ccx_frame_dump.exe'));
        const outGif2 = resolve(join(here, '..', '..', '..', 'build', 'local', 'demo-contact.gif'));
        const ppmDir2 = resolve(join(here, '..', '..', '..', 'build', 'local'));
        const cFrames = [];
        for (const t of ['0', '0.7', '1.4']) {
          const ppm = join(ppmDir2, 'contact-' + t.replace('.', '_') + '.ppm');
          const fr = spawnSync(dumpExe2, [collideScene, ppm, '160', '90', t, '', '1', '1'],
                               { encoding: 'utf8' });
          if (fr.status !== 0) {
            push('contact.gif', { ok: false, error: '帧 t=' + t + ' 失败' });
            return emit({ ok: false, steps });
          }
          const { w, h, data } = parsePpm(readFileSync(ppm));
          const pixels = new Uint8Array(w * h * 4);
          for (let i = 0; i < w * h; ++i) {
            pixels[i * 4] = data[i * 3];
            pixels[i * 4 + 1] = data[i * 3 + 1];
            pixels[i * 4 + 2] = data[i * 3 + 2];
            pixels[i * 4 + 3] = 255;
          }
          cFrames.push({ w, h, pixels });
        }
        writeFileSync(outGif2, buildGif(cFrames, { delayCs: 25 }));
        push('contact.gif', { frames: cFrames.length, ok: true });
      }
      // 8) mcp：工具面自检（AI 接口可用性）
      tick('mcp.tools');
      {
        const t = await client.request('mcp.listTools');
        push('mcp.tools', { tools: t.tools.length, ok: t.tools.length >= 9 });
        const c = await client.request('mcp.callTool', { name: 'asset.list' });
        const text = c.content[0].text;
        push('mcp.call', { textLen: text.length, ok: text.includes('a-1') });
      }
      // 9) cook（本地）
      tick('cook');
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
      // Web 构建目标骨架：--out <dir> 装配静态站点（index.html + assets 清单）
      let outDir = null;
      if (flags.out) {
        outDir = resolve(flags.out);
        mkdirSync(outDir, { recursive: true });
        const assets = run.manifest?.entries?.assets ?? [];
        writeFileSync(join(outDir, 'assets.json'),
                      JSON.stringify({ schema: 'ccx.assets.index/1', platform, assets }, null, 2));
        const scripts = run.manifest?.entries?.scripts ?? [];
        writeFileSync(
          join(outDir, 'index.html'),
          '<!doctype html><html><head><meta charset="utf-8">' +
          '<title>CCX ' + platform + '</title></head><body>' +
          '<div id="game"></div><script src="game.js"></script></body></html>' +
          '\n');
        writeFileSync(
          join(outDir, 'game.js'),
          '// CCX web 目标骨架（M2 接运行时入口）\n' +
          'window.__CCX = {' + platform + ': true, assets: ' + assets.length + '};\n');
      }
      return emit({
        ok: true,
        platform,
        traceSteps: run.trace.filter((t) => t.status === 'ok').length,
        buildId: run.manifest?.buildId ?? null,
        out: outDir,
        assets: run.manifest?.entries?.assets?.length ?? 0,
      });
    } finally {
      client.close();
    }
  }

  // —— service start：常驻 daemon（detached + pid 文件 + 日志）——
  if (sub === 'service' && positional[1] === 'start') {
    const stateDir = resolve(join(process.cwd(), 'build', 'local'));
    mkdirSync(stateDir, { recursive: true });
    const pidFile = join(stateDir, 'service.pid');
    const logFile = join(stateDir, 'service.log');
    if (existsSync(pidFile)) {
      const pid = Number(readFileSync(pidFile, 'utf8').trim());
      if (pid && isAlive(pid)) {
        return emit({ ok: false, error: '服务已在运行 pid=' + pid });
      }
    }
    const daemonEntry = resolve(join(here, '..', '..', 'service-core', 'bin', 'daemon.mjs'));
    // 流 + 等待 fd 就绪（路径字符串在 worker/fork 上下文不被支持）
    const log = createWriteStream(logFile, { flags: 'a' });
    await new Promise((res, rej) => {
      log.once('open', res);
      log.once('error', rej);
    });
    const child = spawn(process.execPath, [daemonEntry], {
      detached: true,
      stdio: ['ignore', log, log],
      cwd: process.cwd(),
      env: { ...process.env, CCX_DAEMON_DETACHED: '1' },
    });
    child.unref();
    writeFileSync(pidFile, String(child.pid));
    return emit({ ok: true, pid: child.pid, log: logFile, stateDir });
  }
  // —— service status：探测常驻 daemon ——
  if (sub === 'service' && positional[1] === 'status') {
    const pidFile = resolve(join(process.cwd(), 'build', 'local', 'service.pid'));
    if (!existsSync(pidFile)) return emit({ ok: true, running: false, pid: null });
    const pid = Number(readFileSync(pidFile, 'utf8').trim());
    if (pid && isAlive(pid)) return emit({ ok: true, running: true, pid });
    return emit({ ok: true, running: false, pid, stale: true });
  }
  // —— service stop：按 pid 文件停止 ——
  if (sub === 'service' && positional[1] === 'stop') {
    const pidFile = resolve(join(process.cwd(), 'build', 'local', 'service.pid'));
    if (!existsSync(pidFile)) return emit({ ok: false, error: '没有 pid 文件' });
    const pid = Number(readFileSync(pidFile, 'utf8').trim());
    if (pid && isAlive(pid)) {
      try {
        process.kill(pid);
      } catch (e) {
        return emit({ ok: false, error: '停止失败: ' + e.message });
      }
    }
    try {
      writeFileSync(pidFile, '');
    } catch {
      /* noop */
    }
    return emit({ ok: true, stopped: pid });
  }

  // —— frame dump <scene> [--out ppm] [--size WxH] [--time T]：虚拟帧导出 ——
  if (sub === 'frame' && positional[1] === 'dump') {
    const sceneFile = positional[2];
    if (!sceneFile || !existsSync(sceneFile)) {
      return emit({ ok: false, error: '用法: ccx frame dump <scene.json> [--out <ppm>] [--size 320x180] [--time 0]' });
    }
    const out = flags.out ? resolve(flags.out) : resolve('frame.ppm');
    const m = /^(\d+)x(\d+)$/.exec(flags.size ?? '320x180');
    if (!m) return emit({ ok: false, error: '--size 须为 WxH' });
    const dumpExe = resolve(join(here, '..', '..', '..', 'build', 'local', 'engine', 'tests', 'ccx_frame_dump.exe'));
    if (!existsSync(dumpExe)) {
      return emit({ ok: false, error: '未构建 ccx_frame_dump（先 cmake --build build/local）' });
    }
    const r = spawnSync(dumpExe, [sceneFile, out, m[1], m[2], String(flags.time ?? 0)],
                        { encoding: 'utf8' });
    if (r.status !== 0) return emit({ ok: false, error: (r.stderr || 'frame dump 失败').trim() });
    let meta = {};
    try {
      meta = JSON.parse(r.stdout.trim());
    } catch {
      /* noop */
    }
    return emit({ ok: true, out, width: Number(m[1]), height: Number(m[2]), quads: meta.quads ?? 0 });
  }

  // —— frame gif <scene> --out x.gif --times 0,0.1,0.2 [--size WxH] [--delay 20] ——
  if (sub === 'frame' && positional[1] === 'gif') {
    const sceneFile = positional[2];
    if (!sceneFile || !existsSync(sceneFile) || !flags.times || !flags.out) {
      return emit({ ok: false, error: '用法: ccx frame gif <scene> --times 0,0.1 --out x.gif [--size 160x90] [--delay 20]' });
    }
    const m = /^(\d+)x(\d+)$/.exec(flags.size ?? '160x90');
    if (!m) return emit({ ok: false, error: '--size 须为 WxH' });
    const dumpExe = resolve(join(here, '..', '..', '..', 'build', 'local', 'engine', 'tests', 'ccx_frame_dump.exe'));
    if (!existsSync(dumpExe)) {
      return emit({ ok: false, error: '未构建 ccx_frame_dump（先 cmake --build build/local）' });
    }
    const times = flags.times.split(',').map((t) => t.trim()).filter(Boolean);
    const frames = [];
    const tmpPpms = [];
    try {
      for (const t of times) {
        const ppm = resolve(buildDirName(), 'frame-' + t.replace('.', '_') + '.ppm');
        mkdirSync(dirname(ppm), { recursive: true });
        tmpPpms.push(ppm);
        const args5 = [sceneFile, ppm, m[1], m[2], t];
        if (flags.highlight) args5.push(flags.highlight);  // 接触高亮透传
        args5.push('', '', '1');  // argv[8] 设备路径（FakeDevice 上传/绘制/读回）
        const r = spawnSync(dumpExe, args5, { encoding: 'utf8' });
        if (r.status !== 0) return emit({ ok: false, error: ('帧 t=' + t + ' 失败: ' + r.stderr).trim() });
        const { w, h, data } = parsePpm(readFileSync(ppm));
        const pixels = new Uint8Array(w * h * 4);
        for (let i = 0; i < w * h; ++i) {
          pixels[i * 4] = data[i * 3];
          pixels[i * 4 + 1] = data[i * 3 + 1];
          pixels[i * 4 + 2] = data[i * 3 + 2];
          pixels[i * 4 + 3] = 255;
        }
        frames.push({ w, h, pixels });
      }
      const gif = buildGif(frames, { delayCs: Number(flags.delay) || 20 });
      const out = resolve(flags.out);
      writeFileSync(out, gif);
      return emit({ ok: true, out, frames: frames.length, width: frames[0].w, height: frames[0].h, bytes: gif.length });
    } finally {
      for (const pp of tmpPpms) {
        try {
          rmSync(pp, { force: true });
        } catch {
          /* noop */
        }
      }
    }
  }

  // —— mcp tools / mcp call <name> [json]：MCP 工具面 CLI 入口（services-spec §7）——
  if (sub === 'mcp') {
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
      if (positional[1] === 'tools') {
        const t = await client.request('mcp.listTools');
        return emit({ ok: true, tools: t.tools.map((x) => ({ name: x.name, description: x.description })) });
      }
      if (positional[1] === 'call') {
        const name = positional[2];
        if (!name) return emit({ ok: false, error: '用法: ccx mcp call <name> [<json-args>]' });
        let args = {};
        if (positional[3]) {
          try {
            args = JSON.parse(positional[3]);
          } catch {
            return emit({ ok: false, error: '参数不是合法 JSON' });
          }
        }
        const out = await client.request('mcp.callTool', { name, arguments: args });
        let parsed;
        try {
          parsed = JSON.parse(out.content[0].text);
        } catch {
          parsed = out.content[0].text;
        }
        return emit({ ok: true, tool: name, result: parsed });
      }
      return emit({ ok: false, error: '用法: ccx mcp tools | ccx mcp call <name> [<json-args>]' });
    } finally {
      client.close();
    }
  }

  // —— profiler snapshot [--count N]：临时 daemon -> 帧统计快照 ——
  if (sub === 'profiler' && positional[1] === 'snapshot') {
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
      // 演示采集：记录 3 帧（真实帧数据由运行时经 profiler.record 上报）
      const demo = [
        { frame: 1, frameTimeMs: 16.2, entities: 2, batches: 1, drawCalls: 1, allocBytes: 256 },
        { frame: 2, frameTimeMs: 16.8, entities: 2, batches: 1, drawCalls: 1, allocBytes: 256 },
        { frame: 3, frameTimeMs: 17.1, entities: 3, batches: 2, drawCalls: 2, allocBytes: 512 },
      ];
      for (const d of demo) await client.request('profiler.record', d);
      const snap = await client.request('profiler.snapshot',
                                        { count: Number(flags.count) || 10 });
      const frames = snap.frames.map((f) => ({
        frame: f.frame,
        ms: f.frameTimeMs,
        ents: f.entities,
        draws: f.drawCalls,
      }));
      if (jsonMode) return emit({ ok: true, schema: snap.schema, frames });
      return emit({
        ok: true,
        schema: snap.schema,
        summary: frames.map((f) =>
          '#' + f.frame + ' ' + f.ms + 'ms ents=' + f.ents + ' draws=' + f.draws).join('\n'),
      });
    } finally {
      client.close();
    }
  }

  // —— doctor / version ——
  if (sub === 'version') return emit({ ok: true, name: '@ccx/cli', version: '0.1.0', milestone: 'M1' });
  if (sub === 'doctor' && flags.demo) {
    // 一键 e2e 健康：自跑 demo all 并汇总（输出经临时文件，规避嵌套 stdout 怪癖）
    const selfPath = resolve(join(here, '..', 'bin', 'ccx.mjs'));
    const tmpOut = join(buildDirName(), 'doctor-demo.json');
    mkdirSync(dirname(tmpOut), { recursive: true });
    const fd = openSync(tmpOut, 'w');
    const r = spawnSync(process.execPath, [selfPath, 'demo', 'all', '--json'],
                        { stdio: ['ignore', fd, 'ignore'] });
    closeSync(fd);
    if (r.status !== 0 || r.error) {
      return emit({ ok: false, error: 'demo all 失败: ' +
                    (r.error ? String(r.error) : 'exit ' + r.status) });
    }
    if (r.status !== 0 || r.error) {
      return emit({ ok: false, error: 'demo all 失败: ' +
                    (r.error ? String(r.error) : (r.stderr || '').slice(0, 300)) });
    }
    let demo = null;
    try {
      demo = JSON.parse(readFileSync(tmpOut, 'utf8'));
    } catch (e) {
      return emit({ ok: false, error: 'demo all 输出解析失败: ' + e.message });
    }
    const totalMs = demo.steps.reduce((a, s) => a + (s.ms ?? 0), 0);
    return emit({
      ok: demo.ok === true,
      tool: 'ccx doctor',
      cwd: process.cwd(),
      demo: {
        steps: demo.steps.length,
        allOk: demo.ok === true,
        totalMs,
        slowest: demo.steps.reduce((a, s) => ((s.ms ?? 0) > (a.ms ?? 0) ? s : a), { ms: 0 }).name ?? null,
      },
      hint: demo.ok === true ? '交付链 8 步全绿（e2e 健康）' : '交付链有步骤失败，见 demo all 输出',
    });
  }
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
      '粒子模块': existsSync(join(cwd, 'engine', 'particle', 'include')),
      '输入模块': existsSync(join(cwd, 'engine', 'input', 'include')),
      '帧循环模块': existsSync(join(cwd, 'engine', 'game', 'include')),
      '资产注册表模块': existsSync(join(cwd, 'engine', 'assets', 'include')),
      '物理模块': existsSync(join(cwd, 'engine', 'physics', 'include')),
      '音频模块': existsSync(join(cwd, 'engine', 'audio', 'include')),
      '引擎模块计数': readdirSync(join(cwd, 'engine'))
        .filter((n) => existsSync(join(cwd, 'engine', n, 'CMakeLists.txt'))).length,
      'Node 测试文件数': countTestFilesSync(cwd),
      'CTest 数（本地）': countAddTestSync(cwd),
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
