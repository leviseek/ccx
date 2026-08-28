#include "ccx/physics/body.h"

#include <algorithm>

namespace ccx::physics {

std::vector<ContactEvent> narrowPhaseLayered(const SpatialGrid& grid,
                                             const std::map<uint32_t, Body>& bodies) {
    std::vector<ContactEvent> out;
    const auto cands = grid.pairs();
    for (const auto& [a, b] : cands) {
        const auto ia = bodies.find(a);
        const auto ib = bodies.find(b);
        if (ia == bodies.end() || ib == bodies.end()) continue;
        if (!canCollide(ia->second, ib->second)) continue;
        if (ia->second.box.overlaps(ib->second.box)) out.push_back({a, b});
    }
    std::sort(out.begin(), out.end(),
              [](const ContactEvent& x, const ContactEvent& y) {
                  return x.a < y.a || (x.a == y.a && x.b < y.b);
              });
    return out;
}

}  // namespace ccx::physics
