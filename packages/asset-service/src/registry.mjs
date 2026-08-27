// Importer 注册表（asset-spec §2.2 插件协议的最小实现）
const importers = new Map();  // ext -> importer

export function registerImporter(importer) {
  for (const ext of importer.accepts.ext) importers.set(ext.toLowerCase(), importer);
}

export function findImporter(ext) {
  return importers.get((ext || '').toLowerCase()) ?? null;
}

export function listImporters() {
  return [...new Set(importers.values())].map((i) => i.id);
}
