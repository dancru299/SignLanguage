import * as THREE from 'three'

const skinMaterial = new THREE.MeshStandardMaterial({
  color: 0xe0a084,
  roughness: 0.72,
  metalness: 0.02,
})

const jointMaterial = new THREE.MeshStandardMaterial({
  color: 0xf0c34f,
  roughness: 0.66,
  metalness: 0.02,
})

const shirtMaterial = new THREE.MeshStandardMaterial({
  color: 0x25413f,
  roughness: 0.78,
  metalness: 0.02,
})

const accentMaterial = new THREE.MeshStandardMaterial({
  color: 0x19a88a,
  roughness: 0.62,
  metalness: 0.02,
})

const guideMaterial = new THREE.MeshBasicMaterial({
  color: 0x19a88a,
  transparent: true,
  opacity: 0.08,
  depthWrite: false,
  side: THREE.DoubleSide,
})

const guideLineMaterial = new THREE.LineBasicMaterial({
  color: 0x16846f,
  transparent: true,
  opacity: 0.32,
})

const darkMaterial = new THREE.MeshStandardMaterial({
  color: 0x171d1b,
  roughness: 0.7,
  metalness: 0.02,
})

const mouthMaterial = new THREE.MeshStandardMaterial({
  color: 0x521b28,
  roughness: 0.7,
  metalness: 0.02,
})

const fingerConfigs = [
  {
    key: 'thumb',
    x: -0.17,
    y: 0.06,
    z: 0.045,
    spread: 0.58,
    lengths: [0.17, 0.14, 0.11],
    radius: 0.034,
  },
  {
    key: 'index',
    x: -0.105,
    y: 0.24,
    z: 0.02,
    spread: 0.12,
    lengths: [0.22, 0.18, 0.14],
    radius: 0.032,
  },
  {
    key: 'middle',
    x: -0.035,
    y: 0.255,
    z: 0.02,
    spread: 0.03,
    lengths: [0.24, 0.195, 0.15],
    radius: 0.034,
  },
  {
    key: 'ring',
    x: 0.04,
    y: 0.24,
    z: 0.02,
    spread: -0.08,
    lengths: [0.215, 0.18, 0.14],
    radius: 0.031,
  },
  {
    key: 'pinky',
    x: 0.108,
    y: 0.22,
    z: 0.02,
    spread: -0.2,
    lengths: [0.18, 0.15, 0.12],
    radius: 0.028,
  },
]

function createCapsule(length, radius, material, name) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length, 8, 18), material)
  mesh.name = name
  mesh.position.y = length / 2
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function createJoint(radius, name) {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 18, 12), jointMaterial)
  mesh.name = name
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

function addBone(parent, name, position, rotation = {}) {
  const bone = new THREE.Bone()
  bone.name = name
  bone.position.set(position[0], position[1], position[2])
  bone.rotation.set(rotation.x || 0, rotation.y || 0, rotation.z || 0)
  parent.add(bone)
  return bone
}

function addSegmentBone(parent, name, position, rotation, length, radius, material) {
  const bone = addBone(parent, name, position, rotation)
  bone.add(createCapsule(length, radius, material, `${name}_segment`))
  bone.add(createJoint(radius * 1.18, `${name}_joint`))
  return bone
}

function createPalm(handBone, side) {
  const palm = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.34, 0.12), skinMaterial)
  palm.name = `${side}_palm_mesh`
  palm.position.set(0, 0.16, 0.015)
  palm.castShadow = true
  palm.receiveShadow = true
  handBone.add(palm)

  const wrist = createJoint(0.08, `${side}_wrist_joint`)
  handBone.add(wrist)
}

function addFinger(handBone, side, config, mirror) {
  let parent = handBone

  config.lengths.forEach((length, index) => {
    const segment = index + 1
    const bone = new THREE.Bone()
    bone.name = `${side}_${config.key}_${String(segment).padStart(2, '0')}`
    bone.userData.finger = config.key
    bone.userData.segment = segment
    bone.userData.preferredAxis = 'x'

    if (index === 0) {
      bone.position.set(config.x * mirror, config.y, config.z)
      bone.rotation.z = config.spread * mirror
      if (config.key === 'thumb') {
        bone.rotation.x = -0.28
      }
    } else {
      bone.position.y = config.lengths[index - 1]
    }

    parent.add(bone)
    bone.add(createCapsule(length, config.radius, skinMaterial, `${bone.name}_segment`))
    bone.add(createJoint(config.radius * 1.12, `${bone.name}_joint`))
    parent = bone
  })
}

function createHand(handBone, side) {
  const mirror = side === 'left' ? 1 : -1
  createPalm(handBone, side)
  fingerConfigs.forEach((config) => addFinger(handBone, side, config, mirror))
}

function addEye(parent, x) {
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.042, 18, 12), darkMaterial)
  eye.name = x < 0 ? 'left_eye_mesh' : 'right_eye_mesh'
  eye.position.set(x, 0.3, 0.285)
  eye.castShadow = true
  parent.add(eye)
  return eye
}

function addBrow(parent, x) {
  const brow = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.022, 0.018), darkMaterial)
  brow.name = x < 0 ? 'left_brow_mesh' : 'right_brow_mesh'
  brow.position.set(x, 0.395, 0.292)
  brow.castShadow = true
  parent.add(brow)
  return brow
}

function createFaceRig(headBone) {
  const face = new THREE.Group()
  face.name = 'synthetic_face_controls'
  headBone.add(face)

  const leftEye = addEye(face, -0.09)
  const rightEye = addEye(face, 0.09)
  const leftBrow = addBrow(face, -0.095)
  const rightBrow = addBrow(face, 0.095)

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.025, 0.018), darkMaterial)
  mouth.name = 'mouth_line_mesh'
  mouth.position.set(0, 0.16, 0.296)
  mouth.castShadow = true
  face.add(mouth)

  const mouthOpen = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 12), mouthMaterial)
  mouthOpen.name = 'mouth_open_mesh'
  mouthOpen.position.set(0, 0.155, 0.302)
  mouthOpen.scale.set(1.05, 0.12, 0.28)
  mouthOpen.castShadow = true
  face.add(mouthOpen)

  const state = {
    smile: 0,
    mouth_open: 0,
    brow_raise: 0,
    brow_frown: 0,
    eye_squint: 0,
  }

  const apply = () => {
    mouth.scale.x = 1 + state.smile * 0.55
    mouth.position.y = 0.16 + state.smile * 0.035
    mouth.rotation.z = state.brow_frown * 0.06

    mouthOpen.scale.y = 0.12 + state.mouth_open * 0.9
    mouthOpen.visible = state.mouth_open > 0.02

    leftBrow.position.y = 0.395 + state.brow_raise * 0.06
    rightBrow.position.y = 0.395 + state.brow_raise * 0.06
    leftBrow.rotation.z = -0.12 - state.brow_frown * 0.45
    rightBrow.rotation.z = 0.12 + state.brow_frown * 0.45

    leftEye.scale.y = 1 - state.eye_squint * 0.45
    rightEye.scale.y = 1 - state.eye_squint * 0.45
  }

  face.userData.faceControls = [
    {
      id: 'synthetic:smile',
      name: 'smile',
      apply(value) {
        state.smile = value
        apply()
      },
    },
    {
      id: 'synthetic:mouth_open',
      name: 'mouth_open',
      apply(value) {
        state.mouth_open = value
        apply()
      },
    },
    {
      id: 'synthetic:brow_raise',
      name: 'brow_raise',
      apply(value) {
        state.brow_raise = value
        apply()
      },
    },
    {
      id: 'synthetic:brow_frown',
      name: 'brow_frown',
      apply(value) {
        state.brow_frown = value
        apply()
      },
    },
    {
      id: 'synthetic:eye_squint',
      name: 'eye_squint',
      apply(value) {
        state.eye_squint = value
        apply()
      },
    },
  ]

  apply()
}

function createHead(headBone) {
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 24), skinMaterial)
  head.name = 'head_mesh'
  head.position.y = 0.3
  head.scale.set(0.9, 1.12, 0.82)
  head.castShadow = true
  head.receiveShadow = true
  headBone.add(head)

  const hair = new THREE.Mesh(new THREE.SphereGeometry(0.325, 32, 12, 0, Math.PI * 2, 0, Math.PI * 0.42), darkMaterial)
  hair.name = 'hair_cap_mesh'
  hair.position.y = 0.39
  hair.scale.set(0.93, 0.5, 0.84)
  hair.castShadow = true
  headBone.add(hair)

  createFaceRig(headBone)
}

function createTorso(rootBone) {
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.32, 0.72, 8, 22), shirtMaterial)
  chest.name = 'torso_chest_mesh'
  chest.position.set(0, 0.82, -0.045)
  chest.scale.set(0.92, 1, 0.48)
  chest.castShadow = true
  chest.receiveShadow = true
  rootBone.add(chest)

  const abdomen = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.42, 8, 18), shirtMaterial)
  abdomen.name = 'torso_abdomen_mesh'
  abdomen.position.set(0, 0.34, -0.045)
  abdomen.scale.set(0.9, 1, 0.5)
  abdomen.castShadow = true
  abdomen.receiveShadow = true
  rootBone.add(abdomen)

  const shoulderLine = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.055, 0.72, 8, 18),
    shirtMaterial,
  )
  shoulderLine.name = 'shoulder_line_mesh'
  shoulderLine.position.set(0, 1.2, 0.005)
  shoulderLine.rotation.z = Math.PI / 2
  shoulderLine.scale.z = 0.75
  shoulderLine.castShadow = true
  shoulderLine.receiveShadow = true
  rootBone.add(shoulderLine)

  const chestPanel = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.54, 0.025), accentMaterial)
  chestPanel.name = 'signing_space_panel'
  chestPanel.position.set(0, 0.83, 0.125)
  chestPanel.castShadow = true
  chestPanel.receiveShadow = true
  rootBone.add(chestPanel)

  const collar = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.08, 0.36), accentMaterial)
  collar.name = 'collar_mesh'
  collar.position.set(0, 1.27, 0.04)
  collar.castShadow = true
  rootBone.add(collar)

  createSigningSpaceGuide(rootBone)
}

function createSigningSpaceGuide(rootBone) {
  const guide = new THREE.Group()
  guide.name = 'signing_space_guide'
  guide.position.set(0, 0.98, 0.245)
  rootBone.add(guide)

  const plane = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.76), guideMaterial)
  plane.name = 'signing_space_plane'
  guide.add(plane)

  const width = 0.92
  const height = 0.76
  const points = []

  for (let index = 0; index <= 4; index += 1) {
    const x = -width / 2 + (width * index) / 4
    points.push(new THREE.Vector3(x, -height / 2, 0.002), new THREE.Vector3(x, height / 2, 0.002))
  }

  for (let index = 0; index <= 4; index += 1) {
    const y = -height / 2 + (height * index) / 4
    points.push(new THREE.Vector3(-width / 2, y, 0.002), new THREE.Vector3(width / 2, y, 0.002))
  }

  const geometry = new THREE.BufferGeometry().setFromPoints(points)
  const grid = new THREE.LineSegments(geometry, guideLineMaterial)
  grid.name = 'signing_space_grid'
  guide.add(grid)
}

function createArm(chestBone, side) {
  const mirror = side === 'left' ? 1 : -1
  const shoulder = addBone(chestBone, `${side}_shoulder`, [-0.52 * mirror, 0.35, 0.24], {})
  shoulder.add(createJoint(0.105, `${side}_shoulder_joint`))

  const shoulderBridge = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.045, 0.18, 8, 14),
    shirtMaterial,
  )
  shoulderBridge.name = `${side}_shoulder_bridge`
  shoulderBridge.position.set(0.09 * mirror, 0, -0.035)
  shoulderBridge.rotation.z = Math.PI / 2
  shoulderBridge.castShadow = true
  shoulderBridge.receiveShadow = true
  shoulder.add(shoulderBridge)

  const arm = addSegmentBone(
    shoulder,
    `${side}_arm`,
    [0, 0, 0],
    { z: 2.22 * mirror },
    0.48,
    0.074,
    shirtMaterial,
  )
  const forearm = addSegmentBone(
    arm,
    `${side}_forearm`,
    [0, 0.48, 0.045],
    { z: -3.17 * mirror },
    0.5,
    0.062,
    skinMaterial,
  )
  const hand = addBone(forearm, `${side}_hand`, [0, 0.5, 0.03], { z: 1.05 * mirror })
  hand.userData.preferredAxis = 'z'
  createHand(hand, side)
}

export function createSignAvatarRig() {
  const model = new THREE.Group()
  model.name = 'SignAvatarTechnicalRig'

  const root = new THREE.Bone()
  root.name = 'avatar_root'
  root.position.set(0, -1.05, 0)
  model.add(root)

  createTorso(root)

  const spine = addSegmentBone(root, 'spine', [0, 0.04, 0], {}, 0.78, 0.11, shirtMaterial)
  const chest = addSegmentBone(spine, 'chest', [0, 0.78, 0], {}, 0.46, 0.13, shirtMaterial)
  const neck = addSegmentBone(chest, 'neck', [0, 0.46, 0], {}, 0.16, 0.07, skinMaterial)
  const head = addBone(neck, 'head', [0, 0.16, 0], {})
  head.userData.preferredAxis = 'x'
  createHead(head)

  createArm(chest, 'left')
  createArm(chest, 'right')

  model.traverse((node) => {
    if (!node.isMesh) return
    node.frustumCulled = false
  })

  return model
}
