#pragma once
#include <array>
#include <cmath>

#include "ccx/foundation/math/vec2.h"

namespace ccx {

// 4x4 矩阵（列主序存储；正交/视口变换的最小集，M2 GPU 上传前无需通用数学）
struct Mat4 {
    std::array<float, 16> m{};  // column-major: m[col*4+row]

    static Mat4 identity() {
        Mat4 r;
        r.m = {1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1};
        return r;
    }
    // 正交投影：世界 -> NDC（OpenGL 惯例，z ∈ [-1,1]）
    static Mat4 orthographic(float left, float right, float bottom, float top,
                             float nearZ = -1.0f, float farZ = 1.0f) {
        Mat4 r;
        r.m[0] = 2.0f / (right - left);
        r.m[5] = 2.0f / (top - bottom);
        r.m[10] = -2.0f / (farZ - nearZ);
        r.m[12] = -(right + left) / (right - left);
        r.m[13] = -(top + bottom) / (top - bottom);
        r.m[14] = -(farZ + nearZ) / (farZ - nearZ);
        r.m[15] = 1.0f;
        return r;
    }
    Mat4 operator*(const Mat4& o) const {
        Mat4 r;
        for (int c = 0; c < 4; ++c) {
            for (int row = 0; row < 4; ++row) {
                float v = 0.0f;
                for (int k = 0; k < 4; ++k) v += m[k * 4 + row] * o.m[c * 4 + k];
                r.m[c * 4 + row] = v;
            }
        }
        return r;
    }
    // 变换齐次点 (x, y, 0, 1)
    Vec2 transformPoint(Vec2 p) const {
        const float x = m[0] * p.x + m[4] * p.y + m[8] * 0.0f + m[12];
        const float y = m[1] * p.x + m[5] * p.y + m[9] * 0.0f + m[13];
        const float w = m[3] * p.x + m[7] * p.y + m[11] * 0.0f + m[15];
        return {x / w, y / w};
    }
};

}  // namespace ccx
