import * as THREE from 'three'

const FINGER_PATTERN = /thumb|index|middle|ring|pinky|little|finger|digit/i

const fingerConfigs = [
  {
    key: 'thumb',
    label: 'Thumb',
    base: [-0.62, -0.2, 0.03],
    spread: 0.98,
    lengths: [0.42, 0.34, 0.24],
    radius: 0.085,
  },
  {
    key: 'index',
    label: 'Index',
    base: [-0.36, 0.82, 0.02],
    spread: 0.08,
    lengths: [0.55, 0.43, 0.32],
    radius: 0.078,
  },
  {
    key: 'middle',
    label: 'Middle',
    base: [-0.1, 0.9, 0.02],
    spread: 0.02,
    lengths: [0.63, 0.49, 0.36],
    radius: 0.083,
  },
  {
    key: 'ring',
    label: 'Ring',
    base: [0.17, 0.84, 0.02],
    spread: -0.06,
    lengths: [0.58, 0.45, 0.33],
    radius: 0.078,
  },
  {
    key: 'pinky',
    label: 'Pinky',
    base: [0.42, 0.7, 0.02],
    spread: -0.16,
    lengths: [0.45, 0.35, 0.26],
    radius: 0.067,
  },
]

const makeMaterial = (color, roughness = 0.75) =>
  new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: 0.02,
  })

function createSegment(length, radius, material, jointMaterial) {
  const segment = new THREE.Group()

  const capsule = new THREE.Mesh(
    new THREE.CapsuleGeometry(radius, length, 8, 18),
    material,
  )
  capsule.position.y = length / 2
  capsule.castShadow = true
  capsule.receiveShadow = true
  segment.add(capsule)

  const joint = new THREE.Mesh(
    new THREE.SphereGeometry(radius * 1.08, 18, 12),
    jointMaterial,
  )
  joint.castShadow = true
  segment.add(joint)

  return segment
}

function rememberRestPose(bone) {
  bone.userData.restRotation = bone.rotation.clone()
  bone.userData.restQuaternion = bone.quaternion.clone()
}

function isControlNode(node) {
  return node.isBone || node.userData?.signControl
}

export function createDemoHandRig() {
  const model = new THREE.Group()
  model.name = 'DemoHandModel'

  const skinMaterial = makeMaterial(0xf0a987)
  const jointMaterial = makeMaterial(0xdc7f60, 0.65)
  const palmMaterial = makeMaterial(0xe79b79)

  const wrist = new THREE.Bone()
  wrist.name = 'wrist_root'
  wrist.position.set(0, -0.88, 0)
  wrist.userData.isDemoRigRoot = true
  model.add(wrist)

  const palm = new THREE.Mesh(new THREE.BoxGeometry(1.22, 1.62, 0.3), palmMaterial)
  palm.name = 'palm_mesh'
  palm.position.set(0, 0.78, 0)
  palm.castShadow = true
  palm.receiveShadow = true
  wrist.add(palm)

  const wristCap = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.24, 0.3, 8, 22),
    palmMaterial,
  )
  wristCap.name = 'wrist_mesh'
  wristCap.position.set(0, -0.06, 0)
  wristCap.rotation.z = Math.PI / 2
  wristCap.castShadow = true
  wrist.add(wristCap)

  for (const finger of fingerConfigs) {
    let parent = wrist

    finger.lengths.forEach((length, index) => {
      const bone = new THREE.Bone()
      bone.name = `${finger.key}_${String(index + 1).padStart(2, '0')}`
      bone.userData.finger = finger.key
      bone.userData.fingerLabel = finger.label
      bone.userData.segment = index + 1

      if (index === 0) {
        bone.position.set(...finger.base)
        bone.rotation.z = finger.spread
        bone.rotation.x = finger.key === 'thumb' ? -0.32 : 0
      } else {
        bone.position.y = finger.lengths[index - 1]
      }

      parent.add(bone)
      bone.add(createSegment(length, finger.radius, skinMaterial, jointMaterial))
      rememberRestPose(bone)
      parent = bone
    })
  }

  rememberRestPose(wrist)
  model.traverse((node) => {
    if (node.isMesh) {
      node.frustumCulled = false
    }
  })

  return model
}

export function cacheRestPose(root) {
  root.traverse((node) => {
    if (isControlNode(node) && !node.userData.restQuaternion) {
      rememberRestPose(node)
    }
  })
}

export function restoreRestPose(root) {
  root.traverse((node) => {
    if (isControlNode(node) && node.userData.restQuaternion) {
      node.quaternion.copy(node.userData.restQuaternion)
    }
  })
}

export function findFingerBones(root) {
  const allBones = []
  const fingerBones = []

  root.traverse((node) => {
    if (!node.isBone) return

    allBones.push(node)
    if (FINGER_PATTERN.test(node.name)) {
      fingerBones.push(node)
    }
  })

  return {
    allBones,
    fingerBones: fingerBones.length > 0 ? fingerBones : allBones,
    usedFallback: fingerBones.length === 0,
  }
}

export function collectBoneChain(startBone) {
  const chain = [startBone]
  let current = startBone

  while (chain.length < 4) {
    const nextBone = current.children.find((child) => isControlNode(child))
    if (!nextBone) break

    chain.push(nextBone)
    current = nextBone
  }

  return chain
}

export function applyBoneCurl(bone, radians, axis = 'x') {
  if (!bone.userData.restQuaternion) {
    rememberRestPose(bone)
  }

  applyBoneOffset(bone, { [axis]: radians })
}

export function applyBoneOffset(bone, offset = {}) {
  if (!bone.userData.restQuaternion) {
    rememberRestPose(bone)
  }

  const restEuler = new THREE.Euler().setFromQuaternion(
    bone.userData.restQuaternion,
    bone.rotation.order,
  )
  restEuler.x += offset.x || 0
  restEuler.y += offset.y || 0
  restEuler.z += offset.z || 0
  bone.rotation.copy(restEuler)
}

export function makeTargetQuaternion(bone, offset = {}) {
  if (!bone.userData.restQuaternion) {
    rememberRestPose(bone)
  }

  const euler = new THREE.Euler().setFromQuaternion(
    bone.userData.restQuaternion,
    bone.rotation.order,
  )
  euler.x += offset.x || 0
  euler.y += offset.y || 0
  euler.z += offset.z || 0

  return new THREE.Quaternion().setFromEuler(euler)
}
