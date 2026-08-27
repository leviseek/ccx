// 编辑器 Shell 模型（services-spec §8）：命令注册表 / 快捷键表 / 选择集 / 面板布局。
// 纯数据（无 DOM），可被 Web UI 渲染层消费；与 SceneService CommandBus 可绑定。

function normalizeKeys(keys) {
  return keys.toLowerCase().split('+').map((k) => k.trim()).sort().join('+');
}

export class EditorShell {
  constructor({ bus = null } = {}) {
    this.commands = new Map();   // id -> { label, run }
    this.shortcuts = new Map();  // normalized keys -> commandId
    this.panels = [];            // { id, region, order }
    this.selection = new Set();  // 选中实体（entityId）
    this.bus = bus;
    this.log = [];               // 审计：每次命令执行记录（铁律 12）
  }

  registerCommand(id, label, run) {
    this.commands.set(id, { label, run });
    return this;
  }

  // 场景命令便捷绑定：bus.apply(cmdFactory())
  bindSceneCommand(id, label, cmdFactory) {
    return this.registerCommand(id, label, () => {
      if (!this.bus) throw new Error('Shell 未绑定 CommandBus');
      this.bus.apply(cmdFactory());
    });
  }

  bindShortcut(keys, commandId) {
    const k = normalizeKeys(keys);
    if (!this.commands.has(commandId)) {
      throw new Error('快捷键绑定到未注册命令: ' + commandId);
    }
    this.shortcuts.set(k, commandId);
    return this;
  }

  dispatchKey(keys) {
    const id = this.shortcuts.get(normalizeKeys(keys));
    if (!id) return false;
    this.run(id);
    return true;
  }

  run(id) {
    const c = this.commands.get(id);
    if (!c) throw new Error('命令未注册: ' + id);
    c.run();
    this.log.push({ at: Date.now(), command: id });
    return true;
  }

  select(id, { toggle = false } = {}) {
    if (toggle) {
      if (this.selection.has(id)) this.selection.delete(id);
      else this.selection.add(id);
    } else {
      this.selection.clear();
      this.selection.add(id);
    }
    return [...this.selection];
  }

  clearSelection() {
    this.selection.clear();
  }

  // 面板布局（docking 数据模型）：region 内按 order 稳定序
  addPanel(panelId, region = 'center', order = 0) {
    if (this.panels.some((p) => p.id === panelId)) return this;
    this.panels.push({ id: panelId, region, order });
    this.panels.sort((a, b) => a.region.localeCompare(b.region) || a.order - b.order);
    return this;
  }

  removePanel(panelId) {
    const i = this.panels.findIndex((p) => p.id === panelId);
    if (i >= 0) this.panels.splice(i, 1);
    return this;
  }

  panelsIn(region) {
    return this.panels.filter((p) => p.region === region)
      .sort((a, b) => a.order - b.order);
  }

  commandCount() { return this.commands.size; }
}
