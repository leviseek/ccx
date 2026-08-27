#!/usr/bin/env node
// ccx-service-daemon：stdio daemon 演示实例（asset/scene 存根 + 系统方法）
import { runStdioDaemon } from '../src/daemon.mjs';

const services = {
  asset: {
    list: (params = {}) => ({
      assets: [
        { uuid: 'a-1', type: 'ccx.Texture', path: 'assets/hero.png', filter: params.filter ?? null },
        { uuid: 'a-2', type: 'ccx.Sprite', path: 'assets/coin.atlas', filter: params.filter ?? null },
      ],
    }),
    scan: () => ({ scanned: 2, changed: 0 }),
  },
  scene: {
    open: (params = {}) => ({
      schema: params.schema ?? 'ccx.scene/1',
      path: params.path ?? 'scenes/main.scene.json',
      entities: 0,
    }),
  },
};

runStdioDaemon(services);
