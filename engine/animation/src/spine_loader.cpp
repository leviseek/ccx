#include "ccx/animation/spine_loader.h"

#include <map>

namespace ccx::animation {

namespace {
// 合并 translate/rotate 关键帧：按时间排序（translate 与 rotate 各自独立 -> 联合轨）
void mergeKeys(BoneTrack& track, const json::Value& boneAnim) {
    struct Temp { float time; float x, y, rot; bool hasPose = false; };
    std::map<float, Temp> byTime;
    if (const json::Value* tr = boneAnim.find("translate")) {
        for (const auto& kv : tr->asArray()) {
            if (kv.asArray().size() < 3) continue;
            Temp& t = byTime[static_cast<float>(kv.asArray()[0].asNumber())];
            t.time = static_cast<float>(kv.asArray()[0].asNumber());
            t.x = static_cast<float>(kv.asArray()[1].asNumber());
            t.y = static_cast<float>(kv.asArray()[2].asNumber());
            t.hasPose = true;
        }
    }
    if (const json::Value* rt = boneAnim.find("rotate")) {
        for (const auto& kv : rt->asArray()) {
            if (kv.asArray().size() < 2) continue;
            Temp& t = byTime[static_cast<float>(kv.asArray()[0].asNumber())];
            t.time = static_cast<float>(kv.asArray()[0].asNumber());
            t.rot = static_cast<float>(kv.asArray()[1].asNumber());
            t.hasPose = true;
        }
    }
    for (const auto& [time, t] : byTime) {
        if (!t.hasPose) continue;
        track.keys.push_back({ time, { t.x, t.y, t.rot } });
    }
}
}  // namespace

bool loadSpineSkeleton(const json::Value& doc, Skeleton& out, std::string& err) {
    // bones 声明（名称/父级；v0.1 不构建层级）
    const json::Value* bones = doc.find("bones");
    if (!bones || bones->kind() != json::Kind::Array) {
        err = "缺少 bones 数组";
        return false;
    }
    std::vector<std::string> names;
    for (const auto& b : bones->asArray()) {
        if (const json::Value* n = b.find("name"); n && n->kind() == json::Kind::String) {
            names.push_back(n->asString());
        }
    }
    if (names.empty()) {
        err = "bones 为空";
        return false;
    }
    // 动画：首个动画的 bones 轨
    const json::Value* anims = doc.find("animations");
    if (!anims || anims->kind() != json::Kind::Object || anims->asObject().empty()) {
        err = "缺少 animations";
        return false;
    }
    const json::Value& firstAnim = anims->asObject().begin()->second;
    const json::Value* boneAnims = firstAnim.find("bones");
    out.tracks.clear();
    for (const std::string& name : names) {
        BoneTrack track;
        track.name = name;
        if (boneAnims && boneAnims->kind() == json::Kind::Object) {
            for (const auto& [bn, anim] : boneAnims->asObject()) {
                if (bn == name) {
                    mergeKeys(track, anim);
                    break;
                }
            }
        }
        out.tracks.push_back(std::move(track));
    }
    // 插槽 + 附件（skins.default.<slot>.<attachment>.path -> atlas 占位哈希）
    out.slots.clear();
    if (const json::Value* slots = doc.find("slots"); slots && slots->kind() == json::Kind::Array) {
        for (const auto& s : slots->asArray()) {
            SlotAttachment sa;
            if (const json::Value* n = s.find("name"); n && n->kind() == json::Kind::String) {
                sa.slot = n->asString();
            }
            if (const json::Value* skins = doc.find("skins");
                skins && skins->kind() == json::Kind::Object && !skins->asObject().empty()) {
                const json::Value& def = skins->asObject().begin()->second;
                for (const auto& [slotName, atts] : def.asObject()) {
                    if (slotName != sa.slot) continue;
                    if (atts.kind() != json::Kind::Object || atts.asObject().empty()) break;
                    sa.attachment = atts.asObject().begin()->first;
                    // v0.1：附件名稳定哈希 -> atlas 占位（真实图集索引在 M2 资源管线）
                    uint32_t hash = 0;
                    for (const char ch : sa.attachment) hash = hash * 31 + static_cast<uint8_t>(ch);
                    sa.atlas = (hash % 100) + 1;
                    break;
                }
            }
            out.slots.push_back(std::move(sa));
        }
    }
    return true;
}

}  // namespace ccx::animation