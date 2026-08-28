// CCX Android 壳（W6 JNI）：版本/编译器桥 + 引擎帧生成（清屏+精灵色块）
#include <cmath>
#include <vector>

#include <jni.h>
#include <string>

#include "ccx/render/raster.h"

extern "C" JNIEXPORT jstring JNICALL
Java_ccx_android_MainActivity_nativeVersion(JNIEnv* env, jobject) {
    return env->NewStringUTF("0.1.0");
}

extern "C" JNIEXPORT jstring JNICALL
Java_ccx_android_MainActivity_nativeCompiler(JNIEnv* env, jobject) {
#ifdef __clang__
    return env->NewStringUTF("clang (NDK)");
#else
    return env->NewStringUTF("gcc");
#endif
}

extern "C" JNIEXPORT jbyteArray JNICALL
Java_ccx_android_MainActivity_nativeFrameAt(JNIEnv* env, jobject, jfloat t);

// 引擎帧生成（v0.1 软件合成：深蓝底 + 红/绿/蓝精灵块——仿真帧语义）
// 返回 RGBA8 像素（64x64）；调用方转为 Bitmap
extern "C" JNIEXPORT jbyteArray JNICALL
Java_ccx_android_MainActivity_nativeFrame(JNIEnv* env, jobject) {
    return Java_ccx_android_MainActivity_nativeFrameAt(env, jobject(), 0.0f);
}

// 帧循环版：红块沿圆路径移动（t 秒；1.0 周期）——设备上可见动画
extern "C" JNIEXPORT jbyteArray JNICALL
Java_ccx_android_MainActivity_nativeFrameAt(JNIEnv* env, jobject, jfloat t) {
    constexpr int W = 64, H = 64;
    std::vector<uint8_t> px(static_cast<size_t>(W) * H * 4);
    auto put = [&](int x, int y, uint32_t rgba) {
        if (x < 0 || y < 0 || x >= W || y >= H) return;
        const size_t i = (static_cast<size_t>(y) * W + x) * 4;
        px[i] = static_cast<uint8_t>((rgba >> 24) & 0xFF);
        px[i + 1] = static_cast<uint8_t>((rgba >> 16) & 0xFF);
        px[i + 2] = static_cast<uint8_t>((rgba >> 8) & 0xFF);
        px[i + 3] = static_cast<uint8_t>(rgba & 0xFF);
    };
    // 清屏（深蓝）
    for (size_t i = 0; i < px.size(); i += 4) {
        px[i] = 0x10; px[i + 1] = 0x10; px[i + 2] = 0x20; px[i + 3] = 0xFF;
    }
    // 引擎渲染路径：RasterTarget（引擎光栅模块）+ 精灵绘制（帧循环）
    ccx::render::RasterTarget target(64, 64);
    target.clear(0x101020FFu);
    {
        constexpr float PI = 3.14159265f;
        const double ang = static_cast<double>(t) * 2.0 * PI;
        const int cx = static_cast<int>(32 + 20.0 * std::cos(ang));
        const int cy = static_cast<int>(24 + 16.0 * std::sin(ang));
        for (int y = -5; y < 5; ++y) for (int x = -5; x < 5; ++x)
            target.put(cx + x, cy + y, 0xFF0000FFu);
    }
    for (int y = 0; y < 8; ++y) for (int x = 0; x < 8; ++x) target.put(40 + x, 20 + y, 0x00FF00FFu);
    for (int y = 0; y < 6; ++y) for (int x = 0; x < 14; ++x) target.put(20 + x, 44 + y, 0x0000FFFFu);
    for (size_t i = 0; i < px.size(); i += 4) {
        const size_t pxi = i / 4;
        const uint32_t c = target.pixels[pxi];
        px[i] = static_cast<uint8_t>((c >> 24) & 0xFF);
        px[i + 1] = static_cast<uint8_t>((c >> 16) & 0xFF);
        px[i + 2] = static_cast<uint8_t>((c >> 8) & 0xFF);
        px[i + 3] = static_cast<uint8_t>(c & 0xFF);
    }

    jbyteArray out = env->NewByteArray(static_cast<jsize>(px.size()));
    env->SetByteArrayRegion(out, 0, static_cast<jsize>(px.size()),
                            reinterpret_cast<const jbyte*>(px.data()));
    return out;
}