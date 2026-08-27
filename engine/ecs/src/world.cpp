#include "ccx/ecs/world.h"

#include <algorithm>
#include <cstdio>
#include <cstring>
#include <typeinfo>

namespace ccx::ecs {

World::World() {
    defaultArchetype_ = getOrCreateArchetype({});
}

World::~World() {
    for (Archetype& a : archetypes_) {
        for (uint32_t r = 0; r < a.count; ++r) {
            for (const Column& c : a.columns) {
                if (c.ops.destroy) {
                    c.ops.destroy(detail::rowPtr(a, static_cast<int>(&c - a.columns.data()), r));
                }
            }
        }
    }
}

void World::registerComponent(TypeId id, size_t size, size_t align, const TypeOps& ops) {
    if (columnByType_.find(id) != columnByType_.end()) return;
    Column c;
    c.id = id;
    c.elemSize = size;
    c.elemAlign = align;
    c.ops = ops;
    columnByType_.emplace(id, std::move(c));
}

void World::sortIds(std::vector<TypeId>& ids) {
    std::sort(ids.begin(), ids.end());
}

uint32_t World::appendRow(Archetype& a) {
    if (a.count == a.capacity) {
        // M0 单 chunk 扩容：SoA 列重排（容量翻倍），历史行 memcpy 迁移
        const uint32_t newCap = a.capacity * 2;
        std::vector<size_t> offsets(a.columns.size(), 0);
        size_t off = 0;
        for (size_t i = 0; i < a.columns.size(); ++i) {
            const Column& c = a.columns[i];
            off = (off + c.elemAlign - 1) / c.elemAlign * c.elemAlign;
            offsets[i] = off;
            off += c.elemSize * newCap;
        }
        std::vector<uint8_t> nd(off, 0);
        for (size_t i = 0; i < a.columns.size(); ++i) {
            const Column& c = a.columns[i];
            const size_t copyBytes = static_cast<size_t>(a.count) * c.elemSize;
            if (copyBytes > 0) {
                std::memcpy(nd.data() + offsets[i], a.data.data() + c.offset, copyBytes);
            }
            a.columns[i].offset = offsets[i];
        }
        a.data = std::move(nd);
        a.capacity = newCap;
    }
    return a.count++;
}

uint32_t World::getOrCreateArchetype(const std::vector<TypeId>& sortedIds) {
    const auto it = archetypeByKey_.find(sortedIds);
    if (it != archetypeByKey_.end()) return it->second;

    Archetype a;
    a.ids = sortedIds;
    a.capacity = kChunkCapacity;
    size_t off = 0;
    for (const TypeId id : sortedIds) {
        const auto cit = columnByType_.find(id);
        if (cit == columnByType_.end()) {
            std::fprintf(stderr, "[ccx::ecs] archetype 引用未注册组件类型\n");
            std::abort();
        }
        Column c = cit->second;
        off = (off + c.elemAlign - 1) / c.elemAlign * c.elemAlign;
        c.offset = off;
        off += c.elemSize * kChunkCapacity;
        a.columns.push_back(std::move(c));
    }
    a.data.assign(off, 0);
    a.rowIds.reserve(kChunkCapacity);

    archetypes_.push_back(std::move(a));
    const uint32_t idx = static_cast<uint32_t>(archetypes_.size() - 1);
    archetypeByKey_.emplace(sortedIds, idx);
    return idx;
}

int World::columnIndex(const Archetype& a, TypeId id) const {
    for (size_t i = 0; i < a.columns.size(); ++i) {
        if (a.columns[i].id == id) return static_cast<int>(i);
    }
    return -1;
}

Entity World::create() {
    uint32_t idx;
    if (!freeIndices_.empty()) {
        idx = freeIndices_.back();
        freeIndices_.pop_back();
    } else {
        idx = static_cast<uint32_t>(records_.size());
        records_.push_back(Record{});
    }
    Record& rec = records_[idx];
    Archetype& a = archetypes_[defaultArchetype_];
    rec.archetype = defaultArchetype_;
    rec.slot = appendRow(a);
    a.rowIds.push_back(idx);
    rec.alive = true;
    return Entity{idx, rec.version};
}

Entity World::reserveEntity() {
    uint32_t idx;
    if (!freeIndices_.empty()) {
        idx = freeIndices_.back();
        freeIndices_.pop_back();
    } else {
        idx = static_cast<uint32_t>(records_.size());
        records_.push_back(Record{});
    }
    // 占位：未激活（valid() == false）
    return Entity{idx, records_[idx].version};
}

void World::activate(Entity e) {
    if (e.index >= records_.size()) return;
    Record& rec = records_[e.index];
    if (rec.alive || rec.version != e.version) return;
    rec.alive = true;
    rec.archetype = defaultArchetype_;
    Archetype& a = archetypes_[defaultArchetype_];
    rec.slot = appendRow(a);
    a.rowIds.push_back(e.index);
}

void World::destroy(Entity e) {
    if (!valid(e)) return;
    Record& rec = records_[e.index];
    Archetype& a = archetypes_[rec.archetype];
    destroyRow(a, rec.slot);
    rec.alive = false;
    ++rec.version;
    if (rec.version == 0) ++rec.version;  // 防回绕
    freeIndices_.push_back(e.index);
}

bool World::valid(Entity e) const {
    return e.index < records_.size() && records_[e.index].alive &&
           records_[e.index].version == e.version;
}

size_t World::entityCount() const {
    size_t n = 0;
    for (const Record& r : records_) {
        if (r.alive) ++n;
    }
    return n;
}

void World::destroyRow(Archetype& a, uint32_t row) {
    // 先销毁目标行的所有组件
    for (const Column& c : a.columns) {
        if (c.ops.destroy) c.ops.destroy(detail::rowPtr(a, static_cast<int>(&c - a.columns.data()), row));
    }
    --a.count;
    if (row != a.count) {
        // 保序移除：把最后一行移到被删行
        const uint32_t last = a.count;
        const uint32_t movedIdx = a.rowIds[last];
        for (const Column& c : a.columns) {
            void* dst = detail::rowPtr(a, static_cast<int>(&c - a.columns.data()), row);
            void* src = detail::rowPtr(a, static_cast<int>(&c - a.columns.data()), last);
            if (c.ops.relocatable) {
                std::memcpy(dst, src, c.elemSize);
            } else {
                c.ops.moveConstruct(dst, src);
                c.ops.destroy(src);
            }
        }
        a.rowIds[row] = movedIdx;
        records_[movedIdx].slot = row;
    }
    a.rowIds.pop_back();
}

void World::migrate(Entity e, const std::vector<TypeId>& newIds) {
    Record& rec = records_[e.index];
    const uint32_t oldIdx = rec.archetype;
    const uint32_t newIdx = getOrCreateArchetype(newIds);
    Archetype& oldArch = archetypes_[oldIdx];
    Archetype& newArch = archetypes_[newIdx];
    const uint32_t oldRow = rec.slot;
    const uint32_t newRow = appendRow(newArch);
    newArch.rowIds.push_back(e.index);

    // 1) 新独有列：默认构造
    for (const Column& c : newArch.columns) {
        if (columnIndex(oldArch, c.id) < 0) {
            c.ops.defaultConstruct(detail::rowPtr(newArch, static_cast<int>(&c - newArch.columns.data()), newRow));
        }
    }
    // 2) 共有列：迁移（memcpy 或 moveConstruct）
    for (const Column& oc : oldArch.columns) {
        const int ni = columnIndex(newArch, oc.id);
        if (ni < 0) continue;
        void* src = detail::rowPtr(oldArch, static_cast<int>(&oc - oldArch.columns.data()), oldRow);
        void* dst = detail::rowPtr(newArch, ni, newRow);
        if (oc.ops.relocatable) {
            std::memcpy(dst, src, oc.elemSize);
        } else {
            oc.ops.moveConstruct(dst, src);
        }
    }
    // 3) 销毁旧行（swap-remove）
    destroyRow(oldArch, oldRow);
    rec.archetype = newIdx;
    rec.slot = newRow;
}

void World::addByTypeId(Entity e, TypeId t) {
    if (!valid(e) || columnByType_.find(t) == columnByType_.end()) {
        std::fprintf(stderr,
                     "[ccx::ecs] addByTypeId 无效实体或未注册类型: idx=%u ver=%u valid=%d "
                     "alive=%d registered=%d\n",
                     e.index, e.version, (int)valid(e),
                     e.index < records_.size() ? (int)records_[e.index].alive : -1,
                     (int)columnByType_.count(t));
        std::abort();
    }
    Archetype& cur = archetypes_[records_[e.index].archetype];
    if (columnIndex(cur, t) >= 0) return;  // 幂等
    std::vector<TypeId> ids = cur.ids;
    ids.push_back(t);
    sortIds(ids);
    migrate(e, ids);
}

void World::removeByTypeId(Entity e, TypeId t) {
    if (!valid(e)) return;
    Archetype& cur = archetypes_[records_[e.index].archetype];
    int ci = columnIndex(cur, t);
    if (ci < 0) return;  // 幂等：没有就什么都不做
    std::vector<TypeId> ids = cur.ids;
    ids.erase(std::remove(ids.begin(), ids.end(), t), ids.end());
    migrate(e, ids);
}

}  // namespace ccx::ecs
