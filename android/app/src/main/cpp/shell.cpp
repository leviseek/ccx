// CCX Android 壳（W6 JNI）：版本/编译器桥 + 引擎帧生成（清屏+精灵色块）
#include <jni.h>
#include <string>
#include <vector>

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

// 引擎帧生成（v0.1 软件合成：深蓝底 + 红/绿/蓝精灵块——仿真帧语义）
// 返回 RGBA8 像素（64x64）；调用方转为 Bitmap
extern "C" JNIEXPORT jbyteArray JNICALL
Java_ccx_android_MainActivity_nativeFrame(JNIEnv* env, jobject) {
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
    // 三精灵块（仿真帧语义）
    for (int y = 0; y < 10; ++y) for (int x = 0; x < 10; ++x) put(8 + x, 8 + y, 0xFF0000FFu);
    for (int y = 0; y < 8; ++y) for (int x = 0; x < 8; ++x) put(40 + x, 20 + y, 0x00FF00FFu);
    for (int y = 0; y < 6; ++y) for (int x = 0; x < 14; ++x) put(20 + x, 44 + y, 0x0000FFFFu);

    jbyteArray out = env->NewByteArray(static_cast<jsize>(px.size()));
    env->SetByteArrayRegion(out, 0, static_cast<jsize>(px.size()),
                            reinterpret_cast<const jbyte*>(px.data()));
    return out;
}
