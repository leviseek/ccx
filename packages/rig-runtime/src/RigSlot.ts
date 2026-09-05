export interface RigAttachment {
    id: string;
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
    width: number;
    height: number;
}

export class RigSlot {
    public attachment: RigAttachment | null = null;
    public color = 0xffffffff;
    public visible = true;

    constructor(
        public readonly id: string,
        public readonly boneId: string,
    ) {}
}
