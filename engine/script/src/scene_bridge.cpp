#include "ccx/script/scene_bridge.h"

#include <string>

#include "ccx/foundation/serialization/json.h"

namespace ccx::script {

std::string applySceneCommand(scene::Scene& scene, const std::string& jsonCmd) {
    const auto cmd = json::parse(jsonCmd);
    const auto op = cmd.find("op");
    if (!op || op->kind() != json::Kind::String) return "{\"ok\":false,\"error\":\"no op\"}";
    const std::string s = op->asString();
    if (s == "create_entity") {
        const json::Value* name = cmd.find("name");
        const std::string nm = name && name->kind() == json::Kind::String ? name->asString() : "entity";
        scene::EntityId id = scene.createNode(nm);
        const json::Value* parent = cmd.find("parent");
        if (parent && parent->kind() == json::Kind::Number) {
            if (const auto pn = scene.node(scene::EntityId{static_cast<uint32_t>(parent->asNumber())})) {
                scene.setParent(id, pn->id);
            }
        }
        return "{\"ok\":true,\"id\":" + std::to_string(id.index) + "}";
    }
    if (s == "add_component") {
        const json::Value* idV = cmd.find("id");
        const json::Value* typeV = cmd.find("type");
        const json::Value* dataV = cmd.find("data");
        if (!idV || !typeV || typeV->kind() != json::Kind::String) {
            return "{\"ok\":false,\"error\":\"need id+type\"}";
        }
        const scene::EntityId id{static_cast<uint32_t>(idV->asNumber())};
        scene.setComponent(id, typeV->asString(),
                           dataV ? *dataV : json::Value::object({}));
        return "{\"ok\":true}";
    }
    if (s == "set_transform") {
        const json::Value* idV = cmd.find("id");
        const json::Value* posV = cmd.find("position");
        if (!idV || !posV || posV->kind() != json::Kind::Array || posV->asArray().size() < 2) {
            return "{\"ok\":false,\"error\":\"need id+position:[x,y]\"}";
        }
        const auto& arr = posV->asArray();
        scene::LocalTransform t;
        t.pos = {static_cast<float>(arr[0].asNumber()), static_cast<float>(arr[1].asNumber())};
        scene.setLocalTransform(scene::EntityId{static_cast<uint32_t>(idV->asNumber())}, t);
        return "{\"ok\":true}";
    }
    if (s == "destroy_entity") {
        const json::Value* idV = cmd.find("id");
        if (!idV) return "{\"ok\":false,\"error\":\"need id\"}";
        scene.destroyNode(scene::EntityId{static_cast<uint32_t>(idV->asNumber())});
        return "{\"ok\":true}";
    }
    if (s == "snapshot") return snapshotScene(scene);
    return "{\"ok\":false,\"error\":\"unknown op: " + s + "\"}";
}

std::string snapshotScene(const scene::Scene& scene) {
    std::string names = "[";
    bool first = true;
    for (const scene::EntityId id : scene.renderOrder()) {
        const auto n = scene.node(id);
        if (!n) continue;
        if (!first) names += ",";
        names += "\"" + n->name + "\"";
        first = false;
    }
    names += "]";
    return "{\"entities\":" + std::to_string(scene.renderOrder().size()) +
           ",\"names\":" + names + "}";
}

}  // namespace ccx::script
