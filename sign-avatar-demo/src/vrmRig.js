import * as THREE from 'three'
import { VRMHumanBoneName, VRMUtils } from '@pixiv/three-vrm'

const VRM_SIGN_BONES = [
  [VRMHumanBoneName.Spine, 'spine', 'body'],
  [VRMHumanBoneName.Chest, 'chest', 'body'],
  [VRMHumanBoneName.UpperChest, 'upper_chest', 'body'],
  [VRMHumanBoneName.Neck, 'neck', 'body'],
  [VRMHumanBoneName.Head, 'head', 'body', 'x'],
  [VRMHumanBoneName.LeftShoulder, 'left_shoulder', 'arms', 'z'],
  [VRMHumanBoneName.LeftUpperArm, 'left_arm', 'arms', 'z'],
  [VRMHumanBoneName.LeftLowerArm, 'left_forearm', 'arms', 'z'],
  [VRMHumanBoneName.LeftHand, 'left_hand', 'hands', 'z'],
  [VRMHumanBoneName.RightShoulder, 'right_shoulder', 'arms', 'z'],
  [VRMHumanBoneName.RightUpperArm, 'right_arm', 'arms', 'z'],
  [VRMHumanBoneName.RightLowerArm, 'right_forearm', 'arms', 'z'],
  [VRMHumanBoneName.RightHand, 'right_hand', 'hands', 'z'],
  [VRMHumanBoneName.LeftThumbMetacarpal, 'left_thumb_01', 'fingers'],
  [VRMHumanBoneName.LeftThumbProximal, 'left_thumb_02', 'fingers'],
  [VRMHumanBoneName.LeftThumbDistal, 'left_thumb_03', 'fingers'],
  [VRMHumanBoneName.LeftIndexProximal, 'left_index_01', 'fingers'],
  [VRMHumanBoneName.LeftIndexIntermediate, 'left_index_02', 'fingers'],
  [VRMHumanBoneName.LeftIndexDistal, 'left_index_03', 'fingers'],
  [VRMHumanBoneName.LeftMiddleProximal, 'left_middle_01', 'fingers'],
  [VRMHumanBoneName.LeftMiddleIntermediate, 'left_middle_02', 'fingers'],
  [VRMHumanBoneName.LeftMiddleDistal, 'left_middle_03', 'fingers'],
  [VRMHumanBoneName.LeftRingProximal, 'left_ring_01', 'fingers'],
  [VRMHumanBoneName.LeftRingIntermediate, 'left_ring_02', 'fingers'],
  [VRMHumanBoneName.LeftRingDistal, 'left_ring_03', 'fingers'],
  [VRMHumanBoneName.LeftLittleProximal, 'left_pinky_01', 'fingers'],
  [VRMHumanBoneName.LeftLittleIntermediate, 'left_pinky_02', 'fingers'],
  [VRMHumanBoneName.LeftLittleDistal, 'left_pinky_03', 'fingers'],
  [VRMHumanBoneName.RightThumbMetacarpal, 'right_thumb_01', 'fingers'],
  [VRMHumanBoneName.RightThumbProximal, 'right_thumb_02', 'fingers'],
  [VRMHumanBoneName.RightThumbDistal, 'right_thumb_03', 'fingers'],
  [VRMHumanBoneName.RightIndexProximal, 'right_index_01', 'fingers'],
  [VRMHumanBoneName.RightIndexIntermediate, 'right_index_02', 'fingers'],
  [VRMHumanBoneName.RightIndexDistal, 'right_index_03', 'fingers'],
  [VRMHumanBoneName.RightMiddleProximal, 'right_middle_01', 'fingers'],
  [VRMHumanBoneName.RightMiddleIntermediate, 'right_middle_02', 'fingers'],
  [VRMHumanBoneName.RightMiddleDistal, 'right_middle_03', 'fingers'],
  [VRMHumanBoneName.RightRingProximal, 'right_ring_01', 'fingers'],
  [VRMHumanBoneName.RightRingIntermediate, 'right_ring_02', 'fingers'],
  [VRMHumanBoneName.RightRingDistal, 'right_ring_03', 'fingers'],
  [VRMHumanBoneName.RightLittleProximal, 'right_pinky_01', 'fingers'],
  [VRMHumanBoneName.RightLittleIntermediate, 'right_pinky_02', 'fingers'],
  [VRMHumanBoneName.RightLittleDistal, 'right_pinky_03', 'fingers'],
]

const PREFERRED_VRM_EXPRESSIONS = [
  'neutral',
  'happy',
  'relaxed',
  'sad',
  'angry',
  'surprised',
  'aa',
  'ih',
  'ou',
  'ee',
  'oh',
  'blink',
  'blinkLeft',
  'blinkRight',
]

const SIGNING_READY_OFFSETS = {
  chest: { x: 0.04 },
  neck: { x: -0.04 },
  head: { x: 0.03 },
  left_shoulder: { z: -0.08 },
  left_arm: { z: -0.85, y: -1.15 },
  left_forearm: { z: 1.45, y: -0.1 },
  left_hand: { z: 0, y: 0 },
  right_shoulder: { z: 0.08 },
  right_arm: { z: 0.85, y: 1.15 },
  right_forearm: { z: -1.45, y: 0.1 },
  right_hand: { z: 0, y: 0 },
}

export function prepareVrmForSignLab(vrm) {
  VRMUtils.rotateVRM0(vrm)
  annotateVrmHumanoid(vrm)
  applyVrmSigningReadyPose(vrm)
  attachVrmFaceControls(vrm)

  vrm.scene.userData.vrm = vrm
  vrm.scene.userData.disableMorphTargetFaceScan = true
  vrm.scene.traverse((node) => {
    if (!node.isMesh) return
    node.castShadow = true
    node.receiveShadow = true
    node.frustumCulled = false
  })

  return vrm.scene
}

function applyVrmSigningReadyPose(vrm) {
  const nodesByAlias = new Map()

  vrm.scene.traverse((node) => {
    if (node.userData?.signControl) {
      nodesByAlias.set(node.name, node)
    }
  })

  Object.entries(SIGNING_READY_OFFSETS).forEach(([alias, offset]) => {
    const node = nodesByAlias.get(alias)
    if (!node) return

    const euler = new THREE.Euler().setFromQuaternion(node.quaternion, node.rotation.order)
    euler.x += offset.x || 0
    euler.y += offset.y || 0
    euler.z += offset.z || 0
    node.quaternion.setFromEuler(euler)
  })

  vrm.humanoid.update()
  vrm.update(0)
  vrm.scene.userData.signingReadyPose = 'vrm-default-front-chest-v5'
}

function annotateVrmHumanoid(vrm) {
  let mapped = 0

  for (const [humanBoneName, alias, signPart, preferredAxis] of VRM_SIGN_BONES) {
    const node = vrm.humanoid.getNormalizedBoneNode(humanBoneName)
    if (!node) continue

    node.userData.originalName = node.name
    node.userData.vrmHumanBoneName = humanBoneName
    node.userData.signControl = true
    node.userData.signPart = signPart
    node.userData.signLabel = alias
    if (preferredAxis) {
      node.userData.preferredAxis = preferredAxis
    }

    node.name = alias
    mapped += 1
  }

  vrm.scene.userData.vrmMappedControlCount = mapped
}

function attachVrmFaceControls(vrm) {
  const manager = vrm.expressionManager
  if (!manager?.expressionMap) return

  const available = new Set(Object.keys(manager.expressionMap))
  const controls = PREFERRED_VRM_EXPRESSIONS
    .filter((name) => available.has(name))
    .map((name) => ({
      id: `vrm-expression:${name}`,
      name,
      apply(value) {
        manager.setValue(name, value)
        manager.update()
      },
    }))

  if (controls.length > 0) {
    vrm.scene.userData.faceControls = controls
  }
}
