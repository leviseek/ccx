#pragma once
#include <cstdint>
#include <vector>

#include "ccx/foundation/math/vec2.h"

namespace ccx::particle {

// 2D 粒子发射器（数据面；renderer-spec §5：固定池 + 每批 <= 1 draw）
struct EmitterConfig {
    Vec2 pos{0.0f, 0.0f};
    float rate = 10.0f;
    float spawnSpeedMin = 50.0f;
    float spawnSpeedMax = 100.0f;
    float lifeMin = 1.0f;
    float lifeMax = 2.0f;
    float gravity = 0.0f;
    float drag = 0.0f;
    bool looping = true;
    uint32_t maxEmitPerFrame = 64;
};

struct Particle {
    Vec2 pos{0.0f, 0.0f};
    Vec2 vel{0.0f, 0.0f};
    float life = 0.0f;
    float maxLife = 1.0f;
    float size = 1.0f;
    float alpha = 1.0f;
    bool alive = false;
};

class Emitter {
public:
    explicit Emitter(EmitterConfig cfg, uint32_t capacity = 1024);

    void update(float dt);
    bool emitting() const;
    uint32_t aliveCount() const;
    uint32_t capacity() const { return capacity_; }
    const std::vector<Particle>& particles() const { return particles_; }

private:
    uint32_t allocSlot();
    float rand01();

    EmitterConfig cfg_;
    uint32_t capacity_;
    std::vector<Particle> particles_;
    float emissionTime_ = 0.0f;
    uint32_t randState_ = 0x1234567u;
};

}  // namespace ccx::particle
