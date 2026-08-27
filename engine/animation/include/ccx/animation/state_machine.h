#pragma once
#include <map>
#include <set>
#include <string>
#include <vector>

#include "ccx/animation/clip.h"

namespace ccx::animation {

// 动画状态机（engine-spec §1：状态机数据面；M1 支持时间/触发器两类条件，
// 过渡时长只记录不插值——混合在 M2）
struct AnimState {
    std::string name;
    Clip clip;
    bool loop = true;
};

struct AnimTransition {
    std::string from;
    std::string to;
    std::string condition;   // "time_gt:0.5" | "trigger:walk" | "immediate"
    float duration = 0.0f;   // 过渡时长（M1 仅记录）
};

class AnimStateMachine {
public:
    void addState(AnimState s);
    void addTransition(AnimTransition t);
    void update(float dt);                    // 推进计时 + 条件求值切换
    void trigger(std::string name);           // 设置触发器（一次性）
    const std::string& currentState() const { return cur_; }
    float stateTime() const { return stateTime_; }
    const AnimState* currentClipState() const;

private:
    bool evaluate(const AnimTransition& t) const;

    std::map<std::string, AnimState> states_;
    std::vector<AnimTransition> transitions_;
    std::set<std::string> triggers_;
    std::string cur_;
    float stateTime_ = 0.0f;
    bool started_ = false;
};

}  // namespace ccx::animation
