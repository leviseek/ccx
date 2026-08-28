// 结构化场景 diff（ADR-003 §4.3）：实体增删/组件增删/名称与字段变更
// 条目：{kind:'entity'|'component'|'field', op:'add'|'remove'|'set', id, ...}
// 顺序稳定：remove -> add -> change；字段路径 [componentType, key]
export function diffScenes(before, after) {
  const out = [];
  const byId = (m) => new Map((m.entities ?? []).map((e) => [e.id, e]));
  const a = byId(before);
  const b = byId(after);

  for (const [id, e] of a) {
    if (!b.has(id)) out.push({ kind: 'entity', op: 'remove', id, name: e.name });
  }
  for (const [id, e] of b) {
    if (!a.has(id)) out.push({ kind: 'entity', op: 'add', id, name: e.name });
  }
  for (const [id, e] of b) {
    const pa = a.get(id);
    if (!pa) continue;
    if ((pa.name ?? '') !== (e.name ?? '')) {
      out.push({ kind: 'field', op: 'set', id, path: ['name'], value: e.name, prev: pa.name });
    }
    const ca = new Map((pa.components ?? []).map((c) => [c.type, c]));
    const cb = new Map((e.components ?? []).map((c) => [c.type, c]));
    for (const t of ca.keys()) {
      if (!cb.has(t)) out.push({ kind: 'component', op: 'remove', id, componentType: t });
    }
    for (const t of cb.keys()) {
      if (!ca.has(t)) {
        out.push({ kind: 'component', op: 'add', id, componentType: t, data: cb.get(t).data });
        continue;
      }
      const da = ca.get(t).data ?? {};
      const db = cb.get(t).data ?? {};
      for (const k of Object.keys(db)) {
        if (JSON.stringify(da[k]) !== JSON.stringify(db[k])) {
          out.push({ kind: 'field', op: 'set', id, path: [t, k], value: db[k], prev: da[k] });
        }
      }
    }
  }
  return out;
}
