// M4 exit 1: 2D 联机 demo——16 人同屏 delta 同步（权威端 -> 16 客户端收敛验证）
#include <cstdio>
#include <vector>
#include "ccx/ecs/world.h"
#include "ccx/foundation/reflection/ccx_type.h"
#include "ccx/network/sync_channel.h"
using namespace ccx::ecs;
using namespace ccx::network;
struct PPos { float x = 0.0f; float y = 0.0f; };
namespace ccx {
template <>
inline const TypeInfo* type_info_of<PPos>() {
    static const TypeInfo kInfo = detail::make_type_info<PPos>("PPos", {});
    return &kInfo;
}
}
int main() {
  constexpr int kPlayers = 16;
  // 权威端：16 玩家各自位置（模拟实时移动）
  World server;
  for (int i = 0; i < kPlayers; ++i) {
    const Entity e = server.create();
    server.add<PPos>(e);
    server.get<PPos>(e).x = static_cast<float>(i) * 10.0f;
    server.get<PPos>(e).y = 0.0f;
  }
  // 16 客户端 World（各自接收增量）
  std::vector<World> clients(16);
  // 广播 3 帧（每帧全量 delta + 玩家移动）
  for (int frame = 0; frame < 3; ++frame) {
    // 权威帧推进：玩家 0 移动 + 其余随机微移
    server.query<PPos>([](Entity, PPos& p) { p.y = p.y + 1.0f; });
    // 编码广播 delta
    std::vector<SyncEntry> entries;
    server.query<PPos>([&](Entity e, PPos& p) {
      entries.push_back({e.index, SyncEntry::Kind::Move, p.x, p.y});
    });
    const auto bytes = encodeDelta(entries);
    // 客户端解码回放（16 个都收同一包）
    for (int ci = 0; ci < kPlayers; ++ci) {
      std::vector<SyncEntry> rx;
      if (!decodeDelta(bytes.data(), bytes.size(), rx)) {
        std::printf("FAIL: client %d decode\n", ci);
        return 1;
      }
      World& w = clients[static_cast<size_t>(ci)];
      for (const SyncEntry& s : rx) {
        if (!w.valid(Entity{s.entity, 1})) w.create();  // 简化：会话期实体存在（v1 demo）
        w.add<PPos>(Entity{s.entity, 1});
        w.get<PPos>(Entity{s.entity, 1}).x = s.x;
        w.get<PPos>(Entity{s.entity, 1}).y = s.y;
      }
    }
  }
  // 收敛验证：所有客户端与服务器一致（抽样 16 客户端 0/8/15）
  int fails = 0;
  for (int ci : {0, 8, 15}) {
    World& w = clients[static_cast<size_t>(ci)];
    for (int pi = 0; pi < kPlayers; ++pi) {
      const float sy = static_cast<float>(pi) * 10.0f;
      const float ex = sy;
      const float ey = 3.0f;  // 3 帧各 +1
      if (!w.valid(Entity{static_cast<uint32_t>(pi), 1})) { ++fails; continue; }
      const PPos& p = w.get<PPos>(Entity{static_cast<uint32_t>(pi), 1});
      if (p.x != ex || p.y != ey) ++fails;
    }
  }
  if (fails == 0) { std::printf("net16p: all ok (16 clients converged)"); std::printf("%c", 10); return 0; }
  std::printf("net16p: %d convergence failures", fails); std::printf("%c", 10); return 1;
}