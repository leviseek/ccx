import { Rig, applyAnimation } from '../src';

const rig = new Rig({
    bones: [
        { id: 'root', parentId: null, x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 10 },
        { id: 'arm', parentId: 'root', x: 10, y: 0, rotation: 0, scaleX: 1, scaleY: 1, length: 20 },
    ],
});

rig.getBone('root').rotation = 90;
rig.updateWorldTransform();

const arm = rig.getBone('arm');
console.assert(Math.abs(arm.worldX) < 0.0001);
console.assert(Math.abs(arm.worldY - 10) < 0.0001);

applyAnimation(rig, {
    name: 'arm-swing',
    duration: 1,
    loop: false,
    boneTimelines: [
        {
            boneId: 'arm',
            property: 'rotation',
            keys: [
                { time: 0, value: 0 },
                { time: 1, value: 90 },
            ],
        },
    ],
}, 0.5);

console.assert(Math.abs(arm.rotation - 45) < 0.0001);
