// 资产索引（Web 目标产物）解析与校验：ccx.assets.index/1
export function parseAssetsIndex(text) {
  let doc;
  try {
    doc = JSON.parse(text);
  } catch (e) {
    throw new Error('资产索引非合法 JSON: ' + e.message);
  }
  if (!doc || doc.schema !== 'ccx.assets.index/1') {
    throw new Error('缺少或错误的资产索引 schema');
  }
  if (typeof doc.platform !== 'string' || doc.platform.length === 0) {
    throw new Error('资产索引缺少 platform');
  }
  if (!Array.isArray(doc.assets)) {
    throw new Error('资产索引缺少 assets 数组');
  }
  for (const a of doc.assets) {
    if (!a || typeof a.uuid !== 'string' || typeof a.path !== 'string') {
      throw new Error('资产条目需 uuid+path');
    }
  }
  return { platform: doc.platform, assets: doc.assets };
}
