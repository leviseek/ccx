#pragma once
#include <algorithm>
#include <array>
#include <cstddef>
#include <cstdint>
#include <map>
#include <tuple>
#include <utility>
#include <vector>

#include "ccx/ecs/entity.h"
#include "ccx/foundation/reflection/type.h"

namespace ccx::ecs {

// 组件生命周期操作（由 TypeOps<T> 生成）：M0 的组件存储/迁移/销毁基础
struct TypeOps {
    void (*destroy)(void*) = nullptr;
    void (*defaultConstruct)(void*) = nullptr;
    void (*moveConstruct)(void*, void*) = nullptr;
    bool relocatable = false;  // 平凡可拷贝 -> memcpy 路径
};

struct Column {
    TypeId id = 0;
    size_t elemSize = 0;
    size_t elemAlign = 0;
    size_t offset = 0;  // 数据块内字节偏移（SoA）
    TypeOps ops;
};

// Archetype + 单 chunk（M0：每 archetype 一个 SoA chunk，容量固定）
struct Archetype {
    std::vector<TypeId> ids;      // 排序（规范序，作为 archetype 键）
    std::vector<Column> columns;  // 与 ids 同序
    std::vector<uint8_t> data;    // Σ columns（capacity × elemSize）
    std::vector<uint32_t> rowIds; // 行 -> entity index
    uint32_t capacity = 0;
    uint32_t count = 0;
};

namespace detail {
inline void* rowPtr(Archetype& a, int col, uint32_t row) {
    const Column& c = a.columns[static_cast<size_t>(col)];
    return a.data.data() + c.offset + static_cast<size_t>(row) * c.elemSize;
}
}  // namespace detail

class World {
public:
    static constexpr uint32_t kChunkCapacity = 256;

    World();
    ~World();
    World(const World&) = delete;
    World& operator=(const World&) = delete;

    // 组件类型注册（首次使用自动）；要求该类型已 CCX_TYPE 注册（engine-spec §5.1）
    template <class T>
    void ensureComponent() {
        const TypeId id = componentTypeId<T>();
        if (id == 0) {
            std::fprintf(stderr,
                         "[ccx::ecs] 组件类型未注册（缺少 CCX_TYPE）：%s\n",
                         typeid(T).name());
            std::abort();
        }
        if (columnByType_.find(id) != columnByType_.end()) return;
        registerComponent(id, sizeof(T), alignof(T), makeTypeOps<T>());
    }

    Entity create();
    void destroy(Entity e);
    bool valid(Entity e) const;
    size_t entityCount() const;

    // CommandBuffer 配套（引擎-spec §3.5：apply 前仅占位）
    Entity reserveEntity();
    void activate(Entity e);

    // const 语义：不做注册（未注册类型不会有实体拥有它 -> 自然 false）
    template <class T>
    bool has(Entity e) const {
        return valid(e) && columnIndex(archetypes_[records_[e.index].archetype],
                                       componentTypeId<T>()) >= 0;
    }

    template <class T>
    T& get(Entity e) {
        ensureComponent<T>();
        const uint32_t ai = records_[e.index].archetype;
        Archetype& a = archetypes_[ai];
        const int ci = columnIndex(a, componentTypeId<T>());
        if (ci < 0) {
            std::fprintf(stderr, "[ccx::ecs] get<T> 但实体无该组件（先 has/add）\n");
            std::abort();
        }
        return *static_cast<T*>(detail::rowPtr(a, ci, records_[e.index].slot));
    }

    template <class T>
    void add(Entity e) {
        ensureComponent<T>();
        addByTypeId(e, componentTypeId<T>());
    }

    template <class T>
    void remove(Entity e) {
        ensureComponent<T>();
        removeByTypeId(e, componentTypeId<T>());
    }

    // 查询：组件签名任意顺序；fn(Entity, Cs&...)；满足全部 Cs 才命中
    // M1：签名(排序) -> archetype 列表缓存于 queryCache_，新 archetype 创建时失效
    template <class... Cs, class Fn>
    void query(Fn&& fn) {
        (ensureComponent<Cs>(), ...);
        constexpr size_t N = sizeof...(Cs);
        std::array<TypeId, N> sig{componentTypeId<Cs>()...};
        std::sort(sig.begin(), sig.end());
        std::vector<TypeId> key(sig.begin(), sig.end());
        auto it = queryCache_.find(key);
        if (it == queryCache_.end()) {
            std::vector<uint32_t> hits;
            for (uint32_t ai = 0; ai < archetypes_.size(); ++ai) {
                bool ok = true;
                for (const TypeId id : key) {
                    if (columnIndex(archetypes_[ai], id) < 0) { ok = false; break; }
                }
                if (ok) hits.push_back(ai);
            }
            it = queryCache_.emplace(std::move(key), std::move(hits)).first;
        }
        for (const uint32_t ai : it->second) {
            Archetype& a = archetypes_[ai];
            if (a.count == 0) continue;
            std::array<int, N> cols{};
            size_t i = 0;
            bool ok = true;
            ((cols[i] = columnIndex(a, componentTypeId<Cs>()),
              ok = ok && (cols[i] >= 0), ++i),
             ...);
            if (!ok) continue;
            for (uint32_t r = 0; r < a.count; ++r) {
                const Entity ent{a.rowIds[r], records_[a.rowIds[r]].version};
                visitQueryRow<Cs...>(fn, a, cols, r, ent,
                                     std::index_sequence_for<Cs...>{});
            }
        }
    }

    template <class... Cs>
    size_t count() {
        size_t n = 0;
        query<Cs...>([&](Entity, Cs&...) { ++n; });
        return n;
    }

    // —— CommandBuffer/内部使用 ——
    void addByTypeId(Entity e, TypeId t);
    void removeByTypeId(Entity e, TypeId t);
    int columnIndex(const Archetype& a, TypeId id) const;
    template <class T>
    static TypeId componentTypeId() {
        const TypeInfo* ti = type_info_of<T>();
        return ti ? ti->id : 0;
    }

private:
    struct Record {
        uint32_t archetype = 0xFFFFFFFFu;
        uint32_t slot = 0;
        uint32_t version = 1;
        bool alive = false;
    };

    template <class T>
    static TypeOps makeTypeOps() {
        TypeOps ops;
        ops.destroy = [](void* p) { static_cast<T*>(p)->~T(); };
        ops.defaultConstruct = [](void* p) { ::new (p) T(); };
        ops.moveConstruct = [](void* d, void* s) {
            ::new (d) T(std::move(*static_cast<T*>(s)));
        };
        ops.relocatable = std::is_trivially_copyable_v<T>;
        return ops;
    }

    void registerComponent(TypeId id, size_t size, size_t align, const TypeOps& ops);
    uint32_t getOrCreateArchetype(const std::vector<TypeId>& sortedIds);
    static uint32_t appendRow(Archetype& a);  // 容量满时自动扩容（M0 单 chunk 增长）
    static void sortIds(std::vector<TypeId>& ids);
    void migrate(Entity e, const std::vector<TypeId>& newIds);
    void destroyRow(Archetype& a, uint32_t row);

    template <class... Cs, class Fn, size_t... I>
    static void visitQueryRow(Fn& fn, Archetype& a,
                              const std::array<int, sizeof...(Cs)>& cols,
                              uint32_t r, Entity e, std::index_sequence<I...>) {
        fn(e, *static_cast<std::tuple_element_t<I, std::tuple<Cs...>>*>(
               detail::rowPtr(a, cols[I], r))...);
    }

    std::vector<Record> records_;
    std::vector<Archetype> archetypes_;
    std::map<std::vector<TypeId>, uint32_t> archetypeByKey_;
    std::map<TypeId, Column> columnByType_;
    std::vector<uint32_t> freeIndices_;
    uint32_t defaultArchetype_ = 0;

    // M1：Query 缓存 —— 签名(排序后) -> 匹配的 archetype 下标；新 archetype 创建时失效
    std::map<std::vector<TypeId>, std::vector<uint32_t>> queryCache_;
};

}  // namespace ccx::ecs
