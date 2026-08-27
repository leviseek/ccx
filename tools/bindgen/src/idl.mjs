// ccx bindgen IDL 解析器（灯塔任务 C：v0.2 支持数组/默认值/回调）
// 语法子集（v0.2）：
//   module ccx.audio;
//   class Playback {
//     play(url: string, loop: bool = false): void;      —— 默认值（string/bool/number 字面量）
//     sum(values: float[]): float;                      —— 数组类型（float[]/int[]/string[]）
//     onTick(cb: () => void): void;                     —— 回调（单参或空参）
//     onDamage(cb: (amount: float) => void): void;
//   }
export function parseIdl(source) {
  const ir = { module: null, classes: [] };
  let current = null;
  let doc = null;
  const lines = source.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') continue;
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

    const propMatch = line.match(
      /^readonly\s+([A-Za-z0-9_]+)\s*:\s*([A-Za-z0-9_]+)\s*(?:=\s*("[^"]*"|[0-9.]+))?\s*;$/);
    if (propMatch) {
      const rawDefault = propMatch[3];
      const def = rawDefault === undefined ? null :
        rawDefault.startsWith('"') ? rawDefault.slice(1, -1) :
        propMatch[2] === 'string' ? String(rawDefault) : Number(rawDefault);
      current.props.push({ name: propMatch[1], type: propMatch[2], doc: doc ?? null, default: def });
      doc = null;
      continue;
    }

    // 方法：贪婪匹配最后一个 "): type;" —— 允许参数内嵌回调的小括号
    const methodMatch = line.match(/^([A-Za-z0-9_]+)\s*\((.*)\)\s*:\s*([A-Za-z0-9_]+)\s*;$/);
    if (!methodMatch) throw new Error('bindgen: 无法解析行: ' + line);
    const params = splitTopLevel(methodMatch[2]).map(parseParam);
    current.methods.push({
      name: methodMatch[1],
      params,
      ret: methodMatch[3],
      doc: doc ?? null,
    });
    doc = null;
  }
  if (!ir.module) throw new Error('bindgen: 缺少 module 声明');
  return ir;
}

// 按顶层逗号切分参数（跟踪小括号深度，回调签名内部的逗号不切分）
function splitTopLevel(body) {
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { parts.push(cur); cur = ''; }
    else cur += ch;
  }
  if (cur.trim() !== '') parts.push(cur);
  return parts;
}

// 只把"独立等号"当作默认值分隔（跳过回调箭头 => 的 '='）
function splitDefault(text) {
  for (let i = 0; i < text.length; ++i) {
    if (text[i] === '=' && text[i + 1] !== '>') {
      return [text.slice(0, i), text.slice(i + 1)];
    }
  }
  return [text];
}

function parseParam(text) {
  const [head, defStr] = splitDefault(text.trim());
  const m = head.match(/^([A-Za-z0-9_]+)\s*:\s*(.+)$/);
  if (!m) throw new Error('bindgen: 参数格式 name: type[ = default] —— ' + text);
  const name = m[1];
  const type = m[2].trim();
  let def = null;
  if (defStr !== undefined) {
    const raw = defStr.trim();
    def = raw.startsWith('"') ? raw.slice(1, -1)
      : raw === 'true' ? true
      : raw === 'false' ? false
      : Number(raw);
  }
  return { name, type, def };
}

// 类型分析：scalar | array | callback
export function analyzeType(type) {
  if (type.startsWith('(')) {
    const arrow = type.indexOf('=>');
    if (arrow < 0) throw new Error('bindgen: 回调类型缺少 => : ' + type);
    const head = type.slice(1, type.lastIndexOf(')')).trim();
    const params = head === '' ? [] : splitTopLevel(head).map(parseParam);
    const ret = type.slice(arrow + 2).trim();
    return { kind: 'callback', callbackParams: params, ret };
  }
  if (type.endsWith('[]')) {
    return { kind: 'array', base: type.slice(0, -2) };
  }
  return { kind: 'scalar', base: type };
}

export { splitTopLevel };
