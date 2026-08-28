#include <cstdio>
#include <vector>
#include "ccx/network/sync_channel.h"
using namespace ccx::network;
namespace { int g_fail = 0;
void check(bool ok, const char* what) { if (!ok) { std::printf("FAIL: %s", what); std::printf("%c", 10); ++g_fail; } } }
int main() {
{
  std::vector<SyncEntry> in;
  in.push_back({7, SyncEntry::Kind::Create, 10.0f, 20.0f});
  in.push_back({7, SyncEntry::Kind::Move, 12.5f, 22.75f});
  in.push_back({9, SyncEntry::Kind::Remove, 0.0f, 0.0f});
  const auto bytes = encodeDelta(in);
  check(bytes.size() == 1 + 4 + 3 * 13, "size ok");
  std::vector<SyncEntry> out;
  check(decodeDelta(bytes.data(), bytes.size(), out), "decode ok");
  check(out.size() == 3, "count same");
  if (out.size() == 3) {
    check(out[0].entity == 7 && out[0].kind == SyncEntry::Kind::Create && out[0].x == 10.0f && out[0].y == 20.0f, "e0");
    check(out[1].kind == SyncEntry::Kind::Move && out[1].x == 12.5f, "e1");
    check(out[2].entity == 9 && out[2].kind == SyncEntry::Kind::Remove, "e2");
  }
}
{
  const auto bytes = encodeDelta({});
  check(bytes.size() == 5, "empty size");
  std::vector<SyncEntry> out;
  check(decodeDelta(bytes.data(), bytes.size(), out) && out.empty(), "empty decode");
}
{
  std::vector<SyncEntry> out;
  check(!decodeDelta(nullptr, 0, out), "null reject");
  const uint8_t bad[5] = {99, 0, 0, 0, 0};
  check(!decodeDelta(bad, 5, out), "version reject");
  const uint8_t trunc[6] = {1, 1, 0, 0, 0, 0};
  check(!decodeDelta(trunc, 6, out), "trunc reject");
}
if (g_fail == 0) { std::printf("sync_channel: all ok"); std::printf("%c", 10); return 0; }
std::printf("sync_channel: %d failures", g_fail); std::printf("%c", 10); return 1;
}