import test from 'node:test';
import assert from 'node:assert/strict';
import { CommandBus, SceneState } from '../src/commands.mjs';

test('命令应用：建实体/加组件/改属性', () => {
  const bus = new CommandBus(new SceneState());
  bus.apply({ op: 'create_entity', name: 'player' });
  const id = bus.scene.nextId - 1;
  bus.apply({ op: 'add_component', id, type: 'game.Health', data: { max: 100, current: 100 } });
  bus.apply({ op: 'set_property', id, type: 'game.Health', path: ['current'], value: 77 });
  assert.equal(bus.scene.entities.get(id).components.get('game.Health').current, 77);
  assert.equal(bus.scene.entities.get(id).name, 'player');
});

test('undo/redo 往返', () => {
  const bus = new CommandBus(new SceneState());
  bus.apply({ op: 'create_entity', name: 'a' });
  const id = bus.scene.nextId - 1;
  bus.apply({ op: 'set_name', id, name: 'b' });
  assert.equal(bus.scene.entities.get(id).name, 'b');
  assert.equal(bus.undo(), true);
  assert.equal(bus.scene.entities.get(id).name, 'a');
  assert.equal(bus.redo(), true);
  assert.equal(bus.scene.entities.get(id).name, 'b');
});

test('undo/redo 嵌套路径属性', () => {
  const bus = new CommandBus(new SceneState());
  bus.apply({ op: 'create_entity', name: 'npc' });
  const id = bus.scene.nextId - 1;
  bus.apply({ op: 'add_component', id, type: 'game.Character', data: { stats: { hp: 100, mp: 50 } } });
  bus.apply({ op: 'set_property', id, type: 'game.Character', path: ['stats', 'hp'], value: 160 });
  assert.equal(bus.scene.entities.get(id).components.get('game.Character').stats.hp, 160);
  bus.undo();
  assert.equal(bus.scene.entities.get(id).components.get('game.Character').stats.hp, 100);
  bus.redo();
  assert.equal(bus.scene.entities.get(id).components.get('game.Character').stats.hp, 160);
});

test('销毁子树 + undo 恢复子树', () => {
  const bus = new CommandBus(new SceneState());
  bus.apply({ op: 'create_entity', name: 'root' });
  const root = bus.scene.nextId - 1;
  bus.apply({ op: 'create_entity', name: 'child', parent: root });
  const child = bus.scene.nextId - 1;
  bus.apply({ op: 'add_component', id: child, type: 'game.Health' });
  bus.apply({ op: 'destroy_entity', id: child });
  assert.equal(bus.scene.entities.has(child), false);
  bus.undo();
  assert.ok(bus.scene.entities.has(child), '子树恢复');
  assert.ok(bus.scene.entities.get(child).components.has('game.Health'), '组件恢复');
  assert.equal(bus.scene.entities.get(child).parent, root, '父子关系恢复');
});

test('ADR-003 文件读写往返', () => {
  const bus = new CommandBus(new SceneState());
  bus.apply({ op: 'create_entity', name: 'hero' });
  const id = bus.scene.nextId - 1;
  bus.apply({ op: 'add_component', id, type: 'ccx.Position', data: { x: 10.5, y: -3.25 } });
  const file = JSON.parse(JSON.stringify(bus.toSceneFile()));
  assert.equal(file.schema, 'ccx.scene/1');
  assert.equal(file.entities[0].components[0].type, 'ccx.Position');
  const bus2 = CommandBus.fromSceneFile(file);
  assert.equal(bus2.scene.entities.get(id).components.get('ccx.Position').x, 10.5);
});

test('redo 后新命令清空 redo 栈', () => {
  const bus = new CommandBus(new SceneState());
  bus.apply({ op: 'create_entity', name: 'x' });
  const id = bus.scene.nextId - 1;
  bus.apply({ op: 'set_name', id, name: 'y' });
  bus.undo();
  assert.equal(bus.redoStack.length, 1);
  bus.apply({ op: 'set_name', id, name: 'z' });
  assert.equal(bus.redoStack.length, 0, '新命令清空 redo');
});
