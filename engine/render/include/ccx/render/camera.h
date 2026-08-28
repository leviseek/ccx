#pragma once
#include "ccx/foundation/math/mat4.h"
#include "ccx/foundation/math/vec2.h"

namespace ccx::render {

// 正交相机（M2 首帧视口变换前置：world -> screen）
struct OrthoCamera {
    float left = -1.0f;
    float right = 1.0f;
    float bottom = -1.0f;
    float top = 1.0f;

    // 世界视口尺寸（世界单位）
    float width() const { return right - left; }
    float height() const { return top - bottom; }

    // 世界点 -> 屏幕像素（viewportSize 为像素视口）
    Vec2 worldToScreen(Vec2 world, Vec2 viewportSize) const {
        const Mat4 proj = Mat4::orthographic(left, right, bottom, top);
        const Vec2 ndc = proj.transformPoint(world);
        return {(ndc.x + 1.0f) * 0.5f * viewportSize.x,
                (1.0f - ndc.y) * 0.5f * viewportSize.y};  // y 向下（屏幕约定）
    }
    Mat4 projection() const { return Mat4::orthographic(left, right, bottom, top); }
};

}  // namespace ccx::render
