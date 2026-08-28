#include "ccx/particle/emitter.h"

#include <algorithm>
#include <cmath>

namespace ccx::particle {

Emitter::Emitter(EmitterConfig cfg, uint32_t capacity)
    : cfg_(cfg), capacity_(capacity), particles_(capacity) {}

float Emitter::rand01() {
    // 确定性 LCG（测试可复现）
    randState_ = randState_ * 1664525u + 1013904223u;
    return static_cast<float>((randState_ >> 8) & 0xFFFFFFu) / 16777215.0f;
}

bool Emitter::emitting() const {
    return cfg_.looping || emissionTime_ * cfg_.rate < 1.0f;
}

uint32_t Emitter::allocSlot() {
    for (uint32_t i = 0; i < capacity_; ++i) {
        if (!particles_[i].alive) return i;
    }
    return capacity_;  // 池满
}

uint32_t Emitter::aliveCount() const {
    uint32_t n = 0;
    for (const Particle& p : particles_) {
        if (p.alive) ++n;
    }
    return n;
}

void Emitter::update(float dt) {
    // 1) 补发：rate*dt 取整 + 随机余数进位；受 maxEmitPerFrame 与池容量限制
    const float want = cfg_.rate * dt;
    uint32_t spawn = static_cast<uint32_t>(want);
    if (rand01() < want - static_cast<float>(spawn)) ++spawn;
    spawn = std::min<uint32_t>(spawn, cfg_.maxEmitPerFrame);
    for (uint32_t k = 0; k < spawn; ++k) {
        const uint32_t slot = allocSlot();
        if (slot >= capacity_) break;
        Particle& p = particles_[slot];
        p.alive = true;
        p.life = 0.0f;
        p.maxLife = cfg_.lifeMin + rand01() * (cfg_.lifeMax - cfg_.lifeMin);
        const float speed = cfg_.spawnSpeedMin +
                            rand01() * (cfg_.spawnSpeedMax - cfg_.spawnSpeedMin);
        const float ang = rand01() * 6.2831853f;
        p.vel = Vec2{std::cos(ang) * speed, std::sin(ang) * speed};
        p.pos = cfg_.pos;
        p.size = 1.0f;
        p.alpha = 1.0f;
    }
    // 2) 更新：位置/速度（drag、gravity）/生命/alpha 淡出
    for (Particle& p : particles_) {
        if (!p.alive) continue;
        p.pos += p.vel * dt;
        if (cfg_.drag > 0.0f) {
            p.vel *= std::max(0.0f, 1.0f - cfg_.drag * dt);
        }
        if (cfg_.gravity != 0.0f) p.vel.y += cfg_.gravity * dt;
        p.life += dt;
        const float t = p.life / p.maxLife;
        if (t >= 1.0f) {
            p.alive = false;
        } else {
            p.alpha = t > 0.6f ? (1.0f - t) / 0.4f : 1.0f;
        }
    }
    emissionTime_ += dt;
}

}  // namespace ccx::particle
