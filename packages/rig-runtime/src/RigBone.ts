import { Vec2 } from './math';

export interface RigBoneData {
    id: string;
    parentId: string | null;
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    length: number;
}

export class RigBone {
    public readonly id: string;
    public readonly parent: RigBone | null;
    public readonly children: RigBone[] = [];

    public x: number;
    public y: number;
    public rotation: number;
    public scaleX: number;
    public scaleY: number;
    public length: number;

    public worldX = 0;
    public worldY = 0;
    public worldRotation = 0;
    public worldScaleX = 1;
    public worldScaleY = 1;

    constructor(data: RigBoneData, parent: RigBone | null) {
        this.id = data.id;
        this.parent = parent;
        this.x = data.x;
        this.y = data.y;
        this.rotation = data.rotation;
        this.scaleX = data.scaleX;
        this.scaleY = data.scaleY;
        this.length = data.length;

        parent?.children.push(this);
    }

    updateWorldTransform(): void {
        if (!this.parent) {
            this.worldX = this.x;
            this.worldY = this.y;
            this.worldRotation = this.rotation;
            this.worldScaleX = this.scaleX;
            this.worldScaleY = this.scaleY;
            return;
        }

        const parent = this.parent;
        const rad = parent.worldRotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        this.worldX = parent.worldX + (this.x * cos - this.y * sin) * parent.worldScaleX;
        this.worldY = parent.worldY + (this.x * sin + this.y * cos) * parent.worldScaleY;
        this.worldRotation = parent.worldRotation + this.rotation;
        this.worldScaleX = parent.worldScaleX * this.scaleX;
        this.worldScaleY = parent.worldScaleY * this.scaleY;
    }

    getWorldPosition(): Vec2 {
        return { x: this.worldX, y: this.worldY };
    }
}
