#include "ccx/animation/state_machine.h"

#include <cstdio>

namespace ccx::animation {

namespace {
bool startsWith(const std::string& s, const char* prefix) {
    return s.rfind(prefix, 0) == 0;
}
}  // namespace

void AnimStateMachine::addState(AnimState s) {
    if (s.name.empty()) {
        std::fprintf(stderr, "[ccx::anim] 状态名不能为空\n");
        return;
    }
    const std::string name = s.name;  // move 前先取（string 搬移后会变空）
    states_[name] = std::move(s);
    if (!started_) {
        cur_ = name;
        started_ = true;
    }
}

void AnimStateMachine::addTransition(AnimTransition t) {
    if (t.from.empty() || t.to.empty() ||
        states_.find(t.to) == states_.end()) {
        std::fprintf(stderr, "[ccx::anim] 过渡目标状态不存在: %s->%s\n",
                     t.from.c_str(), t.to.c_str());
        return;
    }
    transitions_.push_back(std::move(t));
}

bool AnimStateMachine::evaluate(const AnimTransition& t) const {
    if (t.condition == "immediate") return true;
    if (startsWith(t.condition, "time_gt:")) {
        const float limit = std::atof(t.condition.c_str() + 8);
        return stateTime_ >= limit;
    }
    if (startsWith(t.condition, "trigger:")) {
        return triggers_.count(t.condition.substr(8)) > 0;
    }
    return false;
}

void AnimStateMachine::trigger(std::string name) { triggers_.insert(std::move(name)); }

const AnimState* AnimStateMachine::currentClipState() const {
    const auto it = states_.find(cur_);
    return it != states_.end() ? &it->second : nullptr;
}

void AnimStateMachine::update(float dt) {
    stateTime_ += dt;
    for (const AnimTransition& t : transitions_) {
        if (t.from != cur_) continue;
        if (!evaluate(t)) continue;
        // 切换：重置计时；触发器一次性消费
        cur_ = t.to;
        stateTime_ = 0.0f;
        if (startsWith(t.condition, "trigger:")) {
            triggers_.erase(t.condition.substr(8));
        }
        break;  // v1：每帧至多切换一次
    }
}

}  // namespace ccx::animation
