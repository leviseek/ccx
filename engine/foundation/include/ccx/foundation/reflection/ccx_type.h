#pragma once
#include "ccx/foundation/reflection/type.h"

// 类型注册 DSL（engine-spec §5.1）。用法：
//
//   struct Health {
//       float max = 100.0f;
//       float current = 100.0f;
//   };
//   CCX_TYPE(Health,
//       (CCX_PROP(&Health::max,     "max",     { .rangeMin = 0, .rangeMax = 1000, .ui = "slider" })),
//       (CCX_PROP(&Health::current, "current", {})))
//
// 规则：
//  - 每个 CCX_PROP(...) 必须整体包一层括号：泛型宏（CCX_TYPE 的 __VA_ARGS__）
//    会在花括号内的逗号处错误切分参数，括号将其保护为单个参数。
//  - 类型必须默认可构造（聚合/POD）；成员类型推断为 TypeKind（kind_of 特化表）。
//  - 嵌套结构字段（推断为 Object）要求该嵌套类型在本 TU 中先于使用处注册。
//  - 注册发生在静态初始化期（幂等，跨 TU 重复仅首次生效）。

// CCX_PROP 为可变参：meta 花括号内的逗号会被预处理器切分，
// 由 __VA_ARGS__ 重拼接还原（这正是这个宏必须是变参的原因）。
#define CCX_PROP(member_ptr_, name_, ...)     ::ccx::detail::make_property(member_ptr_, name_, __VA_ARGS__)

#define CCX_TYPE(TypeName_, ...)                                                         namespace ccx {                                                                      template <>                                                                          inline const TypeInfo* type_info_of<TypeName_>() {                                       static const TypeInfo kInfo = detail::make_type_info<TypeName_>(                         #TypeName_, {__VA_ARGS__});                                                      return &kInfo;                                                                   }                                                                                    }                                                                                    [[maybe_unused]] static const bool kCcxRegistered_##TypeName_ =                          ccx::register_type<TypeName_>();
