// 渲染计划（services/editor 侧视图；与 C++ e2e_render_plan_test 同语义）
// 输入 ADR-003 场景 JSON；输出：树序 -> (layer, order) 稳定排序 -> 同键合批
export function renderPlan(sceneJson) {
  const byId = new Map((sceneJson.entities ?? []).map((e) => [e.id, e]));
  const comp = (e, type) => (e.components ?? []).find((c) => c.type === type)?.data ?? null;

  // 根 = parent 为 null 或指向不存在的节点（容错）
  const roots = (sceneJson.entities ?? []).filter(
    (e) => e.parent === null || e.parent === undefined || !byId.has(e.parent));
  const order = [];
  const visit = (id) => {
    const e = byId.get(id);
    if (!e || order.includes(e)) return;
    order.push(e);
    for (const c of byId.values()) {
      if (c.parent === id) visit(c.id);
    }
  };
  for (const r of roots) visit(r.id);

  const keyOf = (e) => {
    const so = comp(e, 'ccx.Sorting');
    return { layer: so?.layer ?? 0, order: so?.order ?? 0 };
  };

  const sprites = order
    .map((e) => ({ e, s: comp(e, 'ccx.Sprite') }))
    .filter((x) => x.s);
  // 稳定排序（JS sort 稳定）：(layer, order) 升序，同键保持树序
  sprites.sort((a, b) => {
    const ka = keyOf(a.e);
    const kb = keyOf(b.e);
    return ka.layer - kb.layer || ka.order - kb.order;
  });

  const batches = [];
  for (let i = 0; i < sprites.length; ) {
    const a = sprites[i].s.atlas;
    const m = sprites[i].s.material;
    let j = i + 1;
    while (j < sprites.length && sprites[j].s.atlas === a && sprites[j].s.material === m) j++;
    batches.push({ atlas: a, material: m, count: j - i, first: i });
    i = j;
  }
  return { sprites: sprites.length, batches, order: order.map((e) => e.name) };
}
