// Bundle manifest (asset-spec §2.1 Package stage; platform-spec §6 artifacts)
import { createHash } from 'node:crypto';

export function contentHash(text) {
  return createHash('sha1').update(String(text)).digest('hex');
}

export function createBundleManifest({ project, platform, assets = [], scripts = [], config = {} }) {
  return {
    schema: 'ccx.bundle/1',
    buildId: project + '@' + platform,
    platform,
    entries: {
      assets: assets.map((a) => ({
        uuid: a.uuid,
        path: a.path,
        hash: contentHash(String(a.uuid) + a.path),
      })),
      scripts: scripts.map((s) => ({
        name: s.name,
        hash: contentHash(s.code),
      })),
    },
    config,
  };
}
