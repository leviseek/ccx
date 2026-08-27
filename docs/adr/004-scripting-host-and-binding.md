# ADR-004 脚本系统：TypeScript 为游戏脚本 + 代码生成绑定

- 状态：**采纳**（2026-08-27）
- 关联：ADR-001（语言）、ADR-002（ECS）
- 影响范围：scripting 模块、绑定生成器、热重载协议、组件 schema 供给

---

## 1. 背景

CCX 的脚本层要同时满足：低门槛 TS 工作流（战略卖点）、与 C++ 引擎核心的高性能互操作、编辑器/AI 能反射出组件 schema（驱动 Inspector 与场景序列化）、可热重载。cocos4 的现状是 TS 引擎直接内置 `native-binding`（ts 到 C++ 的封装），引擎逻辑大量在 TS，互操作路径长且性能不可控。

## 2. 候选

| 候选 | 描述 | 问题 |
| --- | --- | --- |
| A | 自研 VM/解释器 | 生态为零，性能与 Rust 等价物不可比，纯造轮子 |
| B | 脚本全走 WebAssembly（Wasm 内跑游戏逻辑） | 工具链割裂、调试难、小游戏/浏览器兼容复杂；TS 生态被浪费 |
| C | **V8/JSC 宿主 + IDL 代码生成绑定** | 需要投入绑定生成器；其余全优 |

## 3. 决策

**采纳 C：TypeScript 为唯一"游戏脚本"语言，编译到 JS；宿主按平台选：桌面/原生 V8、小游戏环境 JSC/平台 JS 引擎、Web 浏览器原生；C++ ↔ JS 边界全部由 IDL → 代码生成器产出（napi / C API + .d.ts），禁止手写桥接。**

## 4. 规格摘要（完整版见 engine-spec §7）

### 4.1 组件定义在 TS（schema 即数据）

```ts
@ccxComponent('game.Health')
class Health extends Component {
  @prop({ type: 'float', range: [0, 1000], ui: 'slider' })
  max = 100;
  @prop({ type: 'float' })
  current = 100;
  @prop({ type: 'assetRef', assetType: 'Material' })
  material!: AssetRef;
}
```

- 编译期从注解生成 JSON Schema 元数据（工具链的一部分），同样可供 C++ 序列化消费。

### 4.2 系统（TS 与 C++ 可混）

```ts
@ccxSystem({ stage: 'Simulation', before: ['ccx.PhysicsWriteback'] })
class Movement extends System {
  onUpdate(world: World, dt: number) {
    for (const [e, tf, vel] of world.query(Transform, Velocity)) {
      tf.position = tf.position.add(vel.v.mul(dt));
    }
  }
}
```

- C++ 系统（如物理、动画采样）注册同名字段，调度期统一。

### 4.3 IDL 绑定

- IDL 文件声明 C++ 导出面（类/函数/属性/回调），生成：napi 绑定（原生）、C 桩（WASM 预览场景）、`.d.ts`（脚本侧类型）、JSON Schema（Inspector/序列化用）。
- 每个引擎模块带一个 `.idl`；绑定层是**独立交付物**（gen/），业务代码不手写。

### 4.4 热重载

- 模块级热替换：保留 ECS 数据，替换组件类实现与系统逻辑；断点/栈可移植到新模块实例。
- 编辑器内"改脚本 → 保存 → 场景内实体热更新"，保留属性和 override。

## 5. 理由

1. **护城河闭环**：低门槛 TS + AI/Agent 直接写脚本（MCP 可生成组件/系统）是 CCX 区别于 Cocos 4 的商业理由之一。
2. **性能路径清晰**：Gameplay 在 TS，每帧热路径在 C++ 系统；绑定只发生在"每帧少量"的边界（移动/动画采样等），不做"TS 每帧驱动渲染"。
3. **绑定生成器是一次性投资**，长期消灭桥接 bug 与重复 .d.ts 漂移；cocos4 的 native-binding 是手写维护的（ts 侧封装），CCX 换自动化。
4. **宿主选择保守**：V8/JSC 都是成熟嵌入引擎；小游戏平台的 JS 引擎不支持时回退 JSC 适配（platform-spec 能力分支）。

## 6. 后果与反制

- **绑定生成器是 M0/M1 关键路径**（无它脚本层不可用）：roadmap 把它列为 M0 出口项之一。
- **GC 停顿**：V8 侧用 `--max-old-space-size`/增量标记策略；脚本侧数据大对象（如顶点/纹理缓冲）永远留 C++（句柄引用）。
- **热重载复杂度**：只承诺"模块级"热重载（非函数级补丁），文档明确边界。
- **TS 编译产物**：dev 用 esbuild 打包（快）；发布走 rollup + minify + tree-shaking；小游戏产物切 split-chunks 兼容。

## 7. 不做

- 不做 Lua/C# 第二脚本语言（第一版）；不做 Wasm 万能化（wasi 游戏逻辑暂不投入）；不做自研 VM。
- 不在脚本侧暴露底层分配器/裸指针（安全边界）。
