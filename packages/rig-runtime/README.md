# CCX 2D Rig Runtime

A Cocos Creator 3.x-oriented 2D skeletal animation runtime inspired by the concepts of mature runtimes such as Spine, but implemented independently.

## Scope of v0.1

- Skeleton / Bone hierarchy
- Slot / Part attachment model
- Local and world transforms
- Basic timeline data model
- Runtime animation sampling
- No editor yet
- No binary format yet
- No IK yet

## Design rule

Runtime data is independent from Cocos `Node`. A renderer/adapter layer will bind runtime world transforms to Cocos nodes later.

## Next milestones

1. Bone + Slot + Attachment
2. Timeline + interpolation
3. AnimationState + TrackEntry + mixing
4. Two Bone IK
5. Expression / overlay animations
6. Cocos adapter
7. Editor extension
