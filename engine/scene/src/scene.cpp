#include "ccx/scene/scene.h"

#include <algorithm>
#include <cmath>
#include <cstdio>

namespace ccx::scene {

uint32_t Scene::allocSlot() {
    const uint32_t idx = allocIndex_++;
    nodes_.resize(nodes_.size() + 1);
    nodes_.back().id = EntityId{idx};
    return idx;
}

Node& Scene::at(EntityId id) { return nodes_[id.index]; }
const Node& Scene::at(EntityId id) const { return nodes_[id.index]; }

bool Scene::slotEmpty(EntityId id) const {
    if (id.index >= nodes_.size()) return true;
    const Node& n = nodes_[id.index];
    return n.name.empty() && n.children.empty() && n.components.empty() &&
           n.id == EntityId{0};
}

EntityId Scene::createNode(std::string name, EntityId parent) {
    const uint32_t idx = allocSlot();
    Node& n = nodes_[idx];
    n.name = std::move(name);
    n.id = EntityId{idx};
    if (parent != kNullId) {
        if (parent.index >= nodes_.size()) {
            std::fprintf(stderr, "[ccx::scene] createNode: 父节点不存在\n");
            nodes_.pop_back();
            --allocIndex_;
            return kNullId;
        }
        n.parent = parent;
        nodes_[parent.index].children.push_back(n.id);
    }
    return n.id;
}

void Scene::destroyRecursive(EntityId id) {
    if (slotEmpty(id)) return;
    Node& n = at(id);
    for (const EntityId c : n.children) destroyRecursive(c);
    if (n.parent != kNullId) {
        auto& sib = nodes_[n.parent.index].children;
        sib.erase(std::remove(sib.begin(), sib.end(), id), sib.end());
    }
    n = Node{};
}

void Scene::destroyNode(EntityId id) {
    if (id.index >= nodes_.size()) return;
    destroyRecursive(id);
}

std::optional<Node> Scene::node(EntityId id) const {
    if (slotEmpty(id)) return std::nullopt;
    return at(id);
}

EntityId Scene::parentOf(EntityId id) const {
    if (slotEmpty(id)) return kNullId;
    return at(id).parent;
}

std::vector<EntityId> Scene::childrenOf(EntityId id) const {
    if (slotEmpty(id)) return {};
    return at(id).children;
}

size_t Scene::nodeCount() const {
    size_t n = 0;
    for (size_t i = 0; i < nodes_.size(); ++i) {
        if (!slotEmpty(EntityId{static_cast<uint32_t>(i)})) ++n;
    }
    return n;
}

void Scene::setComponent(EntityId id, std::string type, json::Value data) {
    Node& n = at(id);
    for (auto& c : n.components) {
        if (c.type == type) {
            c.data = std::move(data);
            return;
        }
    }
    n.components.push_back({std::move(type), std::move(data)});
}

const json::Value* Scene::component(EntityId id, const std::string& type) const {
    const Node& n = at(id);
    for (const auto& c : n.components) {
        if (c.type == type) return &c.data;
    }
    return nullptr;
}

bool Scene::hasComponent(EntityId id, const std::string& type) const {
    return component(id, type) != nullptr;
}

void Scene::removeComponent(EntityId id, const std::string& type) {
    Node& n = at(id);
    n.components.erase(
        std::remove_if(n.components.begin(), n.components.end(),
                       [&](const ComponentEntry& c) { return c.type == type; }),
        n.components.end());
}

void Scene::setSorting(EntityId id, uint32_t layer, int32_t sortingOrder) {
    Node& n = at(id);
    n.layer = layer;
    n.sortingOrder = sortingOrder;
}

void Scene::sortingOf(EntityId id, uint32_t& layer, int32_t& order) const {
    const Node& n = at(id);
    layer = n.layer;
    order = n.sortingOrder;
}

void Scene::setLocalTransform(EntityId id, const LocalTransform& t) { at(id).local = t; }

WorldTransform Scene::worldTransform(EntityId id) const {
    WorldTransform w;
    std::vector<EntityId> chain;
    EntityId cur = id;
    while (cur != kNullId && !slotEmpty(cur)) {
        chain.push_back(cur);
        const Node& n = at(cur);
        if (n.parent == kNullId) break;
        cur = n.parent;
    }
    for (auto it = chain.rbegin(); it != chain.rend(); ++it) {
        const Node& n = at(*it);
        // 父累积变换（w.rot/w.scale = 已达成的父级状态）作用于本节点 local 偏移
        const float cosR = std::cos(w.rotZ);
        const float sinR = std::sin(w.rotZ);
        const float lx = n.local.pos.x * w.scale.x;
        const float ly = n.local.pos.y * w.scale.y;
        w.pos.x += lx * cosR - ly * sinR;
        w.pos.y += lx * sinR + ly * cosR;
        // 本节点自身的变换继续累积（影响子孙）
        w.rotZ += n.local.rotZ;
        w.scale.x *= n.local.scale.x;
        w.scale.y *= n.local.scale.y;
    }
    return w;
}

void Scene::collectDfs(EntityId id, std::vector<EntityId>& out) const {
    if (slotEmpty(id)) return;
    out.push_back(id);
    for (const EntityId c : at(id).children) collectDfs(c, out);
}

std::vector<EntityId> Scene::renderOrder() const {
    std::vector<EntityId> out;
    for (size_t i = 0; i < nodes_.size(); ++i) {
        const EntityId id{static_cast<uint32_t>(i)};
        if (slotEmpty(id)) continue;
        if (at(id).parent != kNullId) continue;  // 只从根开始 DFS
        collectDfs(id, out);
    }
    // 稳定排序：(layer, sortingOrder) 升序 —— 同键保持 DFS 插入序
    std::stable_sort(out.begin(), out.end(), [this](EntityId a, EntityId b) {
        const Node& na = at(a);
        const Node& nb = at(b);
        if (na.layer != nb.layer) return na.layer < nb.layer;
        return na.sortingOrder < nb.sortingOrder;
    });
    return out;
}

EntityId Scene::instantiate(const Scene& templ, const std::vector<Override>& overrides,
                            EntityId parent) {
    // 1) 克隆模板树（oldId -> newId），保留组件/排序/变换
    std::vector<uint32_t> map(templ.nodes_.size(), 0xFFFFFFFFu);
    EntityId newRoot = kNullId;
    const auto cloneRec = [&](auto&& self, EntityId old, EntityId newParent) -> void {
        const Node& src = templ.at(old);
        const EntityId nid = createNode(src.name, newParent);
        map[old.index] = nid.index;
        if (newRoot == kNullId) newRoot = nid;
        for (const ComponentEntry& c : src.components) setComponent(nid, c.type, c.data);
        setSorting(nid, src.layer, src.sortingOrder);
        setLocalTransform(nid, src.local);
        for (const EntityId c : src.children) self(self, c, nid);
    };
    cloneRec(cloneRec, templ.nodes_[0].id, parent);

    // 2) 应用 override（对已被 RemoveNode 的实体跳过后续操作）
    for (const Override& o : overrides) {
        if (o.entityId >= map.size() || map[o.entityId] == 0xFFFFFFFFu) continue;
        const EntityId nid{map[o.entityId]};
        if (slotEmpty(nid)) continue;
        switch (o.op) {
            case Override::Op::AddComponent:
                setComponent(nid, o.componentType, o.value);
                break;
            case Override::Op::RemoveComponent:
                removeComponent(nid, o.componentType);
                break;
            case Override::Op::RemoveNode:
                destroyNode(nid);
                break;
            case Override::Op::SetField: {
                const json::Value* cur = component(nid, o.componentType);
                if (cur == nullptr) break;
                json::Value v = *cur;
                json::Value* walk = &v;
                // 逐段走到最后一段（setField 对已有键返回引用，不存在则创建）
                for (const std::string& seg : o.fieldPath) {
                    walk = &walk->setField(seg);
                }
                *walk = o.value;
                setComponent(nid, o.componentType, std::move(v));
                break;
            }
        }
    }
    return newRoot;
}

}  // namespace ccx::scene
