#include "ccx/render/batcher.h"

namespace ccx::render {

std::vector<Batch> buildBatches(const std::vector<SpriteInst>& sprites) {
    std::vector<Batch> out;
    for (size_t i = 0; i < sprites.size();) {
        const BatchKey key{sprites[i].atlas, sprites[i].material};
        size_t j = i + 1;
        while (j < sprites.size() && sprites[j].atlas == key.atlas &&
               sprites[j].material == key.material) {
            ++j;
        }
        out.push_back({key, static_cast<uint32_t>(i), static_cast<uint32_t>(j - i)});
        i = j;
    }
    return out;
}

}  // namespace ccx::render
