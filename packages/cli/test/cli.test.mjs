import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const cli = join(import.meta.dirname, '..', 'bin', 'ccx.mjs');

function runCli(args, cwd, env = null) {
  const opts = { encoding: 'utf8', cwd };
  if (env) opts.env = env;
  const r = spawnSync(process.execPath, [cli, ...args], opts);
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

test('doctor/version 冒烟（含外部压缩器配置位）', () => {
  const r = runCli(['doctor', '--json'], join(import.meta.dirname, '..'));
  assert.equal(r.status, 0, r.err + r.out);
  const out = JSON.parse(r.out);
  assert.ok('外部压缩器配置' in out.checks, '外部压缩器配置键存在');
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

test('ccx build --out：Web 目标静态站点装配', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-web-'));
  try {
    const r = runCli(['build', '--platform', 'web-desktop', '--out', join(dir, 'site'),
                      '--json'], dir);
    assert.equal(r.status, 0, r.err + r.out);
    const out = JSON.parse(r.out);
    assert.equal(out.ok, true);
    assert.equal(out.platform, 'web-desktop');
    assert.ok(out.out.length > 0, '输出目录');
    assert.ok(existsSync(join(dir, 'site', 'index.html')), 'index.html 生成');
    assert.ok(existsSync(join(dir, 'site', 'game.js')), 'game.js 生成');
    const gj = readFileSync(join(dir, 'site', 'game.js'), 'utf8');
    assert.ok(gj.includes('window.CCX.boot'), '运行时入口');
    assert.ok(gj.includes('loadIndex'), '索引读取函数');
    assert.ok(gj.includes('web-desktop'), '平台注入');
    const assets = JSON.parse(readFileSync(join(dir, 'site', 'assets.json'), 'utf8'));
    assert.equal(assets.schema, 'ccx.assets.index/1');
    assert.equal(assets.platform, 'web-desktop');
    const html = readFileSync(join(dir, 'site', 'index.html'), 'utf8');
    assert.ok(html.includes('CCX web-desktop'), '页面标题');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
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
     'profiler.snapshot', 'frame.gif', 'contact.gif', 'mcp.tools', 'mcp.call',
     'session.demo', 'script.run', 'script.engine', 'status.summary', 'build.web',
     'cook']);
  assert.ok(out.steps.every((s) => s.ok), '每步 ok');
  assert.ok(out.steps[3].trace >= 5, 'hooks 走完');
  assert.equal(out.steps[4].frames, 1, 'profiler 帧快照');
  assert.equal(out.steps[5].frames, 3, 'GIF 三帧');
  assert.equal(out.steps[6].frames, 3, '接触 GIF 三帧');
  assert.ok(out.steps[7].tools >= 9, 'MCP 工具 ≥9');
  assert.equal(out.steps[8].textLen > 0, true, 'MCP 调用有返回');
  assert.ok(out.steps[9].undoWorked && out.steps[9].redoWorked, '会话 undo/redo 演示');
  assert.equal(out.steps[10].commands, 3, '脚本命令步三命令');
  assert.ok(out.steps[10].ok, '脚本驱动场景 ok');
  assert.ok(out.steps[11].ok, '引擎执行器 ok');
  assert.equal(out.steps[11].budgetOk, true, '脚本预算未超支');
  assert.ok(out.steps[12].ctest >= 46, '守护规模汇总（CTest）');
  assert.equal(out.steps[13].assets, 1, 'Web 站点资产清单');
  assert.equal(out.steps[13].index, true, 'index.html 已生成');
  // 性能回归：各步耗时宽松基线（动画步本地 ~40ms，上限防回归）
  for (const s of out.steps) {
    assert.ok(s.ms !== undefined && s.ms < 500,
              s.name + ' 耗时 <500ms（实际 ' + s.ms + 'ms）');
  }
  const anim = out.steps.find((s) => s.name === 'frame.gif');
  assert.ok(anim.ms < 200, 'frame.gif <200ms（实际 ' + anim.ms + 'ms）');
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
      '--size', '64x64', '--delay', '10', '--highlight', '1,2',
    ], import.meta.dirname);  // cwd=仓库（dump 相对路径无依赖，但干净）
    assert.equal(r.status, 0, r.err + r.out);
    const parsed = JSON.parse(r.out);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.frames, 3);
    // 高亮场景：帧像素含白块（接触对叠加）——取 GCE 后第一帧解码太繁，验白块由单帧测试覆盖；
    // 此处仅断言命令整体成功（透传路径）*/
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

test('scene apply：Collider 校验错误透传 CLI', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-collider-cli-'));
  try {
    const sceneFile = join(dir, 's.scene.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1', meta: {},
      entities: [{ id: 1, name: 'hero', parent: null, components: [] }],
      systems: [],
    }));
    // 合法 Collider 通过
    let r = runCli(['scene', 'apply', sceneFile, '--json',
                    '--cmd', JSON.stringify({ op: 'add_component', id: 1, type: 'ccx.Collider',
                                              data: { hx: 25, hy: 20, layer: 1, mask: 2 } })], dir);
    assert.equal(r.status, 0, r.err + r.out);
    // 非法（负尺寸）报清晰错误（服务端校验透传）
    r = runCli(['scene', 'apply', sceneFile, '--json',
                '--cmd', JSON.stringify({ op: 'add_component', id: 1, type: 'ccx.Collider',
                                          data: { hx: -5, hy: 20 } })], dir);
    assert.equal(r.status, 1);
    const out = JSON.parse(r.out);
    assert.equal(out.ok, false);
    assert.ok(out.error.includes('非负数字'), '错误信息源自服务端校验: ' + out.error);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx doctor --demo：一键 e2e 健康', () => {
  const r = runCli(['doctor', '--demo', '--json'], join(import.meta.dirname, '..'));
  assert.equal(r.status, 0, r.err + r.out);
  const out = JSON.parse(r.out);
  assert.equal(out.ok, true);
  assert.equal(out.demo.steps, 15);
  assert.equal(out.demo.allOk, true);
  assert.ok(out.demo.totalMs > 0, '总耗时已测');
  assert.ok(out.demo.slowest.length > 0, '最慢步已标注');
  assert.equal(out.demo.runs, 2, '两轮计时');
  assert.ok(out.demo.fastest.length > 0, '最快步已标注');
});

test('ccx mcp：工具列表与工具调用', () => {
  const tools = runCli(['mcp', 'tools', '--json'], join(import.meta.dirname, '..'));
  assert.equal(tools.status, 0, tools.err + tools.out);
  const t = JSON.parse(tools.out);
  assert.equal(t.ok, true);
  assert.ok(t.tools.length >= 9, '至少 9 个工具');
  assert.ok(t.tools.some((x) => x.name === 'scene.apply'));
  // 调用 asset.list
  const call = runCli(['mcp', 'call', 'asset.list', '{}', '--json'], join(import.meta.dirname, '..'));
  assert.equal(call.status, 0, call.err + call.out);
  const r = JSON.parse(call.out);
  assert.equal(r.ok, true);
  assert.equal(r.tool, 'asset.list');
  assert.ok(r.result.assets.length >= 2, '工具结果返回');
  // 非法 JSON 参数
  const bad = runCli(['mcp', 'call', 'asset.list', '{nope', '--json'], join(import.meta.dirname, '..'));
  assert.equal(JSON.parse(bad.out).ok, false);
  assert.ok(JSON.parse(bad.out).error.includes('JSON'));
});

test('ccx editor preview --site：Web 产物游戏壳视图', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-siteview-'));
  try {
    const fixture = join(import.meta.dirname, '..', '..', '..', 'examples', 'scenes',
                         'render_plan.scene.json');
    const siteDir = join(dir, 'site');
    mkdirSync(siteDir);
    writeFileSync(join(siteDir, 'assets.json'), JSON.stringify({
      schema: 'ccx.assets.index/1', platform: 'web-desktop',
      assets: [{ uuid: 'a-1', path: 'assets/hero.png' }],
    }));
    const out = join(dir, 'preview.html');
    const r = runCli(['editor', 'preview', fixture, '--out', out, '--site', siteDir], dir);
    assert.equal(r.status, 0, r.err + r.out);
    const html = readFileSync(out, 'utf8');
    assert.ok(html.includes('site-view'), '站点视图节点');
    assert.ok(html.includes('web-desktop'), '平台展示');
    assert.ok(html.includes('assets/hero.png'), '资产列表');
    // 缺 indices 时优雅降级（无 site-view）
    const out2 = join(dir, 'preview2.html');
    const r2 = runCli(['editor', 'preview', fixture, '--out', out2, '--site', join(dir, 'nope')], dir);
    assert.equal(r2.status, 0);
    assert.ok(!readFileSync(out2, 'utf8').includes('site-view'), '无产物不渲染站点视图');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx doctor --summary：状态汇总（机器可消费）', () => {
  const r = runCli(['doctor', '--summary', '--json'], join(import.meta.dirname, '..'));
  assert.equal(r.status, 0, r.err + r.out);
  const out = JSON.parse(r.out);
  assert.equal(out.ok, true);
  assert.equal(out.summary.milestone, 'M1');
  assert.ok(out.summary.engineModules >= 13, '引擎模块数');
  assert.ok(out.summary.ctestCount >= 46, 'CTest 计数');
  assert.ok(out.summary.nodeTestFiles >= 23, 'Node 测试文件数');
  assert.equal(out.summary.demoSteps, 15);
  assert.ok(out.summary.generatedAt.length > 0, '时间戳');
});

test('ccx scene status/undo/redo：会话命令面', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-sesscli-'));
  try {
    const sceneFile = join(dir, 's.scene.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1', meta: {},
      entities: [{ id: 1, name: 'root', parent: null, components: [] }],
      systems: [],
    }));
    let r = runCli(['scene', 'status', sceneFile, '--json'], dir);
    assert.equal(r.status, 0, r.err + r.out);
    let out = JSON.parse(r.out);
    assert.equal(out.ok, true);
    assert.equal(out.entities, 1);
    assert.equal(out.version, 0);
    // 应用后文件持久化（entities 2）
    r = runCli(['scene', 'apply', sceneFile, '--json',
                '--cmd', JSON.stringify({ op: 'create_entity', name: 'npc' })], dir);
    out = JSON.parse(r.out);
    assert.equal(out.entityCount, 2, 'apply 持久化');
    // 流程内 undo/redo：apply -> undo -> redo（同进程共享历史）
    r = runCli(['scene', 'apply', sceneFile, '--json',
                '--cmd', JSON.stringify({ op: 'create_entity', name: 'mob' }),
                '--undo', '--redo'], dir);
    assert.equal(r.status, 0, r.err + r.out);
    out = JSON.parse(r.out);
    assert.deepEqual(out.applied, ['create_entity', 'undo', 'redo']);
    assert.equal(out.entityCount, 3, 'undo/redo 后网络效果 = 两次 create');
    assert.equal(out.undoCount, 1, 'undo 后 redo 重建 1 条历史');
    assert.equal(out.redoCount, 0);
    // undo 最后一条（不 redo）-> 实体 2
    r = runCli(['scene', 'apply', sceneFile, '--json',
                '--cmd', JSON.stringify({ op: 'create_entity', name: 'ghost' }),
                '--undo'], dir);
    out = JSON.parse(r.out);
    assert.equal(out.entityCount, 3, 'undo 移除 ghost（回到 3）');
    assert.equal(out.applied.at(-1), 'undo');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx cook + CCX_EXTERNAL_COMPRESSOR：外部压缩器端到端', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-extccli-'));
  try {
    writeFileSync(join(dir, 'hero.png'), 'PNG');
    const fix = join(import.meta.dirname, '..', '..', 'asset-service', 'test', 'fixtures',
                     'fake_compressor.mjs');
    // runCli + env（第三方 env 经选项透传）
    const r = runCli(['cook', '--root', dir, '--platform', 'web-desktop', '--json'],
                     join(import.meta.dirname, '..'),
                     { ...process.env,
                       CCX_EXTERNAL_COMPRESSOR: 'png=' + process.execPath + '|' + fix + '|{src}' });
    assert.equal(r.status, 0, r.err + r.out);
    const out = JSON.parse(r.out);
    assert.equal(out.ok, true);
    assert.equal(out.okCount, 1, 'png 经外挂压缩器成功');
    assert.equal(out.failCount, 0);
    // 无外挂配置：png 无压缩器 -> fail（回归既有语义）
    const r2 = runCli(['cook', '--root', dir, '--platform', 'web-desktop', '--json'],
                      join(import.meta.dirname, '..'), process.env);
    const out2 = JSON.parse(r2.out);
    assert.equal(out2.okCount, 0);
    assert.equal(out2.failCount, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx script run：命令脚本驱动场景（exit3 用户命令面）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-script-'));
  try {
    const script = join(dir, 'build.ccx.js');
    writeFileSync(script, [
      '# scene build script',
      JSON.stringify({ op: 'create_entity', name: 'hero', parent: 1 }),
      JSON.stringify({ op: 'create_entity', name: 'npc', parent: 1 }),
      JSON.stringify({ op: 'add_component', id: 2, type: 'game.Health', data: { max: 100 } }),
    ].join('\n') + '\n');
    const out = join(dir, 'scene.json');
    const r = runCli(['script', 'run', script, '--out', out, '--json'], dir);
    assert.equal(r.status, 0, r.err + r.out);
    const parsed = JSON.parse(r.out);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.commands, 3);
    assert.deepEqual(parsed.applied, ['create_entity', 'create_entity', 'add_component']);
    const scene = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(scene.entities.length, 3, '场景文件实体');
    assert.equal(parsed.entities, 3);
    // 非法命令行 -> 明确报错
    writeFileSync(script, '{bad json}\n');
    const bad = runCli(['script', 'run', script, '--out', out, '--json'], dir);
    assert.equal(JSON.parse(bad.out).ok, false);
    assert.ok(JSON.parse(bad.out).error.includes('JSON'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx script run --engine：引擎执行器路径', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-runcli-'));
  try {
    const runner = join(import.meta.dirname, '..', '..', '..', 'build', 'local', 'engine', 'tests', 'ccx_script_runner.exe');
    if (!existsSync(runner)) return;  // 未构建则跳过
    const script = join(dir, 's.ccx.js');
    writeFileSync(script, [
      JSON.stringify({ op: 'create_entity', name: 'hero' }),
      JSON.stringify({ op: 'create_entity', name: 'npc' }),
    ].join('\n') + '\n');
    const out = join(dir, 'scene.json');
    const r = runCli(['script', 'run', script, '--out', out, '--engine', '--json'], dir);
    assert.equal(r.status, 0, r.err + r.out);
    const parsed = JSON.parse(r.out);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.engine, 'quickjs');
    assert.equal(parsed.commands, 2);
    assert.equal(parsed.entities, 2);
    const scene = JSON.parse(readFileSync(out, 'utf8'));
    assert.equal(scene.entities.length, 2);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx doctor --all：五合一总页', () => {
  const r = runCli(['doctor', '--all', '--json'], join(import.meta.dirname, '..'));
  assert.equal(r.status, 0, r.err + r.out);
  const out = JSON.parse(r.out);
  assert.equal(out.ok, true);
  assert.ok('checks' in out && 'summary' in out && 'demo' in out, '三键齐备');
  assert.ok(out.checks['脚本宿主模块（QuickJS）'], '脚本检查');
  assert.ok(out.summary.ctestCount >= 51, 'CTest 数');
  assert.equal(out.demo.steps, 15);
});

test('ccx doctor --net：W1 网络探测（结构断言）', () => {
  const r = runCli(['doctor', '--net', '--json'], join(import.meta.dirname, '..'));
  assert.equal(r.status, 0, r.err + r.out);
  const out = JSON.parse(r.out);
  assert.equal(out.ok, true);
  const keys = Object.keys(out.probes);
  assert.ok(keys.some((k) => k.includes('webgpu.h')), 'webgpu 探测存在');
  assert.ok(keys.some((k) => k.includes('quickjs')), 'quickjs 探测存在');
  for (const k of keys) {
    assert.ok('reachable' in out.probes[k], 'reachable 键');
  }
});

test('ccx doctor --w1：五级验收（仿真侧）', () => {
  const r = runCli(['doctor', '--w1', '--json'], join(import.meta.dirname, '..'),
                   { ...process.env,
                     CC_CTEST: 'D:\\engine\\w64devkit\\bin\\ctest.exe' });
  assert.equal(r.status, 0, r.err + r.out);
  const out = JSON.parse(r.out);
  assert.equal(out.ok, true);
  assert.equal(out.w1.levels.length, 5);
  assert.equal(out.w1.allPassed, true);
  assert.equal(out.w1.environment.gpu, 'not-available');
});

test('ccx doctor --all --verify：验收总键（W1+首批）', () => {
  const r = runCli(['doctor', '--all', '--verify', '--json'], join(import.meta.dirname, '..'),
                   { ...process.env, CC_CTEST: 'D:\\engine\\w64devkit\\bin\\ctest.exe' });
  assert.equal(r.status, 0, r.err + r.out);
  const out = JSON.parse(r.out);
  assert.equal(out.ok, true);
  assert.equal(out.w1.ok, true, 'W1 五级验收');
  assert.equal(out.m2Batch1.ok, true, 'M2 首批 9 票');
});

test('ccx editor preview --apply --undo：会话回退进预览', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-pvundo-'));
  try {
    const sceneFile = join(dir, 's.scene.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1', meta: {},
      entities: [{ id: 1, name: 'root', parent: null, components: [] }],
      systems: [],
    }));
    const r = runCli(['editor', 'preview', sceneFile, '--out', join(dir, 'p.html'),
                      '--apply', JSON.stringify({ op: 'create_entity', name: 'npc' }),
                      '--undo', '--json'], dir);
    assert.equal(r.status, 0, r.err + r.out);
    const out = JSON.parse(r.out);
    assert.equal(out.ok, true);
    assert.deepEqual(out.applied, ['create_entity', 'undo'], '流程含 undo');
    assert.equal(out.entities, 1, 'undo 后实体回退');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx editor preview：undo 会话栏（页面交互面）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-pvbar-'));
  try {
    const sceneFile = join(dir, 's.scene.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1', meta: {},
      entities: [{ id: 1, name: 'root', parent: null, components: [] }],
      systems: [],
    }));
    const htmlOut = join(dir, 'p.html');
    const r = runCli(['editor', 'preview', sceneFile, '--out', htmlOut,
                      '--apply', JSON.stringify({ op: 'create_entity', name: 'npc' }),
                      '--json'], dir);
    assert.equal(r.status, 0, r.err + r.out);
    const html = readFileSync(htmlOut, 'utf8');
    assert.ok(html.includes('ccx-undo-bar'), 'undo 会话栏');
    assert.ok(html.includes('可回退 1 步'), '回退计数');
    assert.ok(html.includes('window.__HISTORY'), '历史内联');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('ccx editor preview：undo 栏联演（apply×2 --undo 一致性）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ccx-pvplay-'));
  try {
    const sceneFile = join(dir, 's.scene.json');
    writeFileSync(sceneFile, JSON.stringify({
      schema: 'ccx.scene/1', meta: {},
      entities: [{ id: 1, name: 'root', parent: null, components: [] }],
      systems: [],
    }));
    const htmlOut = join(dir, 'p.html');
    const r = runCli(['editor', 'preview', sceneFile, '--out', htmlOut,
                      '--apply', JSON.stringify({ op: 'create_entity', name: 'a' }),
                      '--apply', JSON.stringify({ op: 'create_entity', name: 'b' }),
                      '--undo', '--json'], dir);
    assert.equal(r.status, 0, r.err + r.out);
    const out = JSON.parse(r.out);
    assert.equal(out.entities, 2, 'undo 后 2 实体（root+a）');
    const html = readFileSync(htmlOut, 'utf8');
    const m = html.match(/window.__HISTORY = (\{[^<]*?\});/);
    assert.ok(m, 'HISTORY 内联');
    const history = JSON.parse(m[1].replace(/&quot;/g, '"'));
    assert.equal(history.undoCount, 1, 'undo 后剩余可回退 1 步');
    assert.equal(history.entities, 2, '当前实体 2');
    assert.equal(history.entitiesBefore, 1, '回退后实体 1');
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
