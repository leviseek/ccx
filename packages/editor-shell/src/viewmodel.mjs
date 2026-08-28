// 编辑器视图模型（M2 Web UI 的无头前身）：把 EditorShell + SceneState 投影成可渲染快照
// 纯数据（无 DOM）；实 DOM 渲染层在 M2 基于本快照消费
export function buildView(editor, sceneBus = null) {
  const panels = {};
  for (const p of editor.panels) {
    (panels[p.region] ??= []).push({ id: p.id, order: p.order });
  }
  const entities = sceneBus
    ? [...sceneBus.scene.entities.values()].map((e) => ({
        id: e.id,
        name: e.name,
        parent: e.parent,
        selected: editor.selection.has(e.id),
        componentTypes: [...e.components.keys()],
        components: [...e.components].map(([type, data]) => ({ type, data })),
      }))
    : [];
  return {
    panels,
    commands: [...editor.commands.keys()],
    shortcuts: [...editor.shortcuts.entries()].map(([keys, cmd]) => ({ keys, cmd })),
    selected: [...editor.selection],
    scene: {
      entityCount: entities.length,
      entities,
      canUndo: sceneBus ? sceneBus.undoStack.length > 0 : false,
      canRedo: sceneBus ? sceneBus.redoStack.length > 0 : false,
    },
  };
}
