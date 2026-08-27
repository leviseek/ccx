#include "ccx/scene/schema.h"

#include <cstdio>
#include <map>
#include <optional>

namespace ccx::scene {

namespace {
struct Pending {
    uint32_t id = 0;
    std::string name;
    std::optional<uint32_t> parent;
    std::vector<ComponentEntry> comps;
};

float numAt(const json::Value* v, const char* key, float fallback) {
    if (v == nullptr) return fallback;
    const json::Value* f = v->find(key);
    return f != nullptr ? static_cast<float>(f->asNumber()) : fallback;
}
}  // namespace

bool loadSceneFile(const json::Value& doc, Scene& out, std::string& err) {
    if (doc.kind() != json::Kind::Object) {
        err = "scene: 根节点必须是对象";
        return false;
    }
    const json::Value* schema = doc.find("schema");
    if (schema == nullptr || schema->kind() != json::Kind::String ||
        schema->asString() != "ccx.scene/1") {
        err = "scene: 缺少或错误的 schema（需要 ccx.scene/1）";
        return false;
    }
    const json::Value* ents = doc.find("entities");
    if (ents == nullptr || ents->kind() != json::Kind::Array) {
        err = "scene: 缺少 entities";
        return false;
    }
    // 1) 收集待建节点
    std::vector<Pending> pend;
    for (const json::Value& ev : ents->asArray()) {
        Pending p;
        p.id = static_cast<uint32_t>(ev.find("id")->asNumber());
        if (const json::Value* n = ev.find("name")) p.name = n->asString();
        if (const json::Value* par = ev.find("parent")) {
            if (!par->isNull()) p.parent = static_cast<uint32_t>(par->asNumber());
        }
        if (const json::Value* cs = ev.find("components")) {
            for (const json::Value& c : cs->asArray()) {
                ComponentEntry ce;
                ce.type = c.find("type")->asString();
                if (const json::Value* d = c.find("data")) ce.data = *d;
                p.comps.push_back(std::move(ce));
            }
        }
        pend.push_back(std::move(p));
    }
    // 2) 先全建（无父），再统一挂父，最后组件
    std::map<uint32_t, EntityId> byId;
    for (const Pending& p : pend) {
        byId.emplace(p.id, out.createNode(p.name));
    }
    for (const Pending& p : pend) {
        if (p.parent.has_value()) {
            const auto it = byId.find(*p.parent);
            if (it == byId.end()) {
                err = "scene: 父节点不存在: " + std::to_string(*p.parent);
                return false;
            }
            out.setParent(byId.at(p.id), it->second);
        }
    }
    for (const Pending& p : pend) {
        const EntityId id = byId.at(p.id);
        for (const ComponentEntry& c : p.comps) {
            if (c.type == "ccx.Transform") {
                LocalTransform t;
                if (const json::Value* pos = c.data.find("position")) {
                    const auto& arr = pos->asArray();
                    if (arr.size() >= 2) {
                        t.pos = Vec2{static_cast<float>(arr[0].asNumber()),
                                     static_cast<float>(arr[1].asNumber())};
                    }
                }
                t.rotZ = numAt(&c.data, "rotationZ", 0.0f);
                if (const json::Value* scv = c.data.find("scale")) {
                    const auto& arr = scv->asArray();
                    if (arr.size() >= 2) {
                        t.scale = Vec2{static_cast<float>(arr[0].asNumber()),
                                       static_cast<float>(arr[1].asNumber())};
                    }
                }
                out.setLocalTransform(id, t);
            } else if (c.type == "ccx.Sorting") {
                out.setSorting(id, static_cast<uint32_t>(numAt(&c.data, "layer", 0.0f)),
                               static_cast<int32_t>(numAt(&c.data, "order", 0.0f)));
            } else {
                out.setComponent(id, c.type, c.data);
            }
        }
    }
    return true;
}

json::Value saveSceneFile(const Scene& in) {
    using json::Value;
    // 收集根（按内部序）并 DFS 导出（父先子后，id 重编号 1..n）
    std::vector<EntityId> roots;
    for (uint32_t i = 0; i < 1000000; ++i) {
        const auto n = in.node(EntityId{i});
        if (!n) continue;
        if (n->parent == kNullId) roots.push_back(EntityId{i});
    }
    std::map<EntityId, uint32_t> exportId;
    uint32_t nextId = 1;
    const auto count = [&](auto&& self, EntityId id) -> void {
        exportId[id] = nextId++;
        for (const EntityId c : in.childrenOf(id)) self(self, c);
    };
    for (const EntityId r : roots) count(count, r);

    Value::Array entities;
    const auto emit = [&](auto&& self, EntityId id) -> void {
        const auto n = in.node(id);
        if (!n) return;
        Value::ObjectEntries ent;
        ent.emplace_back("id", Value::number(exportId[id]));
        ent.emplace_back("name", Value::string(n->name));
        ent.emplace_back("parent", n->parent == kNullId
                                       ? Value::nil()
                                       : Value::number(exportId[n->parent]));
        Value::Array comps;
        {
            Value::ObjectEntries t;
            t.emplace_back("position",
                           Value::array({Value::number(n->local.pos.x),
                                         Value::number(n->local.pos.y)}));
            t.emplace_back("rotationZ", Value::number(n->local.rotZ));
            t.emplace_back("scale",
                           Value::array({Value::number(n->local.scale.x),
                                         Value::number(n->local.scale.y)}));
            Value::ObjectEntries t2;
            t2.emplace_back("type", Value::string("ccx.Transform"));
            t2.emplace_back("data", Value::object(std::move(t)));
            comps.push_back(Value::object(std::move(t2)));
        }
        {
            Value::ObjectEntries s;
            s.emplace_back("layer", Value::number(static_cast<double>(n->layer)));
            s.emplace_back("order", Value::number(n->sortingOrder));
            Value::ObjectEntries s2;
            s2.emplace_back("type", Value::string("ccx.Sorting"));
            s2.emplace_back("data", Value::object(std::move(s)));
            comps.push_back(Value::object(std::move(s2)));
        }
        for (const ComponentEntry& c : n->components) {
            Value::ObjectEntries c2;
            c2.emplace_back("type", Value::string(c.type));
            c2.emplace_back("data", c.data);
            comps.push_back(Value::object(std::move(c2)));
        }
        ent.emplace_back("components", Value::array(std::move(comps)));
        entities.push_back(Value::object(std::move(ent)));
        for (const EntityId c : in.childrenOf(id)) self(self, c);
    };
    for (const EntityId r : roots) emit(emit, r);

    Value::ObjectEntries root;
    root.emplace_back("schema", Value::string("ccx.scene/1"));
    Value::ObjectEntries meta;
    meta.emplace_back("name", Value::string("scene"));
    meta.emplace_back("generator", Value::string("ccx-scene-cpp"));
    root.emplace_back("meta", Value::object(std::move(meta)));
    root.emplace_back("entities", Value::array(std::move(entities)));
    root.emplace_back("systems", Value::array(Value::Array{}));
    return Value::object(std::move(root));
}

}  // namespace ccx::scene
