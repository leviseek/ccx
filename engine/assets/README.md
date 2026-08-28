# assets — runtime 资产注册表

- 用途：运行时资产句柄（asset-spec §2 的运行时侧）。
- API：`AssetRegistry(capacity)`：`create(type, assetId, byteSize)` → 句柄（槽+版本）；`destroy`（幂等、版本+1 旧句柄失效）；`lookup` / `markLoaded/markUnloaded`；池满返回空句柄。
- 类型：Texture/Atlas/Sprite/Audio/Material/Shader/Scene。
- `parsePngSize`：PNG 头（IHDR）尺寸解析（签名/长度校验；解码 M2）。
- 测试：assets.registry（复用/失效/池满）、assets.png_size（E2E：PNG 头→byteSize→边长）。依赖：foundation。
