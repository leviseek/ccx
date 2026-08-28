import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorShell } from '../src/shell.mjs';
import { buildView } from '../src/viewmodel.mjs';
import { CommandBus, SceneState } from '../../scene-service/src/commands.mjs';

test('buildView：面板/命令/快捷键投影', () => {
  const shell = new EditorShell();
  shell.addPanel('hierarchy', 'left', 0);
  shell.addPanel('scene', 'center', 0);
  shell.addPanel('inspector', 'right', 10);
  shell.registerCommand('scene.save', '保存', () => {});
  shell.bindShortcut('ctrl+s', 'scene.save');
  const view = buildView(shell);
  assert.deepEqual(Object.keys(view.panels).sort(), ['center', 'left', 'right']);
  assert.equal(view.panels.left[0].id, 'hierarchy');
  assert.deepEqual(view.commands, ['scene.save']);
  assert.deepEqual(view.shortcuts, [{ keys: 'ctrl+s', cmd: 'scene.save' }]);
  assert.deepEqual(view.selected, []);
});

test('buildView：场景实体/组件/选择/undo 状态投影', () => {
  const bus = new CommandBus(new SceneState());
  bus.apply({ op: 'create_entity', name: 'hero' });
  bus.apply({ op: 'add_component', id: 1, type: 'game.Health', data: { max: 100, current: 80 } });
  const shell = new EditorShell({ bus });
  shell.registerCommand('nop', '无操作', () => {});
  shell.select(1);
  const view = buildView(shell, bus);
  assert.equal(view.scene.entityCount, 1);
  assert.equal(view.scene.entities[0].selected, true);
  assert.deepEqual(view.scene.entities[0].componentTypes, ['game.Health']);
  assert.equal(view.scene.entities[0].components[0].data.max, 100);
  assert.equal(view.scene.canUndo, true);
  assert.equal(view.scene.canRedo, false);
  bus.undo();
  const view2 = buildView(shell, bus);
  assert.equal(view2.scene.entities[0].componentTypes.length, 0);
  assert.equal(view2.scene.canRedo, true, 'undo 后 redo 可用');
});
