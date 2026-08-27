// RenderGraph 编译器测试（renderer-spec §3：校验规则 + 执行序 + transient 生命周期）
#include <cstdio>
#include <string>
#include <vector>

#include "ccx/render/render_graph.h"

using namespace ccx::render;

namespace {
int g_failures = 0;
void check(bool ok, const char* what) {
    if (!ok) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}
}  // namespace

int main() {
    {
        // 1) 合法链：depth -> shadow -> opaque -> ui，执行序符合添加序+after
        RenderGraph g;
        g.declareResource("shadowmap", ResourceKind::Transient);
        g.declareResource("hdr", ResourceKind::Transient);
        g.declareResource("backbuffer", ResourceKind::External);
        g.addPass({"depth", {}, {"shadowmap"}, {}});
        g.addPass({"opaque", {"shadowmap"}, {"hdr"}, {"depth"}});
        g.addPass({"ui", {"hdr"}, {"backbuffer"}, {"opaque"}});
        const auto r = g.compile();
        check(r.ok, "合法图编译通过");
        check(r.error.empty(), "无错误消息");
        check(r.executionOrder.size() == 3, "3 个 pass 执行");
        check(r.executionOrder[0] == "depth" && r.executionOrder[2] == "ui",
              "执行序 depth < ... < ui");
        // transient 生命周期：shadowmap 由 depth 写、被 opaque 最后读
        check(r.lifecycles[0].name == "shadowmap" &&
                  r.lifecycles[0].firstWrittenBy == "depth" &&
                  r.lifecycles[0].lastReadBy == "opaque",
              "shadowmap 生命周期正确");
    }
    {
        // 2) 未声明资源
        RenderGraph g;
        g.addPass({"p", {"ghost"}, {}, {}});
        const auto r = g.compile();
        check(!r.ok, "未声明资源被拒");
        check(r.error.find("未声明资源") != std::string::npos, "错误信息明确");
    }
    {
        // 3) transient 读写顺序：按添加序判定（写者在前合法；读者在前需显式 after）
        RenderGraph g2;
        g2.declareResource("hdr", ResourceKind::Transient);
        g2.addPass({"writer", {}, {"hdr"}, {}});
        g2.addPass({"reader", {"hdr"}, {}, {}});
        const auto r2 = g2.compile();
        check(r2.ok, "写者在前（添加序）合法");
        // 读者在前 -> 拒绝
        RenderGraph g3;
        g3.declareResource("hdr", ResourceKind::Transient);
        g3.addPass({"reader", {"hdr"}, {}, {}});
        g3.addPass({"writer", {}, {"hdr"}, {}});
        const auto r3 = g3.compile();
        check(!r3.ok, "读者在写者前被拒");
        check(r3.error.find("after") != std::string::npos, "提示用 after 显式排序");
        // 读者在前 + 显式 after -> 合法（after 覆盖添加序）
        RenderGraph g4;
        g4.declareResource("hdr", ResourceKind::Transient);
        g4.addPass({"reader", {"hdr"}, {}, {"writer"}});
        g4.addPass({"writer", {}, {"hdr"}, {}});
        const auto r4 = g4.compile();
        check(r4.ok, "显式 after 后合法");
        check(r4.executionOrder[0] == "writer" && r4.executionOrder[1] == "reader",
              "after 约束生效");
    }
    {
        // 4) 写-写冲突
        RenderGraph g;
        g.declareResource("hdr", ResourceKind::Transient);
        g.addPass({"a", {}, {"hdr"}, {}});
        g.addPass({"b", {}, {"hdr"}, {}});
        check(!g.compile().ok, "双写无约束被拒");
        RenderGraph g2;
        g2.declareResource("hdr", ResourceKind::Transient);
        g2.addPass({"a", {}, {"hdr"}, {}});
        g2.addPass({"b", {}, {"hdr"}, {"a"}});
        check(g2.compile().ok, "双写 + after 合法");
    }
    {
        // 5) pass 环
        RenderGraph g;
        g.declareResource("x", ResourceKind::External);
        g.addPass({"a", {}, {"x"}, {"b"}});
        g.addPass({"b", {}, {"x"}, {"a"}});
        const auto r = g.compile();
        check(!r.ok, "pass 环被拒");
        check(r.error.find("环") != std::string::npos, "环错误消息明确");
    }
    {
        // 6) 永远没被写过的 transient 读取
        RenderGraph g;
        g.declareResource("ghost", ResourceKind::Transient);
        g.addPass({"reader", {"ghost"}, {}, {}});
        check(!g.compile().ok, "未被写入的 transient 读取被拒");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (render graph)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
