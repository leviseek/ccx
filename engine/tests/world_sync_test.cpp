// M4 net sync 集成：World A -> 提取增量 -> encode -> decode -> World B 回放验证
#include <cstdio>
#include <vector>
#include "ccx/ecs/world.h"
#include "ccx/foundation/reflection/ccx_type.h"
#include "ccx/network/sync_channel.h"

using namespace ccx;
using namespace ccx::ecs;
using namespace ccx::network;

struct NPos { float x = 0.0f; float y = 0.0f; };
CCX_TYPE(NPos, (CCX_PROP(&NPos::x, "x", {})), (CCX_PROP(&NPos::y, "y", {})))

namespace { int g_fail = 0;
void check(bool ok, const char* what) { if (!ok) { std::printf("FAIL: %s", what); std::printf("%c", 10); ++g_fail; } }
}

int main() {
  // —— World A：3 个带位置实体，模拟权威端 ——
  World a;
  for (int i = 0; i < 3; ++i) {
    const Entity e = a.create();
    a.add<NPos>(e);
    a.get<NPos>(e).x = static_cast<float>(i) * 10.0f;
    a.get<NPos>(e).y = static_cast<float>(i) * -5.0f;
  }

  // —— 提取增量（Create 全量 + 位置） ——
  std::vector<SyncEntry> entries;
  a.query<NPos>([&](Entity e, NPos& p) {
    entries.push_back({e.index, SyncEntry::Kind::Create, p.x, p.y});
  });
  check(entries.size() == 3, "A 提取 3 条目");

  // —— encode -> decode（模拟网络传输） ——
  const auto bytes = encodeDelta(entries);
  std::vector<SyncEntry> rx;
  check(decodeDelta(bytes.data(), bytes.size(), rx), "解码成功");
  check(rx.size() == 3, "接收 3 条目");

  // —— World B：回放（创建 + 位置） ——
  World b;
  for (const SyncEntry& e : rx) {
    const Entity be = b.create();
    b.add<NPos>(be);
    b.get<NPos>(be).x = e.x;
    b.get<NPos>(be).y = e.y;
  }

  // —— 验证：B 与 A 位置一致 ——
  size_t n = 0;
  b.query<NPos>([&](Entity, NPos& p) {
    const float ex = static_cast<float>(n) * 10.0f;
    const float ey = static_cast<float>(n) * -5.0f;
    const bool same = (p.x == ex && p.y == ey);
    check(same, "B pos = A pos");
    ++n;
  });
  check(n == 3, "B 有 3 实体");

  // —— 增量更新：A 移动实体 1 ——
  a.query<NPos>([&](Entity e, NPos& p) { if (e.index == 1) { p.x = 999.0f; p.y = -888.0f; } });
  std::vector<SyncEntry> delta;
  a.query<NPos>([&](Entity e, NPos& p) {
    if (e.index == 1) delta.push_back({e.index, SyncEntry::Kind::Move, p.x, p.y});
  });
  const auto bytes2 = encodeDelta(delta);
  std::vector<SyncEntry> rx2;
  decodeDelta(bytes2.data(), bytes2.size(), rx2);
  check(rx2.size() == 1 && rx2[0].kind == SyncEntry::Kind::Move, "Move 增量 1 条");

  // 回放到 B（B 内 index 1 与 A 对应）
  b.query<NPos>([&](Entity e, NPos& p) {
    for (const SyncEntry& s : rx2) { if (e.index == s.entity) { p.x = s.x; p.y = s.y; } }
  });
  b.query<NPos>([&](Entity e, NPos& p) { if (e.index == 1) { check(p.x == 999.0f && p.y == -888.0f, "B 收到 Move 更新"); } });

  if (g_fail == 0) { std::printf("world_sync: all ok"); std::printf("%c", 10); return 0; }
  std::printf("world_sync: %d failures", g_fail); std::printf("%c", 10); return 1;
}