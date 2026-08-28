// M5 迁移器：Creator 2D .scene（数组格式）→ ccx.scene/1 转换测试
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateCreatorScene } from '../src/creator_migrator.mjs';

// 模拟 Creator 2.4 导出场景（数组 + __id__ 引用）
const fixture = [
  { __type__: 'cc.SceneAsset', _name: 'game', scene: { __id__: 1 } },
  { __type__: 'cc.Scene', _name: 'game', _children: [{ __id__: 2 }] },
  {
    __type__: 'cc.Node',
    __id__: 2,
    _name: 'Canvas',
    _parent: { __id__: 1 },
    _children: [{ __id__: 3 }, { __id__: 5 }],
    _lpos: { __type__: 'cc.Vec2', x: 0, y: 0 },
    _lscale: { __type__: 'cc.Vec2', x: 1, y: 1 },
    _components: [{ __id__: 4 }],
  },
  { __type__: 'cc.UITransform', __id__: 4, _contentSize: { width: 1280, height: 720 } },
  {
    __type__: 'cc.Node',
    __id__: 3,
    _name: 'Hero',
    _parent: { __id__: 2 },
    _children: [],
    _lpos: { __type__: 'cc.Vec2', x: 120, y: 80 },
    _components: [{ __id__: 6 }],
  },
  {
    __type__: 'cc.Sprite',
    __id__: 6,
    _node: { __id__: 3 },
    _spriteFrame: { __uuid__: 'abc-123' },
  },
  {
    __type__: 'cc.Node',
    __id__: 5,
    _name: 'Title',
    _parent: { __id__: 2 },
    _children: [],
    _components: [{ __id__: 7 }],
  },
  { __type__: 'cc.Label', __id__: 7, _string: 'Hello CCX' },
];

test('migrate: 结构转换（节点/父级/组件）', () => {
  const out = migrateCreatorScene(fixture);
  assert.equal(out.schema, 'ccx.scene/1');
  assert.equal(out.entities.length, 3);
  const canvas = out.entities.find((e) => e.name === 'Canvas');
  assert.ok(canvas, 'Canvas 节点');
  assert.equal(canvas.parent, null);
  const hero = out.entities.find((e) => e.name === 'Hero');
  assert.ok(hero, 'Hero 节点');
  assert.equal(hero.parent, canvas.id, 'Hero 挂在 Canvas 下');
  const title = out.entities.find((e) => e.name === 'Title');
  assert.equal(title.parent, canvas.id);
});

test('migrate: 组件映射（Sprite/Label/UITransform）', () => {
  const out = migrateCreatorScene(fixture);
  const hero = out.entities.find((e) => e.name === 'Hero');
  const spr = hero.components.find((c) => c.type === 'ccx.Sprite');
  assert.ok(spr, 'Sprite 映射');
  assert.ok(spr.data.atlas >= 100 && spr.data.atlas < 1000, 'atlas 稳定哈希');
  const title = out.entities.find((e) => e.name === 'Title');
  const txt = title.components.find((c) => c.type === 'ccx.Text');
  assert.equal(txt.data.text, 'Hello CCX');
  const canvas = out.entities.find((e) => e.name === 'Canvas');
  const sz = canvas.components.find((c) => c.type === 'ccx.Size');
  assert.equal(sz.data.width, 1280);
  assert.equal(sz.data.height, 720);
});

test('migrate: 变换映射', () => {
  const out = migrateCreatorScene(fixture);
  const hero = out.entities.find((e) => e.name === 'Hero');
  const tr = hero.components.find((c) => c.type === 'ccx.Transform');
  assert.deepEqual(tr.data.position, [120, 80]);
  assert.deepEqual(tr.data.scale, [1, 1]);
});

test('migrate: 非法输入报错', () => {
  const bad = migrateCreatorScene({ __type__: 'cc.Prefab' });
  assert.ok(bad.error, '非场景输入报错');
});
