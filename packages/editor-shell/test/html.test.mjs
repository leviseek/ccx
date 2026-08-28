import test from 'node:test';
import assert from 'node:assert/strict';
import { EditorShell } from '../src/shell.mjs';
import { buildView } from '../src/viewmodel.mjs';
import { renderViewHtml } from '../src/html.mjs';
import { CommandBus, SceneState } from '../../scene-service/src/commands.mjs';

function sampleView() {
  const bus = new CommandBus(new SceneState());
  bus.apply({ op: 'create_entity', name: 'hero' });
  bus.apply({ op: 'add_component', id: 1, type: 'game.Health', data: { max: 100 } });
  const shell = new EditorShell({ bus });
  shell.addPanel('hierarchy', 'left', 0);
  shell.addPanel('scene', 'center', 0);
  shell.registerCommand('scene.save', '保存', () => {});
  shell.select(1);
  return { bus, shell, view: buildView(shell, bus) };
}

test('renderViewHtml：面板/实体/组件/选中/命令/页脚', () => {
  const { view } = sampleView();
  const html = renderViewHtml(view, { title: 'CCX' });
  assert.ok(html.startsWith('<!doctype html>'));
  assert.ok(html.includes('data-panel="hierarchy"'));
  assert.ok(html.includes('data-region="center"'));
  assert.ok(html.includes('data-entity="1"'));
  assert.ok(html.includes('class="selected"'), '选中实体带类');
  assert.ok(html.includes('"game.Health"'), '组件类型在 data-type');
  assert.ok(html.includes('{&quot;max&quot;:100}'), '组件数据渲染（转义后）');
  assert.ok(html.includes('data-cmd="scene.save"'));
  assert.ok(html.includes('entities=1'));
});

test('renderViewHtml：转义（实体名/组件数据含 HTML）', () => {
  const bus = new CommandBus(new SceneState());
  bus.apply({ op: 'create_entity', name: '<script>alert(1)</script>' });
  bus.apply({ op: 'add_component', id: 1, type: 'game.Note', data: { text: '<b>x</b>' } });
  const shell = new EditorShell({ bus });
  const html = renderViewHtml(buildView(shell, bus));
  assert.ok(html.includes('&lt;script&gt;'), '实体名被转义');
  assert.ok(!html.includes('<script>alert'), '无未转义脚本');
  assert.ok(html.includes('&lt;b&gt;x&lt;/b&gt;'), '组件数据被转义');
});
