# particle — 2D 粒子数据面

- 用途：固定池粒子发射器（renderer-spec §5）；CPU 更新先行，GPU 渲染 M2。
- API：`Emitter(cfg, capacity)` → `update(dt)` / `aliveCount()` / `particles()`；确定性 LCG（测试可复现）。
- 参数：rate / spawnSpeedMin..Max / lifeMin..Max / gravity / drag / looping / maxEmitPerFrame。
- 语义：稳态 alive ≈ rate×life；alpha 末 40% 淡出；池满拒绝。
- 测试：particle.emitter（发射/回收/重力/容量/淡出）。依赖：foundation。
> M2 接入点：发射器状态 → 渲染项（粒子 quad）→ packer 合批。
