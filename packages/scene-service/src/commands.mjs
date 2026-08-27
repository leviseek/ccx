// Command Bus（services-spec §4）：唯一写路径 + 幂等 undo/redo
// undo 语义 v1：apply 时深拷贝受影响实体（含子树），undo 恢复快照，redo 重放命令。

const clone = (v) => structuredClone(v);

export class SceneState {
  constructor() {
    this.entities = new Map();  // id -> { id, name, parent, components: Map(type -> data) }
    this.nextId = 1;
  }

  createEntity(name, parent = null) {
    const id = this.nextId++;
    this.entities.set(id, { id, name, parent, components: new Map() });
    return id;
  }

  destroySubtree(id, out = new Set()) {
    if (!this.entities.has(id)) return out;
    out.add(id);
    for (const [eid, e] of this.entities) {
      if (e.parent === id) this.destroySubtree(eid, out);
    }
    for (const eid of out) this.entities.delete(eid);
    return out;
  }

  // 返回"受影响实体"的深拷贝快照（undo 用）
  snapshotOf(ids) {
    const snap = new Map();
    for (const id of ids) {
      const e = this.entities.get(id);
      if (!e) continue;
      snap.set(id, {
        ...e,
        components: new Map([...e.components].map(([k, v]) => [k, clone(v)])),
      });
    }
    return snap;
  }

  restore(snap) {
    for (const [id, e] of snap) {
      this.entities.set(id, {
        ...e,
        components: new Map([...e.components].map(([k, v]) => [k, clone(v)])),
      });
    }
  }
}

function childIds(state, rootId) {
  const out = new Set([rootId]);
  for (const [id, e] of state.entities) {
    if (e.parent === rootId) out.add(id);
  }
  return out;
}

export class CommandBus {
  constructor(scene) {
    this.scene = scene;
    this.undoStack = [];  // { cmd, before }  before: Map(id -> snapshot)
    this.redoStack = [];
  }

  apply(cmd) {
    const before = this.collectBefore(cmd);
    this.execute(cmd);
    this.undoStack.push({ cmd, before });
    this.redoStack.length = 0;
  }

  undo() {
    const top = this.undoStack.pop();
    if (!top) return false;
    this.scene.restore(top.before);
    this.redoStack.push(top);
    return true;
  }

  redo() {
    const top = this.redoStack.pop();
    if (!top) return false;
    // 重放命令（重新收集快照后执行；undo 栈可见）
    const before = this.collectBefore(top.cmd);
    this.execute(top.cmd);
    this.undoStack.push({ cmd: top.cmd, before });
    return true;
  }

  collectBefore(cmd) {
    switch (cmd.op) {
      case 'create_entity':
        return new Map();
      case 'destroy_entity': {
        // 纯收集（不触发删除）：自身 + 全部子孙
        const idsSet = new Set();
        const walk = (id) => {
          if (idsSet.has(id)) return;
          idsSet.add(id);
          for (const [eid, e] of this.scene.entities) {
            if (e.parent === id) walk(eid);
          }
        };
        walk(cmd.id);
        return this.scene.snapshotOf([...idsSet]);
      }
      case 'add_component':
      case 'remove_component':
      case 'set_property':
      case 'set_name':
      case 'set_parent':
        return this.scene.snapshotOf([cmd.id]);
      default:
        throw new Error('未知命令: ' + cmd.op);
    }
  }

  execute(cmd) {
    const s = this.scene;
    switch (cmd.op) {
      case 'create_entity': {
        const id = s.createEntity(cmd.name ?? 'entity', cmd.parent ?? null);
        cmd._createdId = id;  // 记录（redo 复用 createEntity 分配新 id 也行；v1 直接复用）
        return;
      }
      case 'destroy_entity':
        s.destroySubtree(cmd.id);
        return;
      case 'add_component': {
        const e = s.entities.get(cmd.id);
        if (!e) throw new Error('实体不存在: ' + cmd.id);
        e.components.set(cmd.type, clone(cmd.data ?? {}));
        return;
      }
      case 'remove_component': {
        const e = s.entities.get(cmd.id);
        if (!e) return;
        e.components.delete(cmd.type);
        return;
      }
      case 'set_property': {
        const e = s.entities.get(cmd.id);
        if (!e) throw new Error('实体不存在: ' + cmd.id);
        const comp = e.components.get(cmd.type);
        if (comp === undefined) throw new Error('组件不存在: ' + cmd.type);
        let walk = comp;
        for (let i = 0; i + 1 < cmd.path.length; i++) {
          if (typeof walk[cmd.path[i]] !== 'object' || walk[cmd.path[i]] === null) {
            walk[cmd.path[i]] = {};
          }
          walk = walk[cmd.path[i]];
        }
        walk[cmd.path[cmd.path.length - 1]] = clone(cmd.value);
        return;
      }
      case 'set_name': {
        const e = s.entities.get(cmd.id);
        if (e) e.name = cmd.name;
        return;
      }
      case 'set_parent': {
        const e = s.entities.get(cmd.id);
        if (e) e.parent = cmd.parent ?? null;
        return;
      }
      default:
        throw new Error('未知命令: ' + cmd.op);
    }
  }

  // —— ADR-003 v1 文件格式 ——
  toSceneFile() {
    return {
      schema: 'ccx.scene/1',
      meta: { name: 'Scene', generator: 'ccx-scene-service' },
      entities: [...this.scene.entities.values()].map((e) => ({
        id: e.id,
        name: e.name,
        parent: e.parent,
        components: [...e.components].map(([type, data]) => ({ type, data })),
      })),
      systems: [],
    };
  }

  static fromSceneFile(json) {
    const scene = new SceneState();
    for (const e of json.entities ?? []) {
      if (e.id >= scene.nextId) scene.nextId = e.id + 1;
      scene.entities.set(e.id, {
        id: e.id,
        name: e.name ?? 'entity',
        parent: e.parent ?? null,
        components: new Map((e.components ?? []).map((c) => [c.type, clone(c.data ?? {})])),
      });
    }
    return new CommandBus(scene);
  }
}
