#pragma once
#include <cstdint>
#include <functional>

namespace ccx::game {

// 固定步长帧循环（防螺旋：单帧最多 maxSubSteps 步，超出丢弃时间）
struct GameLoopConfig {
    float fixedDt = 1.0f / 60.0f;
    uint32_t maxSubSteps = 4;
};

class GameLoop {
public:
    explicit GameLoop(GameLoopConfig cfg = {}) : cfg_(cfg) {}

    // 每 render 帧调用：累积 wallDt，执行 0..maxSubSteps 次固定步更新
    uint32_t step(float wallDt, const std::function<void(float)>& fixedUpdate) {
        acc_ += wallDt;
        uint32_t steps = 0;
        while (acc_ >= cfg_.fixedDt && steps < cfg_.maxSubSteps) {
            fixedUpdate(cfg_.fixedDt);
            acc_ -= cfg_.fixedDt;
            ++steps;
        }
        if (acc_ >= cfg_.fixedDt && steps == cfg_.maxSubSteps) {
            // 螺旋保护：超出部分丢弃（防死循环）
            acc_ = 0.0f;
        }
        ++frame_;
        return steps;
    }

    float accumulator() const { return acc_; }
    uint64_t frameCount() const { return frame_; }
    float fixedDt() const { return cfg_.fixedDt; }

private:
    GameLoopConfig cfg_;
    float acc_ = 0.0f;
    uint64_t frame_ = 0;
};

}  // namespace ccx::game
