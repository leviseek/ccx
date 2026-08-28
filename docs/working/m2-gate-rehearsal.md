# M2 Gate 预演清单（exit 标准 <- 承接工作 <- 验收动作）

> 日期：2026-08-27 · 来源：m2-kickoff.md §3 exit 标准；每行回推 M1 已承接项与 M2 验收动作。
> 用途：M2 开工即开工作的直接底表。

| # | M2 exit（可证伪） | M1 已承接 | M2 承接工作 | 验收动作 |
| --- | --- | --- | --- | --- |
| 1 | **第一帧**：SPRITE 场景经 WebGPU/GLES 输出非空帧 | 渲染数据全链（items→packer 批/顶点/索引）→相机→软件光栅像素断言（frame_ppm/diff/anim_color）；PPM/BMP/GIF 三出口 | gfx 后端接入 packer 缓冲上传（dynamic vertex/instance buffer）+ 绘制调用；RHI 抽象对齐 gfx 验证层 | 帧缓冲像素对照软件光栅黄金输出（现有断言移植到 GPU 缓冲读取） |
| 2 | **编辑器内测**：全程无手改 JSON | buildView/renderViewHtml/preview（--frame/--gif 嵌入）、命令总线+undo、audit 留痕、collider 写路径校验 | Web UI 渲染层（DOM 消费 buildView）+ 命令派发到 daemon（RPC）+ 场景预览视图 | 内测剧本 15 步（建精灵→置位→加组件→保存→重开）人工走查 + 审计导出核对 |
| 3 | **脚本可跑**：V8 宿主运行脚本驱动场景变更 | bindgen IDL→napi（7/7+tsc）；CI 任务 lighthouse-c-bindgen 待真跑；daemon scene.apply 即"脚本同款写路径" | 绑定编译打通（CI 或本机 node-gyp）→ V8 隔离/沙箱 → 脚本桥接 daemon/引擎 | smoke：脚本跑 10 条 scene.apply 且场景文件差异可 diff |
| 4 | **移动端冒烟**：Android/iOS 预编译样例启动首帧 | 平台矩阵（astc4/etc2/bc7 + 音频目标）+ cook 管线 + 打包 manifest | 真机构建链（gradle/xcode 模板）+ 运行时代码入口（GameLoop 是现成主循环） | 真机/模拟器启动截图与帧统计上报（profiler RPC） |
| 5 | **压缩真实化**：cook 对 png 产出真实字节 | registerCompressor 插件接口 + cookWithCompression（失败不阻塞）+ PNG 头解析 | astcenc/etto 等原生 worker 接入（经 N-API 或 CLI 工具） | 产物头部 magic 校验（ETC2/ASTC）+ 尺寸对比原始 png |

## 执行顺序建议（依赖优先）

1. W1（exit1）→ 2. W2/W3（exit2，可并行 W5）→ 3. W5（exit3）→ 4. W4/W6（exit4/5，渠道并行）。
> 依赖回溯：任何 exit 修订须同步本表与 m2-kickoff §3。
