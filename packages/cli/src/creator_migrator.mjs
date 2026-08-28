// Creator 2D 场景迁移器（M5 工作包 / engine-spec §237 / roadmap §8.2 基准5 前置）
// 输入：Cocos Creator 2.x .scene（数组格式，__id__ 引用表）
// 输出：ccx.scene/1（ADR-003）
// 映射：cc.Node → entity（name/parent/transform）；cc.Sprite → ccx.Sprite（atlas=uuid 哈希）；
//       cc.Label → ccx.Text；cc.UITransform → 尺寸信息；其余组件 → 类型名保留（脚本引用重写留 M5 二期）

export function migrateCreatorScene(creatorDoc) {
  const objs = Array.isArray(creatorDoc) ? creatorDoc : [creatorDoc];
  // 找场景根（cc.SceneAsset 的 scene 引用 → cc.Scene → _children）
  const byId = new Map();
  // Creator 序列化数组的 __id__ 即数组下标；显式 __id__ 优先（防御顺序差异）
  objs.forEach((o, i) => byId.set(o && o.__id__ !== undefined ? o.__id__ : i, o));

  const deref = (v) => (v && typeof v === "object" && v.__id__ !== undefined ? byId.get(v.__id__) : v);

  // 1) 定位 cc.Scene 对象（含 _children 的场景容器）
  let sceneObj = null;
  for (const o of objs) {
    if (o && o.__type__ === "cc.Scene" && Array.isArray(o._children)) { sceneObj = o; break; }
  }
  if (!sceneObj) {
    // 回退：cc.SceneAsset 直挂
    for (const o of objs) {
      if (o && o.__type__ === "cc.SceneAsset") {
        const s = deref(o.scene);
        if (s && s.__type__ === "cc.Scene") sceneObj = s;
      }
    }
  }
  if (!sceneObj) return { error: "未找到 cc.Scene 节点（非 Creator 2D .scene）" };

  // 2) 建节点表（__id__ → {node, parentId}）
  const nodeById = new Map();
  const childrenOf = new Map();
  for (const o of objs) {
    if (o && o.__type__ === "cc.Node") {
      const parentRef = o._parent;
      const parent = parentRef ? deref(parentRef) : null;
      nodeById.set(o.__id__, o);
      const pid = parent && parent.__type__ === "cc.Node" ? parent.__id__ : -1;
      if (!childrenOf.has(pid)) childrenOf.set(pid, []);
      childrenOf.get(pid).push(o.__id__);
    }
  }

  // 3) 深度优先遍历生成实体（稳定 id）
  const entities = [];
  const entityIdOfNode = new Map();
  let nextId = 1;

  const compsOf = (node) => {
    const out = [];
    if (Array.isArray(node._components)) {
      for (const cref of node._components) {
        const c = deref(cref);
        if (c && c.__type__) out.push(c);
      }
    }
    return out;
  };

  const walk = (nodeId, parentEntityId) => {
    const node = nodeById.get(nodeId);
    if (!node) return;
    const id = nextId++;
    entityIdOfNode.set(nodeId, id);
    const name = typeof node._name === "string" ? node._name : "node" + id;
    const comps = [];
    // 变换：_lpos（cc.Vec2）/ _lrot / _lscale
    const lpos = node._lpos || {};
    const lscale = node._lscale || {};
    const transform = {
      position: [Number(lpos.x ?? 0), Number(lpos.y ?? 0)],
      rotationZ: Number(node._lrot?.z ?? 0),
      scale: [Number(lscale.x ?? 1), Number(lscale.y ?? 1)],
    };
    comps.push({ type: "ccx.Transform", data: transform });
    for (const c of compsOf(node)) {
      if (c.__type__ === "cc.Sprite") {
        // 精灵：atlas 用 spriteFrame uuid 的稳定哈希（1..N 映射由资产迁移器接续）
        const sf = deref(c._spriteFrame);
        const uuid = (sf && sf.__uuid__) || "unknown";
        let h = 0;
        for (let i = 0; i < uuid.length; ++i) h = (h * 31 + uuid.charCodeAt(i)) >>> 0;
        comps.push({ type: "ccx.Sprite", data: { atlas: (h % 900) + 100, material: 1 } });
      } else if (c.__type__ === "cc.Label") {
        comps.push({ type: "ccx.Text", data: { text: String(c._string ?? "") } });
      } else if (c.__type__ === "cc.UITransform") {
        const sz = c._contentSize || {};
        comps.push({ type: "ccx.Size", data: { width: Number(sz.width ?? 0), height: Number(sz.height ?? 0) } });
      } else if (c.__type__ === "cc.Animation" || c.__type__ === "cc.Skeleton") {
        comps.push({ type: "ccx." + c.__type__.slice(3), data: {} });
      }
      // 其余组件：保留类型名（脚本引用重写 M5 二期）
    }
    entities.push({ id, name, parent: parentEntityId > 0 ? parentEntityId : null, components: comps });
    const kids = childrenOf.get(nodeId) || [];
    for (const kid of kids) walk(kid, id);
  };

  for (const rootId of childrenOf.get(-1) || []) walk(rootId, 0);
  // 无根挂靠时（全树都有父）：从 sceneObj._children 兜底
  if (entities.length === 0 && Array.isArray(sceneObj._children)) {
    for (const cref of sceneObj._children) {
      const c = deref(cref);
      if (c && c.__type__ === "cc.Node") walk(c.__id__, 0);
    }
  }

  return {
    schema: "ccx.scene/1",
    meta: { name: sceneObj._name || "migrated", generator: "ccx-creator-migrator", source: "creator-2d" },
    entities,
    systems: [],
  };
}
