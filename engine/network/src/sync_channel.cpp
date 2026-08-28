// ECS delta 同步通道实现：紧凑小端编码（版本 1 + 条目数 + 条目流）
#include "ccx/network/sync_channel.h"

#include <cstring>

namespace ccx::network {

namespace {
constexpr uint8_t kVersion = 1;

void putU32(std::vector<uint8_t>& buf, uint32_t v) {
    buf.push_back(static_cast<uint8_t>(v & 0xFF));
    buf.push_back(static_cast<uint8_t>((v >> 8) & 0xFF));
    buf.push_back(static_cast<uint8_t>((v >> 16) & 0xFF));
    buf.push_back(static_cast<uint8_t>((v >> 24) & 0xFF));
}
void putF32(std::vector<uint8_t>& buf, float f) {
    uint32_t bits;
    std::memcpy(&bits, &f, sizeof(bits));
    putU32(buf, bits);
}
bool getU32(const uint8_t* d, size_t n, size_t& off, uint32_t& v) {
    if (off + 4 > n) return false;
    v = static_cast<uint32_t>(d[off]) | (static_cast<uint32_t>(d[off + 1]) << 8) |
        (static_cast<uint32_t>(d[off + 2]) << 16) | (static_cast<uint32_t>(d[off + 3]) << 24);
    off += 4;
    return true;
}
bool getF32(const uint8_t* d, size_t n, size_t& off, float& f) {
    uint32_t bits;
    if (!getU32(d, n, off, bits)) return false;
    std::memcpy(&f, &bits, sizeof(f));
    return true;
}
}  // namespace

std::vector<uint8_t> encodeDelta(const std::vector<SyncEntry>& entries) {
    std::vector<uint8_t> buf;
    buf.reserve(1 + 4 + entries.size() * 13);
    buf.push_back(kVersion);
    putU32(buf, static_cast<uint32_t>(entries.size()));
    for (const SyncEntry& e : entries) {
        putU32(buf, e.entity);
        buf.push_back(static_cast<uint8_t>(e.kind));
        putF32(buf, e.x);
        putF32(buf, e.y);
    }
    return buf;
}

bool decodeDelta(const uint8_t* data, size_t size, std::vector<SyncEntry>& out) {
    if (!data || size < 5) return false;
    if (data[0] != kVersion) return false;
    size_t off = 1;
    uint32_t count = 0;
    if (!getU32(data, size, off, count)) return false;
    out.clear();
    out.reserve(count);
    for (uint32_t i = 0; i < count; ++i) {
        SyncEntry e;
        if (!getU32(data, size, off, e.entity)) return false;
        if (off >= size) return false;
        const uint8_t k = data[off++];
        if (k < 1 || k > 3) return false;
        e.kind = static_cast<SyncEntry::Kind>(k);
        if (!getF32(data, size, off, e.x)) return false;
        if (!getF32(data, size, off, e.y)) return false;
        out.push_back(e);
    }
    return true;
}

}  // namespace ccx::network
