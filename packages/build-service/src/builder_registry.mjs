// Platform builder registry (contributes.builder protocol, ADR-006)
const builders = new Map();

export function registerBuilder(builder) {
  if (!builder || !builder.platform) {
    throw new Error('builder must declare platform');
  }
  if (builders.has(builder.platform)) {
    throw new Error('builder already registered: ' + builder.platform);
  }
  const entry = {
    platform: builder.platform,
    displayName: builder.displayName ?? builder.platform,
    optionsSchema: builder.optionsSchema ?? {},
    hooks: {
      onBeforeInit: builder.hooks?.onBeforeInit ?? null,
      onAfterInit: builder.hooks?.onAfterInit ?? null,
      onBeforeBundle: builder.hooks?.onBeforeBundle ?? null,
      onAfterBundle: builder.hooks?.onAfterBundle ?? null,
      onAfterBuild: builder.hooks?.onAfterBuild ?? null,
    },
  };
  builders.set(builder.platform, entry);
  return entry;
}

export function getBuilder(platform) {
  return builders.get(platform) ?? null;
}

export function listBuilders() {
  return [...builders.values()].map((b) => ({
    platform: b.platform,
    displayName: b.displayName,
  }));
}
