// 资产注册表测试（句柄复用/失效/负载状态/池满）
#include <cstdio>

#include "ccx/assets/registry.h"

using namespace ccx::assets;

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
        // 1) 创建/查询/负载状态
        AssetRegistry reg(16);
        const AssetHandle t = reg.create(AssetType::Texture, 7, 1024);
        check(t.index < 16, "句柄有效");
        const AssetEntry* e = reg.lookup(t);
        check(e != nullptr && e->type == AssetType::Texture && e->assetId == 7, "条目正确");
        check(!e->loaded, "初始未加载");
        reg.markLoaded(t);
        check(reg.lookup(t)->loaded, "加载标记");
        check(reg.count() == 1, "计数 1");
    }
    {
        // 2) 销毁 -> 旧句柄失效 + 槽位版本递增
        AssetRegistry reg(16);
        const AssetHandle a = reg.create(AssetType::Sprite, 1, 64);
        reg.destroy(a);
        check(reg.lookup(a) == nullptr, "销毁后旧句柄失效");
        check(reg.count() == 0, "计数归零");
        reg.destroy(a);  // 幂等
        const AssetHandle b = reg.create(AssetType::Sprite, 2, 64);
        check(b.index == a.index, "槽位复用");
        check(b.version > a.version, "版本递增（句柄不同）");
        check(reg.lookup(a) == nullptr, "旧句柄在新条目上仍无效");
        check(reg.lookup(b) != nullptr, "新句柄有效");
    }
    {
        // 3) 池满拒绝新句柄
        AssetRegistry reg(2);
        const AssetHandle a = reg.create(AssetType::Shader, 1, 1);
        const AssetHandle b = reg.create(AssetType::Shader, 2, 1);
        const AssetHandle c = reg.create(AssetType::Shader, 3, 1);
        check(a.index < 2 && b.index < 2, "两个槽位");
        check(c.index >= 2 || c == AssetHandle{}, "池满拒绝（空句柄）");
        check(reg.count() == 2, "计数 2");
    }
    {
        // 4) 快捷：lookupOrNull
        AssetRegistry reg(4);
        const AssetHandle h = reg.create(AssetType::Audio, 9, 32);
        check(reg.lookupOrNull(h) != nullptr, "lookupOrNull 命中");
        reg.destroy(h);
        check(reg.lookupOrNull(h) == nullptr, "lookupOrNull 失效");
    }

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (asset registry)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
