// 音频播放事件测试（队列顺序/音量钳制/主音量/清空）
#include <cstdio>

#include "ccx/audio/audio_bus.h"

using namespace ccx::audio;

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
        // 1) 顺序消费
        AudioBus bus;
        bus.enqueue({1, 0.5f, false, 0.0f});
        bus.enqueue({2, 0.9f, true, -1.0f});
        check(bus.pendingCount() == 2, "两条待播");
        const PlayEvent a = bus.poll();
        check(a.clipId == 1 && a.volume == 0.5f && !a.loop, "第一事件字段");
        const PlayEvent b = bus.poll();
        check(b.clipId == 2 && b.loop && b.pan == -1.0f, "第二事件字段");
        check(!bus.hasPending(), "已清空");
        const PlayEvent empty = bus.poll();
        check(empty.clipId == 0, "空事件");
    }
    {
        // 2) 音量钳制
        AudioBus bus;
        bus.enqueue({7, 2.5f, false, 0.0f});
        check(bus.poll().volume == 1.0f, "超 1 钳制");
        bus.setMasterVolume(2.0f);
        check(bus.masterVolume() == 1.0f, "主音量钳制");
        bus.setMasterVolume(-1.0f);
        check(bus.masterVolume() == 0.0f, "负音量钳制 0");
    }
    {
        // 3) clear
        AudioBus bus;
        bus.enqueue({1, 0.5f, false, 0});
        bus.enqueue({2, 0.5f, false, 0});
        bus.clear();
        check(!bus.hasPending() && bus.pendingCount() == 0, "清空");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (audio)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
