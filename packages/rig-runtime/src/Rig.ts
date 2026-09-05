import { RigBone, RigBoneData } from './RigBone';
import { RigSlot } from './RigSlot';

export interface RigSlotData {
    id: string;
    boneId: string;
}

export interface RigDefinition {
    bones: RigBoneData[];
    slots?: RigSlotData[];
}

export class Rig {
    private readonly bones = new Map<string, RigBone>();
    private readonly slots = new Map<string, RigSlot>();

    constructor(definition: RigDefinition) {
        for (const data of definition.bones) {
            const parent = data.parentId ? this.bones.get(data.parentId) : null;
            if (data.parentId && !parent) {
                throw new Error(`Missing parent bone: ${data.parentId}`);
            }
            this.bones.set(data.id, new RigBone(data, parent));
        }

        for (const slotData of definition.slots ?? []) {
            if (!this.bones.has(slotData.boneId)) {
                throw new Error(`Missing slot bone: ${slotData.boneId}`);
            }
            this.slots.set(slotData.id, new RigSlot(slotData.id, slotData.boneId));
        }
    }

    getBone(id: string): RigBone {
        const bone = this.bones.get(id);
        if (!bone) throw new Error(`Unknown bone: ${id}`);
        return bone;
    }

    getSlot(id: string): RigSlot {
        const slot = this.slots.get(id);
        if (!slot) throw new Error(`Unknown slot: ${id}`);
        return slot;
    }

    updateWorldTransform(): void {
        for (const bone of this.bones.values()) {
            bone.updateWorldTransform();
        }
    }

    resetPose(definition: RigDefinition): void {
        for (const data of definition.bones) {
            const bone = this.getBone(data.id);
            bone.x = data.x;
            bone.y = data.y;
            bone.rotation = data.rotation;
            bone.scaleX = data.scaleX;
            bone.scaleY = data.scaleY;
        }
    }
}
