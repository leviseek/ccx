// metrics 测试（环缓冲 + JSON 快照）
#include <cstdio>

#include "ccx/foundation/metrics.h"

using namespace ccx::metrics;

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
        FrameMetrics m;
        for (uint32_t i = 1; i <= 3; ++i) {
            m.recordFrame({i, 16.5f, 100 * i, 4 * i, 8 * i, 1024 * i});
        }
        check(m.size() == 3, "3 帧已填");
        check(m.last() != nullptr && m.last()->frame == 3, "last 指向最新帧");
        check(m.last()->batches == 12 && m.last()->allocBytes == 3072, "last 数据正确");
        const auto snap = m.snapshotJson(10);
        check(snap.kind() == ccx::json::Kind::Array && snap.asArray().size() == 3,
              "快照只含实际帧数");
        const auto& f0 = snap.asArray()[0];
        check(f0.find("frame")->asNumber() == 1.0 &&
                  f0.find("entities")->asNumber() == 100.0,
              "快照字段齐全");
    }
    {
        // 环形覆盖：300 帧 -> 只保留 128
        FrameMetrics m;
        for (uint32_t i = 1; i <= 300; ++i) {
            m.recordFrame({i, 1.0f, 0, 0, 0, 0});
        }
        check(m.size() == 128, "环形容量 128");
        check(m.frameCount() == 300, "总帧数累计");
        check(m.last()->frame == 300, "覆盖后 last 为新帧");
        const auto snap = m.snapshotJson(128);
        check(snap.asArray().front().find("frame")->asNumber() == 173.0,
              "snapshotJson 按时间序（173..300）");
        check(snap.asArray().back().find("frame")->asNumber() == 300.0,
              "末尾为最新");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (metrics)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
