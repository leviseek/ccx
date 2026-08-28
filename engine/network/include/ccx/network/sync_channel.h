#pragma once
// ECS delta 同步通道（roadmap M4：net sync）——纯数据面（无 socket），可单测
// 编码：实体状态快照增量（created/moved/removed）→ 紧凑字节流
// 解码：字节流 → World 回放（apply）

#include <cstdint>
#include <string>
#include <vector>

namespace ccx::network {

struct SyncEntry {
    uint32_t entity = 0;
    enum class Kind : uint8_t { Create = 1, Move = 2, Remove = 3 };
    Kind kind = Kind::Move;
    float x = 0.0f;
    float y = 0.0f;
};

std::vector<uint8_t> encodeDelta(const std::vector<SyncEntry>& entries);

bool decodeDelta(const uint8_t* data, size_t size, std::vector<SyncEntry>& out);

}  // namespace ccx::network
