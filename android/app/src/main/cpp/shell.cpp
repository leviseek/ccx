// CCX Android 壳（W6 JNI）：版本/编译器桥 + 引擎帧生成（清屏+精灵色块）
#include <chrono>
#include <cmath>
#include <vector>

#include <jni.h>
#include <string>

// 设备帧统计（profiler 面）：帧计数 + 最近帧生成耗时
static uint64_t gFrames = 0;
static double gLastFrameMs = 0.0;

#include "ccx/render/raster.h"
#include "ccx/scene/scene.h"
#include "ccx/script/host.h"
#include "ccx/script/scene_bridge.h"

// 设备上共享场景：脚本经桥修改 -> 帧循环渲染（脚本驱动的游戏）
ccx::scene::Scene gScene;
std::string gBridgeOut;
const char* ccxSceneCommandBridge(const char* jsonIn) {
    gBridgeOut = ccx::script::applySceneCommand(gScene, jsonIn ? jsonIn : "{}");
    return gBridgeOut.c_str();
}

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
    const auto t0 = std::chrono::steady_clock::now();
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
    // 脚本已建实体时优先渲染脚本场景（设备上脚本驱动）
    ccx::scene::Scene& scene = gScene.renderOrder().empty() ? gScene : gScene;
    if (gScene.renderOrder().empty()) {
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
    scene.setLocalTransform(hero, { { 32.0f, 24.0f }, 0.0f, { 1.0f, 1.0f } });
    scene.setLocalTransform(npc, { { 40.0f, 20.0f }, 0.0f, { 1.0f, 1.0f } });
    scene.setLocalTransform(coin, { { 20.0f, 44.0f }, 0.0f, { 1.0f, 1.0f } });
    }
    // hero 每帧移动（脚本/本地场景共用）
    if (const auto hn = scene.node(ccx::scene::EntityId{0})) {
        constexpr float PI2 = 3.14159265f;
        const double ang2 = static_cast<double>(t) * 2.0 * PI2;
        const float hx = 32.0f + 20.0f * static_cast<float>(std::cos(ang2));
        const float hy = 24.0f + 16.0f * static_cast<float>(std::sin(ang2));
        scene.setLocalTransform(ccx::scene::EntityId{0}, { { hx, hy }, 0.0f, { 1.0f, 1.0f } });
    }

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
    ++gFrames;
    gLastFrameMs = std::chrono::duration<double, std::milli>(
                       std::chrono::steady_clock::now() - t0).count();
    return out;
}

// 设备帧统计（profiler）：frames 计数 + 最近帧 ms
extern "C" JNIEXPORT jstring JNICALL
Java_ccx_android_MainActivity_nativeFrameStats(JNIEnv* env, jobject) {
    std::string s = "frames=" + std::to_string(gFrames) +
                    " lastMs=" + std::to_string(static_cast<int>(gLastFrameMs * 10.0) / 10.0);
    return env->NewStringUTF(s.c_str());
}

// QuickJS 脚本面（设备上）：eval -> JSON 结果；脚本可经 ccxSceneCommand 驱动场景
extern "C" JNIEXPORT jstring JNICALL
Java_ccx_android_MainActivity_nativeEval(JNIEnv* env, jobject, jstring code) {
    const char* utf = env->GetStringUTFChars(code, nullptr);
    std::string result = "{}";
    if (utf) {
        ccx::script::ScriptHost host;
        host.setJsonFunction("ccxSceneCommand", &ccxSceneCommandBridge);
        result = "script-eval " + ccx::json::dump(host.eval(utf));
        env->ReleaseStringUTFChars(code, utf);
    }
    return env->NewStringUTF(result.c_str());
}