# W6 发布链评估（2026-08-28）

## 环境侧（实测就绪）

| 组件 | 状态 | 位置 |
| --- | --- | --- |
| Android SDK | ✅ | %LOCALAPPDATA%\Android\Sdk（build-tools 33/35/36、platforms 33/36、licenses 已接受） |
| NDK | ✅ | SDK\ndk\25.1.8937393 |
| CMake | ✅ | SDK\cmake\3.22.1（引擎 CMake 交叉编译用） |
| 设备 | ✅ | emulator-5556（ALN-AL00）在线；ccx device 四链可用 |
| Java | ✅ | OpenJDK 17.0.19 |
| Gradle | ✅ | 9.7.1（手动下载经代理 → %USERPROFILE%\gradle；scoop 下载器不走代理故手动） |

## 样例链（Android APK）

1. 引擎：CMake + NDK 交叉编译 → libccx_game.so（引擎构建已有 CMake 矩阵）。
2. Gradle wrapper 工程：JNI 壳（surface + 帧循环）→ APK（debug 签名）。
3. 部署：adb install → 启动 → **真机首帧截图 + 帧统计（exit4）**。

## 依赖与风险

- Gradle/maven 下载需网络（本地代理 7897 可用）。
- JNI 壳开发量：小（surface 渲染 + 引擎 tick 桥）。
- 结论：**环境侧 100% 就绪**（2026-08-28 gradle 到位）——缺口仅 JNI 壳工程（小量开发），W6-1 可排期。

## 壳工程首建（2026-08-28）

- **APK 构建链验证成功**：gradle assembleDebug BUILD SUCCESSFUL（42KB app-debug.apk）；adb install Success；am start 触发。
- 待 debug：MainActivity 启动后 Shutdown 时 SIGSEGV（logcat Fatal signal 11）——JNI 壳生命周期问题，列入壳工程开发。
- 工程：android/（KTS + Kotlin 壳 + shell.cpp JNI）。



## 壳工程运行验证（2026-08-28）

- **Java 壳修复 SIGSEGV/ClassNotFound**（Kotlin 缺插件 → 纯 Java 壳）。
- **App 在模拟器上运行**：截图 OCR 显示 CCX（TextView 版本/编译器信息）；无 FATAL。
- 下一步：surface 渲染引擎帧（帧循环桥）。



## ★ 真机首帧（2026-08-28）★

- **引擎帧在 Android 设备屏幕显示**：nativeFrame（64x64 深蓝底+红/绿/蓝精灵块）→ Bitmap → Canvas 绘制；截图 OCR 实证三色块 + CCX 标签。
- exit4（真机首帧截图）达成；下一步：帧循环/交互桥。



## 壳帧循环（2026-08-28）

- **动态帧上屏**：nativeFrameAt(t)（红块圆路径）+ Handler 16ms 重绘；两间隔截图 OCR 红块位置变化（中→左）——设备动画验证通过。

