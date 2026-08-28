# W6 发布链评估（2026-08-28）

## 环境侧（实测就绪）

| 组件 | 状态 | 位置 |
| --- | --- | --- |
| Android SDK | ✅ | %LOCALAPPDATA%\Android\Sdk（build-tools 33/35/36、platforms 33/36、licenses 已接受） |
| NDK | ✅ | SDK\ndk\25.1.8937393 |
| CMake | ✅ | SDK\cmake\3.22.1（引擎 CMake 交叉编译用） |
| 设备 | ✅ | emulator-5556（ALN-AL00）在线；ccx device 四链可用 |
| Java | ✅ | OpenJDK 17.0.19 |
| Gradle | ⏳ | 未装（wrapper 可经代理下载 maven 依赖） |

## 样例链（Android APK）

1. 引擎：CMake + NDK 交叉编译 → libccx_game.so（引擎构建已有 CMake 矩阵）。
2. Gradle wrapper 工程：JNI 壳（surface + 帧循环）→ APK（debug 签名）。
3. 部署：adb install → 启动 → **真机首帧截图 + 帧统计（exit4）**。

## 依赖与风险

- Gradle/maven 下载需网络（本地代理 7897 可用）。
- JNI 壳开发量：小（surface 渲染 + 引擎 tick 桥）。
- 结论：**环境侧 90% 就绪，缺口仅 gradle 与壳工程**——W6-1 可排期。
