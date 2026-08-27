#include "ccx/foundation/reflection/type.h"

namespace ccx {

TypeRegistry& TypeRegistry::instance() {
    static TypeRegistry s_instance;
    return s_instance;
}

bool TypeRegistry::registerType(const TypeInfo& ti) {
    if (byId_.find(ti.id) != byId_.end()) {
        return false;  // 幂等：重复注册静默忽略
    }
    byId_.emplace(ti.id, ti);
    byName_.emplace(std::string(ti.name), ti.id);
    return true;
}

const TypeInfo* TypeRegistry::find(TypeId id) const {
    const auto it = byId_.find(id);
    return it != byId_.end() ? &it->second : nullptr;
}

const TypeInfo* TypeRegistry::find(std::string_view name) const {
    const auto it = byName_.find(std::string(name));
    if (it == byName_.end()) {
        return nullptr;
    }
    return find(it->second);
}

size_t TypeRegistry::count() const { return byId_.size(); }

}  // namespace ccx
