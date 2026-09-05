export interface Vec2 {
    x: number;
    y: number;
}

export function degToRad(value: number): number {
    return value * Math.PI / 180;
}

export function radToDeg(value: number): number {
    return value * 180 / Math.PI;
}

export function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

export function lerpVec2(a: Vec2, b: Vec2, t: number): Vec2 {
    return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

export function normalizeAngle(value: number): number {
    let result = value % 360;
    if (result > 180) result -= 360;
    if (result < -180) result += 360;
    return result;
}
