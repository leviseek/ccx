// 灯塔任务 A：Reflector + 序列化 round-trip(M0 出口 ①/②)
// engine-spec §5（反射 DSL）/§6（JSON 双格式）、ADR-003

#include <cmath>
#include <cstdio>
#include <string>

#include "ccx/foundation/math/color.h"
#include "ccx/foundation/math/vec2.h"
#include "ccx/foundation/reflection/ccx_type.h"
#include "ccx/foundation/reflection/type.h"
#include "ccx/foundation/serialization/json.h"
#include "ccx/foundation/serialization/serializer.h"

namespace {

int g_failures = 0;

void check(bool cond, const char* what) {
    if (!cond) {
        std::printf("FAIL: %s\n", what);
        ++g_failures;
    }
}

bool near(float a, float b) { return std::fabs(a - b) < 1e-5f; }

}  // namespace

using ccx::Color;
using ccx::Vec2;

// —— 测试类型（组件 DSL，engine-spec §5.1）——
struct Health {
    float max = 100.0f;
    float current = 100.0f;
};
CCX_TYPE(Health,
    (CCX_PROP(&Health::max, "max", { .rangeMin = 0.0f, .rangeMax = 1000.0f, .ui = "slider" })),
    (CCX_PROP(&Health::current, "current", {})))

struct SpriteRef {
    std::string sprite;
    std::string material;
};
CCX_TYPE(SpriteRef,
    (CCX_PROP(&SpriteRef::sprite, "sprite", { .assetType = "ccx.Sprite" })),
    (CCX_PROP(&SpriteRef::material, "material", { .assetType = "ccx.Material" })))

struct PlayerEntity {
    std::string name = "player";
    Vec2 position{0.0f, 1.2f};
    Color tint{1.0f, 1.0f, 1.0f, 1.0f};
    Health health;
    SpriteRef spriteRef;
    bool enabled = true;
    int level = 3;
    unsigned kills = 0;
};
CCX_TYPE(PlayerEntity,
    (CCX_PROP(&PlayerEntity::name, "name", {})),
    (CCX_PROP(&PlayerEntity::position, "position", {})),
    (CCX_PROP(&PlayerEntity::tint, "tint", { .ui = "color" })),
    (CCX_PROP(&PlayerEntity::health, "health", {})),
    (CCX_PROP(&PlayerEntity::spriteRef, "spriteRef", {})),
    (CCX_PROP(&PlayerEntity::enabled, "enabled", {})),
    (CCX_PROP(&PlayerEntity::level, "level", {})),
    (CCX_PROP(&PlayerEntity::kills, "kills", {})))

int main() {
    using namespace ccx;

    // 1. 注册与类型字典
    const TypeInfo* healthTi = TypeRegistry::instance().find("Health");
    check(healthTi != nullptr, "Health 已注册");
    check(TypeRegistry::instance().count() >= 3, "注册表 >= 3 个类型");
    check(healthTi != nullptr && healthTi->id == detail::fnv1a_64("Health"),
          "TypeId = FNV-1a(name) 稳定");

    // 2. toJson（含嵌套对象 / Vec2 / Color / 字符串 / 标量）
    PlayerEntity p;
    p.name = "player_1";
    p.position = Vec2{10.5f, -3.25f};
    p.tint = Color{0.2f, 0.4f, 0.6f, 1.0f};
    p.health.max = 120.0f;
    p.health.current = 77.0f;
    p.spriteRef.sprite = "uuid:img-001:0";
    p.spriteRef.material = "uuid:mat-002";
    p.enabled = false;
    p.level = 7;
    p.kills = 42;

    const TypeInfo* playerTi = type_info_of<PlayerEntity>();
    const json::Value pj = serialization::toJson(*playerTi, &p);
    const std::string compact = json::dump(pj);
    const std::string pretty = json::dumpPretty(pj);
    check(!compact.empty() && !pretty.empty(), "JSON 输出非空");

    // 3. 文本往返：dump -> parse -> 结构完整
    const json::Value reparsed = json::parse(pretty);
    check(reparsed.kind() == json::Kind::Object, "重新解析为 Object");
    check(reparsed.find("position") != nullptr && reparsed.find("health") != nullptr &&
              reparsed.find("spriteRef") != nullptr,
          "关键字段存在");

    // 4. 语义往返:toJson -> parse -> fromJson -> 字段等价
    PlayerEntity q{};
    check(serialization::fromJson(*playerTi, reparsed, &q), "fromJson 成功");
    check(q.name == "player_1", "name 往返一致");
    check(near(q.position.x, 10.5f) && near(q.position.y, -3.25f), "position 往返一致");
    check(near(q.tint.r, 0.2f) && near(q.tint.b, 0.6f), "tint 往返一致");
    check(q.health.max == 120.0f && q.health.current == 77.0f, "health 嵌套往返一致");
    check(q.spriteRef.material == "uuid:mat-002", "spriteRef 引用串往返一致");
    check(!q.enabled && q.level == 7 && q.kills == 42u, "bool/int/uint 往返一致");

    // 5. 幂等性：dump(parse(dump(x))) == dump(x)
    const std::string reDump = json::dump(json::parse(compact));
    check(reDump == compact, "紧凑 dump 幂等");

    // 6. JSON Schema 输出（Inspector / MCP 同源；嵌套对象在父 schema 中标 object，
    //   元数据在各自类型的 schema 中 —— 与 TypeRegistry 查询配套使用）
    const std::string schema = serialization::jsonSchema(*playerTi);
    check(schema.find("\"ui\": \"color\"") != std::string::npos, "player schema 含 tint.ui=color");
    const std::string healthSchema = serialization::jsonSchema(*healthTi);
    check(healthSchema.find("slider") != std::string::npos, "health schema 含 ui=slider");
    check(healthSchema.find("\"minimum\"") != std::string::npos, "health schema 含 range minimum");
    const TypeInfo* spriteTi = TypeRegistry::instance().find("SpriteRef");
    check(spriteTi != nullptr &&
              serialization::jsonSchema(*spriteTi).find("ccx.Material") != std::string::npos,
          "sprite schema 含 assetType");

    // 7. 默认值对象往返（缺字段容错：fromJson 跳过）
    PlayerEntity def;
    PlayerEntity def2{};
    const json::Value dj = serialization::toJson(*playerTi, &def);
    check(serialization::fromJson(*playerTi, dj, &def2), "默认值 fromJson 成功");
    check(def2.name == "player" && def2.level == 3, "默认值往返一致");

    std::printf("pretty JSON:\n%s\n", pretty.c_str());
    std::printf("schema:\n%s\n", schema.c_str());

    if (g_failures == 0) {
        std::printf("ALL TESTS PASSED (foundation roundtrip)\n");
        return 0;
    }
    std::printf("%d FAILURE(S)\n", g_failures);
    return 1;
}
