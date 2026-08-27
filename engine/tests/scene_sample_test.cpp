// M0 出口①：场景 JSON 读写 + golden 文件校验（ADR-003 v1 格式）
// 场景文件 examples/scenes/sample.scene.json 是样例真相；本测试：
//  1) 解析校验结构（schema/meta/entities/systems）
//  2) 反射 toJson 重建组件数据并与 golden 语义等价
//  3) fromJson 反读回组件并断言值（读写闭环）
#include <cstdio>
#include <string>

#include "ccx/foundation/reflection/ccx_type.h"
#include "ccx/foundation/reflection/type.h"
#include "ccx/foundation/serialization/json.h"
#include "ccx/foundation/serialization/serializer.h"

using namespace ccx;

struct Position {
    float x = 0.0f;
    float y = 0.0f;
};
CCX_TYPE(Position,
    (CCX_PROP(&Position::x, "x", {})),
    (CCX_PROP(&Position::y, "y", {})))

struct Health {
    float max = 100.0f;
    float current = 100.0f;
};
CCX_TYPE(Health,
    (CCX_PROP(&Health::max, "max", {})),
    (CCX_PROP(&Health::current, "current", {})))

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
    // 1) 读取场景文件（仓库根目录执行）
    const char* path = "examples/scenes/sample.scene.json";
    FILE* f = std::fopen(path, "rb");
    check(f != nullptr, "场景文件可读");
    if (!f) {
        std::printf("1 FAILURE(S)\n");
        return 1;
    }
    std::string text;
    char buf[4096];
    size_t n;
    while ((n = std::fread(buf, 1, sizeof buf, f)) > 0) text.append(buf, n);
    std::fclose(f);

    const json::Value scene = json::parse(text);
    check(scene.kind() == json::Kind::Object, "场景解析为对象");
    const json::Value* schema = scene.find("schema");
    check(schema != nullptr && schema->kind() == json::Kind::String &&
              schema->asString() == "ccx.scene/1",
          "schema = ccx.scene/1");
    const json::Value* meta = scene.find("meta");
    check(meta != nullptr && meta->kind() == json::Kind::Object, "meta 存在");
    const json::Value* entities = scene.find("entities");
    check(entities != nullptr && entities->kind() == json::Kind::Array &&
              entities->asArray().size() == 2,
          "entities = 2");
    const json::Value* systems = scene.find("systems");
    check(systems != nullptr && systems->kind() == json::Kind::Array,
          "systems 存在");

    // 2) 读取 player 的组件：反射 toJson 重建并与 golden 语义等价
    const json::Value& player = entities->asArray()[0];
    const json::Value* name = player.find("name");
    check(name != nullptr && name->asString() == "player", "player 名正确");
    const json::Value* components = player.find("components");
    check(components != nullptr && components->kind() == json::Kind::Array &&
              components->asArray().size() == 2,
          "player 组件数 = 2");
    const json::Value& comp0 = components->asArray()[0];
    const json::Value& comp1 = components->asArray()[1];
    check(comp0.find("type")->asString() == "ccx.Position", "组件0 类型 Position");
    check(comp1.find("type")->asString() == "game.Health", "组件1 类型 Health");

    // 反射重建 Position/Health 的 data，与 golden data 语义等价
    Position pos{10.5f, -3.25f};
    const json::Value posJson = serialization::toJson(*type_info_of<Position>(), &pos);
    const json::Value* posData = comp0.find("data");
    check(*posData == posJson, "Position data 与反射重建等价（数组 [x,y] 语义）");

    // 3) fromJson 反读回组件（读写闭环）
    Position posBack{};
    check(serialization::fromJson(*type_info_of<Position>(), *posData, &posBack),
          "Position fromJson 成功");
    check(posBack.x == 10.5f && posBack.y == -3.25f, "Position 值反读一致");
    Health hpBack{};
    check(serialization::fromJson(*type_info_of<Health>(),
                                  *comp1.find("data"), &hpBack),
          "Health fromJson 成功");
    check(hpBack.max == 100.0f && hpBack.current == 77.0f, "Health 值反读一致");

    // 4) 文本稳定性：dump(parse(x)) 幂等（二进制 .cscene 由同类 schema 驱动，M1）
    const json::Value reparsed = json::parse(json::dump(scene));
    check(reparsed == scene, "dump-parse 幂等（语义等价）");

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (scene sample golden)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
