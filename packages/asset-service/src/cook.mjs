// Cook 管线骨架（asset-spec §4：平台矩阵 + 纹理/音频目标推导；压缩执行留 M2 原生 worker）
export const PLATFORM_MATRIX = {
  'web-desktop': { texture: 'png', audio: 'ogg' },
  'web-mobile': { texture: 'webp', audio: 'ogg' },
  android: { texture: 'astc4', audio: 'ogg' },
  ios: { texture: 'astc4', audio: 'aac' },
  'minigame-wechat': { texture: 'etc2', audio: 'aac' },
  windows: { texture: 'bc7', audio: 'ogg' },
};

export function planCook(intermediate, platformKey) {
  const row = PLATFORM_MATRIX[platformKey];
  if (!row) {
    const keys = Object.keys(PLATFORM_MATRIX).join(', ');
    throw new Error('未知平台: ' + platformKey + '（可用: ' + keys + '）');
  }
  return {
    platform: platformKey,
    uuid: intermediate.uuid,
    targets: [
      { kind: 'texture', format: row.texture, source: intermediate.sourceFormat ?? 'png' },
      { kind: 'audio', format: row.audio },
    ],
  };
}

// Cook 任务（模拟执行：记录产物；真实压缩进 M2 worker）
export function cook(intermediate, platformKey) {
  const plan = planCook(intermediate, platformKey);
  return {
    uuid: intermediate.uuid,
    platform: platformKey,
    artifact: {
      key: plan.uuid + '@' + platformKey,
      parts: plan.targets.map((t) => ({
        kind: t.kind,
        format: t.format,
      })),
      sizeHintBytes: intermediate.sizeBytes ?? 0,
    },
  };
}
