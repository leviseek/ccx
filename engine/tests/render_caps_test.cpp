// GLES3 降级表测试（renderer-spec §2.4）：能力位 -> 档位链
#include <cstdio>

#include "ccx/gfx/render_caps.h"

using namespace ccx::gfx;
namespace { int g_fail = 0;
void check(bool ok, const char* what) { if (!ok) { std::printf("FAIL: %s", what); std::printf("%c", 10); ++g_fail; } }
}
int main() {
  MinFeatures req;  // 默认：instancing on, indirect off, compute off, tex 512

  // 1) 全能力（现代 GPU): Instanced 档
  RenderCaps full{ true, true, true, 4096, 1024 };
  check(selectTier(full, req) == Tier::Instanced, "全能力 -> Instanced");

  // 2) 需求开启 indirectDraw 而缺失（GLES2 级): Fallback 档（CPU 读回）
  MinFeatures needIndirect;
  needIndirect.indirectDraw = true;
  RenderCaps noIndirect{ true, false, true, 4096, 1024 };
  check(selectTier(noIndirect, needIndirect) == Tier::Fallback, "need indirectDraw missing -> Fallback");

  // 2b) 不需求 indirectDraw 时缺能力不降档（需求驱动，游戏代码零改动）
  check(selectTier(noIndirect, req) == Tier::Instanced, "indirectDraw not required -> keep Instanced");

  // 3) 无实例化（极端老设备): Fallback（无实例化直接降）
  RenderCaps noInst{ false, false, false, 2048, 256 };
  check(selectTier(noInst, req) == Tier::Fallback, "no instancing -> Fallback");

  // 4) 纹理小（<512): Software 兜底
  RenderCaps smallTex{ true, true, true, 256, 512 };
  check(selectTier(smallTex, req) == Tier::Software, "small texture -> Software");

  // 5) 需求 compute 而缺失 -> 降 1 档
  MinFeatures needCompute;
  needCompute.compute = true;
  RenderCaps noCompute{ true, true, false, 4096, 1024 };
  check(selectTier(noCompute, needCompute) == Tier::Fallback, "need compute missing -> Fallback");

  if (g_fail == 0) { std::printf("render_caps: all ok"); std::printf("%c", 10); return 0; }
  std::printf("render_caps: %d failures", g_fail); std::printf("%c", 10); return 1;
}