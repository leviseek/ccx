import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorShell } from '../src/shell.mjs';
import { CommandBus, SceneState } from '../../scene-service/src/commands.mjs';

test('命令注册/执行/审计日志', () => {
  const shell = new EditorShell();
  let ran = 0;
  shell.registerCommand('scene.save', '保存场景', () => { ran++; });
  shell.run('scene.save');
  assert.equal(ran, 1);
  assert.equal(shell.log.at(-1).command, 'scene.save');
  assert.throws(() => shell.run('nope'), /未注册/);
});

test('快捷键：归一化 + 派发', () => {
  const shell = new EditorShell();
  let saved = 0;
  shell.registerCommand('scene.save', '保存', () => saved++);
  shell.bindShortcut('Ctrl+P', 'scene.save');
  shell.bindShortcut('ctrl+shift+z', 'scene.save');
  assert.equal(shell.dispatchKey('ctrl+p'), true, '大小写不敏感');
  assert.equal(saved, 1);
  assert.equal(shell.dispatchKey('ctrl+shift+z'), true);
  assert.equal(saved, 2);
  assert.equal(shell.dispatchKey('alt+x'), false, '未绑定键返回 false');
  assert.throws(() => shell.bindShortcut('ctrl+q', 'ghost'), /未注册/);
});

test('选择集：单选/多选/清空', () => {
  const shell = new EditorShell();
  assert.deepEqual(shell.select(1), [1]);
  assert.deepEqual(shell.select(2), [2], '单选替换');
  assert.deepEqual(shell.select(1, { toggle: true }), [2, 1], 'toggle 追加');
  assert.deepEqual(shell.select(1, { toggle: true }), [2], 'toggle 移除');
  shell.clearSelection();
  assert.equal(shell.selection.size, 0);
});

test('面板布局：区域/顺序稳定/移除', () => {
  const shell = new EditorShell();
  shell.addPanel('hierarchy', 'left', 0);
  shell.addPanel('inspector', 'right', 10);
  shell.addPanel('scene', 'center');
  shell.addPanel('assets', 'left', 5);
  const left = shell.panelsIn('left');
  assert.deepEqual(left.map((p) => p.id), ['hierarchy', 'assets'], '同区按 order');
  assert.equal(shell.panels.length, 4);
  shell.removePanel('inspector');
  assert.equal(shell.panelsIn('right').length, 0);
  shell.addPanel('hierarchy', 'left', 0);  // 重复添加幂等
  assert.equal(shell.panels.length, 3);
});

test('与 CommandBus 绑定：命令驱动场景写路径', () => {
  const bus = new CommandBus(new SceneState());
  const shell = new EditorShell({ bus });
  shell.bindSceneCommand('scene.create_hero', '创建英雄', () => ({
    op: 'create_entity',
    name: 'hero',
  }));
  shell.bindSceneCommand('scene.buff_hero', '英雄加血', () => ({
    op: 'add_component',
    id: 1,
    type: 'game.Health',
    data: { max: 100, current: 100 },
  }));
  shell.run('scene.create_hero');
  shell.run('scene.buff_hero');
  assert.equal(shell.bus.scene.entities.size, 1);
  assert.equal(shell.bus.scene.entities.get(1).components.get('game.Health').max, 100);
  shell.bus.undo();
  assert.equal(shell.bus.scene.entities.get(1).components.has('game.Health'), false,
               'undo 走总线');
});
