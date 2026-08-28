#include "ccx/physics/contact.h"

#include <algorithm>

namespace ccx::physics {

std::vector<ContactEvent> narrowPhase(const SpatialGrid& grid,
                                      const std::map<uint32_t, Aabb>& boxes) {
    std::vector<ContactEvent> out;
    const auto cands = grid.pairs();
    for (const auto& [a, b] : cands) {
        const auto ia = boxes.find(a);
        const auto ib = boxes.find(b);
        if (ia == boxes.end() || ib == boxes.end()) continue;
        if (ia->second.overlaps(ib->second)) out.push_back({a, b});
    }
    std::sort(out.begin(), out.end(),
              [](const ContactEvent& x, const ContactEvent& y) {
                  return x.a < y.a || (x.a == y.a && x.b < y.b);
              });
    return out;
}

std::vector<ContactEvent> resolveContacts(const SpatialGrid& grid,
                                          const std::map<uint32_t, Aabb>& boxes) {
    return narrowPhase(grid, boxes);
}

}  // namespace ccx::physics
