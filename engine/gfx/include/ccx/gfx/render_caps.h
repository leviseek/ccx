#pragma once
// GLES3/WebGL2 全档降级表（renderer-spec §2.4）：能力位驱动变体选择，游戏代码零改动（铁律 8）
#include <cstdint>

namespace ccx::gfx {

struct RenderCaps {
    bool instancing = false;
    bool indirectDraw = false;
    bool compute = false;
    uint32_t maxTextureSize = 2048;
    uint32_t maxBatchInstances = 1024;
};

enum class Tier : uint8_t { Full = 3, Instanced = 2, Fallback = 1, Software = 0 };

struct MinFeatures {
    bool instancing = true;
    bool indirectDraw = false;
    bool compute = false;
    uint32_t minTextureSize = 512;
};

inline Tier selectTier(const RenderCaps& caps, const MinFeatures& req) {
    // 需求开启而能力缺失 -> 逐级降（不降已满足的档位）：
    // instancing: caps 缺 -> Fallback（无实例化直接降）
    if (req.instancing && !caps.instancing) return Tier::Fallback;
    // indirectDraw: 需求开启而缺失 -> CPU 读回路径（Fallback 档，仍可实例化）
    Tier tier = Tier::Instanced;
    if (req.indirectDraw && !caps.indirectDraw) tier = Tier::Fallback;
    // compute: 需求开启而缺失 -> 再降 1 档
    if (req.compute && !caps.compute) tier = tier == Tier::Fallback ? Tier::Software : Tier::Fallback;
    // 纹理尺寸不足 -> Software（软件光栅兜底）
    if (caps.maxTextureSize < req.minTextureSize) tier = Tier::Software;
    return tier;
}

}  // namespace ccx::gfx
