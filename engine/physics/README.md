# physics — 2D 碰撞数据面

- 用途：宽相（空间网格）+ 窄相（AABB 精确）+ 层/掩码（engine-spec §1 物理起点）。
- API：
  - `Aabb`（fromCenter/overlaps 闭区间/contains）；`SpatialGrid(cellSize,w,h)`（insert 按覆盖 cell/query/pairs 去重有序/越界忽略）。
  - `ContactEvent{a,b}`；`narrowPhase(grid, boxes)`（精确过滤+稳定序）。
  - `Body{box,layer,mask}` + `canCollide`（双向判定）+ `narrowPhaseLayered`。
- 场景集成（scene 模块）：`scene::collectBodies`（ccx.Collider {hx,hy,layer,mask}）+ `runCollisionSim`。
- 测试：physics.grid / physics.narrow_phase / physics.layers / physics.collider_component / physics.collider_roundtrip / e2e.tick_collision / e2e.contact_driven。依赖：foundation。
- M2：速度/解算/重力步进。
