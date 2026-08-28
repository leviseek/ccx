// cc4-compat 基线测试（M5）：Node façade 驱动 ECS 的 位置/激活 语义
#include <cstdio>

#include "ccx/ecs/world.h"
#include "cc4_node.h"

using namespace ccx::ecs;
namespace { int g_fail = 0;
void check(bool ok, const char* what) { if (!ok) { std::printf("FAIL: %s", what); std::printf("%c", 10); ++g_fail; } }
}
int main() {
  World w;
  const Entity e = w.create();
  cc4::Node node(&w, e);
  node.setName("hero");
  check(node.name() == "hero", "name 设置");
  check(node.x() == 0.0f && node.y() == 0.0f, "默认位置 0,0");
  node.setPosition(120.5f, 80.25f);
  check(node.x() == 120.5f && node.y() == 80.25f, "setPosition -> 位置");
  check(node.active() == true, "默认激活");
  node.setActive(false);
  check(node.active() == false, "setActive(false)");
  check(w.valid(e), "实体仍在 World");
  // 销毁后 façade 安全返回默认
  w.destroy(e);
  check(node.x() == 0.0f, "销毁后 x 安全");
  if (g_fail == 0) { std::printf("cc4_compat: all ok"); std::printf("%c", 10); return 0; }
  std::printf("cc4_compat: %d failures", g_fail); std::printf("%c", 10); return 1;
}