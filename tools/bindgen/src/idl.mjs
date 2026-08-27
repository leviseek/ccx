// ccx bindgen IDL 解析器（灯塔任务 C 最小原型）
// 语法子集（v0.1）：
//   // 注释
//   module ccx.hello;                 —— 模块名（绑定对象名）
//   class Greeter {                   —— 类 = 一个导出对象
//     greet(name: string): string;    —— 方法（参数带类型，返回类型）
//     readonly version: string;       —— 只读属性（数据面）
//   }
// 类型：string | float | int | bool | void
export function parseIdl(source) {
  const ir = { module: null, classes: [] };
  let current = null;
  let doc = null;
  const lines = source.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '' ) continue;
    const docMatch = line.match(/^\/\/\s?(.*)$/);
    if (docMatch) { doc = docMatch[1]; continue; }
    const moduleMatch = line.match(/^module\s+([A-Za-z0-9_.]+)\s*;$/);
    if (moduleMatch) { ir.module = moduleMatch[1]; continue; }
    const classOpen = line.match(/^class\s+([A-Za-z0-9_]+)\s*\{$/);
    if (classOpen) {
      current = { name: classOpen[1], doc: doc ?? null, methods: [], props: [] };
      ir.classes.push(current);
      doc = null;
      continue;
    }
    if (line === '}') { current = null; continue; }
    if (!current) throw new Error('bindgen: 方法/属性必须位于 class 内: ' + line);
    const propMatch = line.match(/^readonly\s+([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_]+)\s*=\s*("[^"]*"|[0-9.]+)??\s*;$/);
    const methodMatch = line.match(/^([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*:\s*([A-Za-z0-9_]+)\s*;$/);
    if (propMatch) {
      const rawDefault = propMatch[3];
      const def = rawDefault === undefined ? null :
        rawDefault.startsWith('"') ? rawDefault.slice(1, -1) :
        propMatch[2] === 'string' ? String(rawDefault) : Number(rawDefault);
      current.props.push({ name: propMatch[1], type: propMatch[2], doc: doc ?? null, default: def });
      doc = null;
    } else if (methodMatch) {
      const params = [];
      if (methodMatch[2].trim() !== '') {
        for (const p of methodMatch[2].split(',')) {
          const parts = p.trim().split(/\s*:\s*/);
          if (parts.length !== 2) throw new Error('bindgen: 参数格式 name: type —— ' + p);
          params.push({ name: parts[0], type: parts[1] });
        }
      }
      current.methods.push({ name: methodMatch[1], params, ret: methodMatch[3], doc: doc ?? null });
      doc = null;
    } else {
      throw new Error('bindgen: 无法解析行: ' + line);
    }
  }
  if (!ir.module) throw new Error('bindgen: 缺少 module 声明');
  return ir;
}
