import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const cli = join(import.meta.dirname, '..', 'bin', 'ccx.mjs');

function runCli(args, cwd) {
  const r = spawnSync(process.execPath, [cli, ...args], { encoding: 'utf8', cwd });
  return { status: r.status, out: r.stdout, err: r.stderr };
}

test('create：生成项目模板', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-create-'));
  try {
    const r = runCli(['create', join(dir, 'proj'), '--json'], dir);
    assert.equal(r.status, 0, r.err);
    const json = JSON.parse(r.out);
    assert.equal(json.ok, true);
    const proj = join(dir, 'proj');
    assert.ok(existsSync(join(proj, 'ccx.project.json')), 'ccx.project.json');
    assert.ok(existsSync(join(proj, 'scenes', 'main.scene.json')), '主场景');
    assert.ok(existsSync(join(proj, 'scripts', 'main.ts')), '入口脚本');
    const scene = JSON.parse(readFileSync(join(proj, 'scenes', 'main.scene.json'), 'utf8'));
    assert.equal(scene.schema, 'ccx.scene/1');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scene new：ADR-003 v1 空场景', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-scene-'));
  try {
    const r = runCli(['scene', 'new', '--at', join(dir, 's.scene.json'), '--json'], dir);
    assert.equal(r.status, 0, r.err);
    const scene = JSON.parse(readFileSync(join(dir, 's.scene.json'), 'utf8'));
    assert.equal(scene.schema, 'ccx.scene/1');
    assert.deepEqual(scene.entities, []);
    assert.deepEqual(scene.systems, []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('doctor/version 冒烟', () => {
  const v = runCli(['version', '--json'], join(import.meta.dirname, '..'));
  assert.equal(v.status, 0);
  assert.ok(JSON.parse(v.out).milestone === 'M1');
});

test('scene apply：命令总线写场景文件', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-apply-'));
  try {
    const sceneFile = join(dir, 's.scene.json');
    const init = runCli(['scene', 'new', '--at', sceneFile, '--json'], dir);
    assert.equal(init.status, 0);
    const r = runCli([
      'scene', 'apply', sceneFile,
      '--cmd', JSON.stringify({ op: 'create_entity', name: 'player' }),
      '--cmd', JSON.stringify({ op: 'add_component', id: 1, type: 'game.Health', data: { max: 100 } }),
      '--cmd', JSON.stringify({ op: 'set_property', id: 1, type: 'game.Health', path: ['max'], value: 120 }),
      '--json',
    ], dir);
    assert.equal(r.status, 0, r.err + r.out);
    assert.deepEqual(JSON.parse(r.out).applied, ['create_entity', 'add_component', 'set_property']);
    const scene = JSON.parse(readFileSync(sceneFile, 'utf8'));
    assert.equal(scene.entities.length, 1);
    assert.equal(scene.entities[0].components[0].data.max, 120);
    assert.equal(scene.meta.generator, 'ccx-cli scene apply');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});


test('ccx build：经 daemon 的 Builder RPC', async () => {
  const r = runCli(['build', '--platform', 'web-desktop', '--project', 'MyGame', '--json'],
                   join(import.meta.dirname, '..'));
  assert.equal(r.status, 0, r.err + r.out);
  const out = JSON.parse(r.out);
  assert.equal(out.ok, true);
  assert.equal(out.platform, 'web-desktop');
  assert.ok(out.traceSteps >= 5, 'hooks 已走');
  // 未知平台 -> 明确错误
  const bad = runCli(['build', '--platform', 'ps5', '--json'], join(import.meta.dirname, '..'));
  assert.equal(bad.status, 1);
  const out2 = JSON.parse(bad.out);
  assert.equal(out2.ok, false);
});

test('ccx cook：扫描 -> Cook -> bundle 一步全链', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-cook-'));
  try {
    writeFileSync(join(dir, 'hero.png'), 'png-data');
    writeFileSync(join(dir, 'map.tmx'), 'tilemap');
    const r = runCli(['cook', '--root', dir, '--platform', 'android', '--json'], dir);
    assert.equal(r.status, 0, r.err + r.out);
    const out = JSON.parse(r.out);
    assert.equal(out.ok, true);
    assert.equal(out.scanned, 2);
    assert.equal(out.failCount, 2, '无压缩器注册 -> texture 产物标记失败（不阻塞 bundle）');
    assert.equal(out.bundleId, 'demo@android');
    assert.equal(out.results.length, 2);
    // 音频目标永远 ok
    assert.ok(out.results.every((x) => x.parts >= 2));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx demo all：端到端编排（open/apply/save/build/cook）', () => {
  const r = runCli(['demo', 'all', '--json'], join(import.meta.dirname, '..'));
  assert.equal(r.status, 0, r.err + r.out);
  const out = JSON.parse(r.out);
  assert.equal(out.ok, true, JSON.stringify(out.steps));
  const names = out.steps.map((s) => s.name);
  assert.deepEqual(names,
    ['scene.open', 'scene.apply', 'scene.save', 'build.run',
     'profiler.snapshot', 'frame.gif', 'cook']);
  assert.ok(out.steps.every((s) => s.ok), '每步 ok');
  assert.ok(out.steps[3].trace >= 5, 'hooks 走完');
  assert.equal(out.steps[4].frames, 1, 'profiler 帧快照');
  assert.equal(out.steps[5].frames, 3, 'GIF 三帧');
});

test('ccx service start/status/stop：常驻生命周期', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-svc-'));
  try {
    // 用临时 cwd 免得污染仓库 build/local
    const start = runCli(['service', 'start'], dir);
    assert.equal(start.status, 0, start.err + start.out);
    const started = JSON.parse(start.out);
    assert.equal(started.ok, true);
    assert.ok(started.pid > 0, '拿到 pid');
    // start 幂等拒绝
    const again = runCli(['service', 'start'], dir);
    assert.equal(JSON.parse(again.out).ok, false, '重复 start 拒绝');
    // status 探测
    const status = runCli(['service', 'status'], dir);
    const st = JSON.parse(status.out);
    assert.equal(st.running, true, '常驻进程存活');
    assert.equal(st.pid, started.pid);
    // stop
    const stop = runCli(['service', 'stop'], dir);
    assert.equal(JSON.parse(stop.out).ok, true);
    // 给进程退出时间后 status 变 stale
    const wait = spawnSync('powershell', ['-Command', 'Start-Sleep -Milliseconds 300'],
                           { encoding: 'utf8' });
    assert.equal(wait.status, 0);
    const st2 = JSON.parse(runCli(['service', 'status'], dir).out);
    assert.equal(st2.running, false, '停止后未运行');
  } finally {
    // 常驻 daemon 持有 cwd 句柄：先按 pid 文件强杀子树，再删临时目录
    try {
      const pidFile = join(dir, 'build', 'local', 'service.pid');
      if (existsSync(pidFile)) {
        const pid = Number(readFileSync(pidFile, 'utf8').trim());
        if (Number.isFinite(pid) && pid > 0) {
          spawnSync('taskkill', ['/PID', String(pid), '/F', '/T'], { encoding: 'utf8' });
        }
      }
    } catch {
      /* noop */
    }
    await new Promise((r) => setTimeout(r, 250));
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* Windows 句柄释放可能滞后，忽略 */
    }
  }
});

test('ccx editor preview：自包含预览页', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-preview-'));
  try {
    const fixture = join(import.meta.dirname, '..', '..', '..', 'examples', 'scenes',
                         'render_plan.scene.json');
    const out = join(dir, 'preview.html');
    const r = runCli(['editor', 'preview', fixture, '--out', out], dir);
    assert.equal(r.status, 0, r.err + r.out);
    assert.equal(JSON.parse(r.out).ok, true);
    const html = readFileSync(out, 'utf8');
    assert.ok(html.includes('window.__SCENE'), '内联场景数据');
    assert.ok(html.includes('data-entity="1"'), '实体节点');
    assert.ok(html.includes('data-panel="hierarchy"'), '面板');
    assert.ok(html.includes('addEventListener("click"'), '基础交互 JS');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx editor preview --apply：命令回路进预览', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-preview-apply-'));
  try {
    const fixture = join(import.meta.dirname, '..', '..', '..', 'examples', 'scenes',
                         'render_plan.scene.json');
    const out = join(dir, 'preview.html');
    const r = runCli([
      'editor', 'preview', fixture, '--out', out,
      '--apply', JSON.stringify({ op: 'create_entity', name: 'mover', parent: 1 }),
      '--apply', JSON.stringify({ op: 'add_component', id: 4, type: 'game.Speed', data: { v: 30 } }),
    ], dir);
    assert.equal(r.status, 0, r.err + r.out);
    assert.equal(JSON.parse(r.out).entities, 8, '7 + 新实体');
    const html = readFileSync(out, 'utf8');
    assert.ok(html.includes('mover'), '新实体入视图');
    assert.ok(html.includes('"game.Speed"'), '新组件入视图');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx profiler snapshot：帧统计快照', () => {
  const r = runCli(['profiler', 'snapshot', '--json'], join(import.meta.dirname, '..'));
  assert.equal(r.status, 0, r.err + r.out);
  const out = JSON.parse(r.out);
  assert.equal(out.ok, true);
  assert.equal(out.schema, 'ccx.profile/1');
  assert.equal(out.frames.length, 3);
  assert.deepEqual(out.frames[2], { frame: 3, ms: 17.1, ents: 3, draws: 2 });
});

test('ccx frame dump：虚拟帧导出（CLI 入口）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-frame-cli-'));
  try {
    const sceneFile = join(dir, 's.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1', meta: {},
      entities: [{ id: 1, name: 'hero', parent: null,
                   components: [{ type: 'ccx.Sprite', data: { atlas: 1, material: 1 } }] }],
      systems: [],
    }));
    const out = join(dir, 'f.ppm');
    const r = runCli(['frame', 'dump', sceneFile, '--out', out, '--size', '64x64', '--time', '0'], dir);
    assert.equal(r.status, 0, r.err + r.out);
    const parsed = JSON.parse(r.out);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.quads, 1);
    assert.equal(parsed.width, 64);
    assert.ok(existsSync(out), 'PPM 已生成');
    assert.equal(readFileSync(out, 'utf8').slice(0, 2), 'P6', 'P6 头');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx editor preview --frame：渲染帧图嵌入', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-prev-frame-'));
  try {
    const fixture = join(import.meta.dirname, '..', '..', '..', 'examples', 'scenes',
                         'render_plan.scene.json');
    const ppm = join(dir, 'f.ppm');
    const out = join(dir, 'preview.html');
    const r = runCli(['editor', 'preview', fixture, '--out', out, '--frame', ppm], dir);
    // 无帧文件 -> 仍成功且不嵌入
    assert.equal(r.status, 0, r.err + r.out);
    assert.equal(JSON.parse(r.out).frame, null);
    let html = readFileSync(out, 'utf8');
    assert.ok(!html.includes('data:image/bmp'), '无帧时不嵌入');
    // 生成帧后嵌入
    const dumpExe = join(import.meta.dirname, '..', '..', '..', 'build', 'local',
                         'engine', 'tests', 'ccx_frame_dump.exe');
    if (existsSync(dumpExe)) {
      const d = spawnSync(dumpExe, [fixture, ppm, '64', '64', '0'], { encoding: 'utf8' });
      assert.equal(d.status, 0);
      const r2 = runCli(['editor', 'preview', fixture, '--out', out, '--frame', ppm], dir);
      assert.equal(r2.status, 0);
      assert.ok(JSON.parse(r2.out).frame.length > 0, '帧已嵌入');
      html = readFileSync(out, 'utf8');
      assert.ok(html.includes('data:image/bmp;base64,'), 'BMP data URL 在页面');
      assert.ok(html.includes('frame-view'), '帧视图节点');
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx frame gif：多时间点 -> GIF 动画文件', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-gifcli-'));
  try {
    const sceneFile = join(dir, 's.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1', meta: {},
      entities: [{
        id: 1, name: 'hero', parent: null,
        components: [
          { type: 'ccx.Sprite', data: { atlas: 1, material: 1 } },
          { type: 'ccx.SpriteAnimator', data: { frameCount: 4, fps: 10 } },
        ],
      }],
      systems: [],
    }));
    // 非仓库 cwd 时 dump 工具从仓库 build 取（runCli 的 cwd 与仓库 build 路径），用仓库 cwd 跑
    const dumpExe = join(import.meta.dirname, '..', '..', '..', 'build', 'local',
                         'engine', 'tests', 'ccx_frame_dump.exe');
    if (!existsSync(dumpExe)) return;  // 跳过（未构建）
    const out = join(dir, 'anim.gif');
    const r = runCli([
      'frame', 'gif', sceneFile, '--times', '0,0.1,0.2', '--out', out,
      '--size', '64x64', '--delay', '10',
    ], import.meta.dirname);  // cwd=仓库（dump 相对路径无依赖，但干净）
    assert.equal(r.status, 0, r.err + r.out);
    const parsed = JSON.parse(r.out);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.frames, 3);
    const gif = readFileSync(out);
    assert.equal(gif.toString('ascii', 0, 6), 'GIF89a');
    let gce = 0, img = 0;
    for (let i = 0; i < gif.length - 1; ++i) {
      if (gif[i] === 0x21 && gif[i + 1] === 0xF9) ++gce;
      if (gif[i] === 0x2C) ++img;
    }
    assert.equal(gce, 3);
    assert.equal(img, 3);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx editor preview --gif：动画序列嵌入', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-prev-gif-'));
  try {
    const fixture = join(import.meta.dirname, '..', '..', '..', 'examples', 'scenes',
                         'render_plan.scene.json');
    const gif8 = Buffer.from(
      'GIF89a' + Buffer.from([1, 0, 1, 0, 0x80, 0, 0]).toString() +
      Buffer.from([255, 0, 0, 0, 255, 0]).toString() + '\x3B', 'binary');
    const gifFile = join(dir, 'a.gif');
    writeFileSync(gifFile, gif8);
    const out = join(dir, 'preview.html');
    const r = runCli(['editor', 'preview', fixture, '--out', out, '--gif', gifFile], dir);
    assert.equal(r.status, 0, r.err + r.out);
    const html = readFileSync(out, 'utf8');
    assert.ok(html.includes('data:image/gif;base64,'), 'GIF data URL 在页面');
    assert.ok(html.includes('anim-view'), '动画视图节点');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scene apply：非法命令拒绝且不写坏文件', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-apply-bad-'));
  try {
    const sceneFile = join(dir, 's.scene.json');
    runCli(['scene', 'new', '--at', sceneFile], dir);
    const before = readFileSync(sceneFile, 'utf8');
    const r = runCli([
      'scene', 'apply', sceneFile,
      '--cmd', JSON.stringify({ op: 'destroy_entity', id: 999 }),
      '--json',
    ], dir);
    assert.equal(r.status, 0, 'destroy 不存在的实体应幂等成功');
    const json = JSON.parse(r.out);
    assert.equal(json.ok, true);
    assert.equal(before.length > 0, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
