// CCX Android 壳（W6 JNI）：版本/编译器桥 + 引擎帧生成（清屏+精灵色块）
#include <cmath>
#include <vector>

#include <jni.h>
#include <string>

#include "ccx/render/raster.h"
#include "ccx/scene/scene.h"

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
    // 引擎场景数据面：Scene + Sprite 实体 -> 光栅帧（帧循环）
    ccx::scene::Scene scene;
    ccx::scene::EntityId hero = scene.createNode("hero");
    ccx::json::Value::ObjectEntries spr;
    spr.emplace_back("atlas", ccx::json::Value::number(1));
    scene.setComponent(hero, "ccx.Sprite", ccx::json::Value::object(std::move(spr)));
    ccx::scene::EntityId npc = scene.createNode("npc");
    ccx::json::Value::ObjectEntries spr2;
    spr2.emplace_back("atlas", ccx::json::Value::number(2));
    scene.setComponent(npc, "ccx.Sprite", ccx::json::Value::object(std::move(spr2)));
    ccx::scene::EntityId coin = scene.createNode("coin");
    ccx::json::Value::ObjectEntries spr3;
    spr3.emplace_back("atlas", ccx::json::Value::number(3));
    scene.setComponent(coin, "ccx.Sprite", ccx::json::Value::object(std::move(spr3)));
    {
        constexpr float PI = 3.14159265f;
        const double ang = static_cast<double>(t) * 2.0 * PI;
        const float cx = 32.0f + 20.0f * static_cast<float>(std::cos(ang));
        const float cy = 24.0f + 16.0f * static_cast<float>(std::sin(ang));
        scene.setLocalTransform(hero, { { cx, cy }, 0.0f, { 1.0f, 1.0f } });
    }
    scene.setLocalTransform(npc, { { 40.0f, 20.0f }, 0.0f, { 1.0f, 1.0f } });
    scene.setLocalTransform(coin, { { 20.0f, 44.0f }, 0.0f, { 1.0f, 1.0f } });

    // 引擎光栅：按场景实体绘制（hero 红 / npc 绿 / coin 蓝）
    ccx::render::RasterTarget target(64, 64);
    target.clear(0x101020FFu);
    for (const ccx::scene::EntityId id : scene.renderOrder()) {
        const auto n = scene.node(id);
        if (!n) continue;
        const ccx::json::Value* s = scene.component(id, "ccx.Sprite");
        if (!s) continue;
        const uint32_t atlas = static_cast<uint32_t>(s->find("atlas")->asNumber());
        const auto w = scene.worldTransform(id);
        const int px2 = static_cast<int>(w.pos.x), py2 = static_cast<int>(w.pos.y);
        const uint32_t color = atlas == 1 ? 0xFF0000FFu : atlas == 2 ? 0x00FF00FFu : 0x0000FFFFu;
        for (int y = -5; y < 5; ++y) for (int x = -5; x < 5; ++x)
            target.put(px2 + x, py2 + y, color);
    }
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