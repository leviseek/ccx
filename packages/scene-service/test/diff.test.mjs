import test from 'node:test';
import assert from 'node:assert/strict';
import { diffScenes } from '../src/diff.mjs';

const base = {
  schema: 'ccx.scene/1',
  entities: [
    { id: 1, name: 'hero', parent: null, components: [{ type: 'game.Health', data: { max: 100, current: 100 } }] },
    { id: 2, name: 'old_npc', parent: null, components: [] },
  ],
  systems: [],
};

test('diff：实体增删/组件增删/字段/改名', () => {
  const after = {
    schema: 'ccx.scene/1',
    entities: [
      { id: 1, name: 'hero2', parent: null,
        components: [
          { type: 'game.Health', data: { max: 100, current: 77 } },
          { type: 'game.Weapon', data: { id: 'ak47' } },
        ] },
      { id: 3, name: 'new_npc', parent: null, components: [] },
    ],
    systems: [],
  };
  const d = diffScenes(base, after);
  // 顺序：remove(2) -> add(3) -> change(1:*)
  assert.equal(d[0].op, 'remove');
  assert.equal(d[0].id, 2);
  assert.equal(d[1].op, 'add');
  assert.equal(d[1].name, 'new_npc');
  const setName = d.find((x) => x.path && x.path[0] === 'name');
  assert.equal(setName.value, 'hero2');
  const hp = d.find((x) => x.path && x.path[0] === 'game.Health');
  assert.equal(hp.value, 77);
  const addW = d.find((x) => x.kind === 'component' && x.op === 'add');
  assert.equal(addW.componentType, 'game.Weapon');
  assert.equal(addW.data.id, 'ak47');
});

test('diff：无差异 vs 单字段', () => {
  assert.deepEqual(diffScenes(base, base), []);
  const tweak = structuredClone(base);
  tweak.entities[0].components[0].data.current = 88;
  const d = diffScenes(base, tweak);
  assert.equal(d.length, 1);
  assert.deepEqual(d[0].path, ['game.Health', 'current']);
  assert.equal(d[0].value, 88);
});
