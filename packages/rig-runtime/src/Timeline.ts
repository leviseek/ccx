import { lerp, normalizeAngle } from './math';
import { Rig } from './Rig';

export interface Keyframe {
    time: number;
    value: number;
}

export type TimelineProperty = 'x' | 'y' | 'rotation' | 'scaleX' | 'scaleY';

export interface BoneTimeline {
    boneId: string;
    property: TimelineProperty;
    keys: Keyframe[];
}

export interface RigAnimation {
    name: string;
    duration: number;
    loop: boolean;
    boneTimelines: BoneTimeline[];
}

function sample(keys: Keyframe[], time: number): number | null {
    if (keys.length === 0) return null;
    if (time <= keys[0].time) return keys[0].value;
    const last = keys[keys.length - 1];
    if (time >= last.time) return last.value;

    for (let i = 1; i < keys.length; i++) {
        const right = keys[i];
        const left = keys[i - 1];
        if (time <= right.time) {
            const span = right.time - left.time;
            const t = span <= 0 ? 0 : (time - left.time) / span;
            return lerp(left.value, right.value, t);
        }
    }

    return last.value;
}

export function applyAnimation(rig: Rig, animation: RigAnimation, time: number, alpha = 1): void {
    const duration = Math.max(animation.duration, 0.000001);
    const t = animation.loop ? ((time % duration) + duration) % duration : Math.max(0, Math.min(time, duration));

    for (const timeline of animation.boneTimelines) {
        const value = sample(timeline.keys, t);
        if (value === null) continue;

        const bone = rig.getBone(timeline.boneId);
        switch (timeline.property) {
            case 'x': bone.x = lerp(bone.x, value, alpha); break;
            case 'y': bone.y = lerp(bone.y, value, alpha); break;
            case 'rotation': bone.rotation = bone.rotation + normalizeAngle(value - bone.rotation) * alpha; break;
            case 'scaleX': bone.scaleX = lerp(bone.scaleX, value, alpha); break;
            case 'scaleY': bone.scaleY = lerp(bone.scaleY, value, alpha); break;
        }
    }
}
