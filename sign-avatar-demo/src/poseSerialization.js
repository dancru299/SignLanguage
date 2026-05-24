export const POSE_STORAGE_KEY = 'sign-language-lab-poses'

export function normalizePoseName(name) {
  return (name || 'untitled_pose')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 48) || 'untitled_pose'
}

export function createOffset(x = 0, y = 0, z = 0) {
  return { x, y, z }
}

export function cloneOffset(offset) {
  return createOffset(offset?.x || 0, offset?.y || 0, offset?.z || 0)
}

export function getBoneOffset(poseOffsets, boneName) {
  return poseOffsets.get(boneName) || createOffset()
}

export function setBoneAxisOffset(poseOffsets, boneName, axis, radians) {
  const offset = cloneOffset(getBoneOffset(poseOffsets, boneName))
  offset[axis] = radians
  poseOffsets.set(boneName, offset)
}

export function cloneOffsets(offsets) {
  const next = new Map()
  offsets.forEach((offset, boneName) => {
    next.set(boneName, cloneOffset(offset))
  })
  return next
}

export function createWristTarget(position = {}, pole = {}, orientation = {}, options = {}) {
  return {
    position: createOffset(position.x, position.y, position.z),
    pole: createOffset(pole.x, pole.y, pole.z),
    poleMode: options.poleMode || 'fixed-model-local',
    poleStrength: Number.isFinite(options.poleStrength) ? options.poleStrength : 1,
    orientation: {
      x: orientation.x || 0,
      y: orientation.y || 0,
      z: orientation.z || 0,
      order: orientation.order || 'XYZ',
    },
  }
}

export function cloneWristTarget(target) {
  return createWristTarget(target?.position, target?.pole, target?.orientation, target)
}

export function cloneWristTargets(targets) {
  const next = new Map()
  if (!targets) return next

  targets.forEach((target, side) => {
    next.set(side, cloneWristTarget(target))
  })

  return next
}

function serializeVector(vector = {}) {
  return {
    x: Number((vector.x || 0).toFixed(6)),
    y: Number((vector.y || 0).toFixed(6)),
    z: Number((vector.z || 0).toFixed(6)),
  }
}

function serializeWristTargets(targets) {
  const wristTargets = {}
  if (!targets) return wristTargets

  targets.forEach((target, side) => {
    if (!target?.position) return

    wristTargets[side] = {
      position: serializeVector(target.position),
      pole: serializeVector(target.pole),
      poleMode: target.poleMode || 'fixed-model-local',
      poleStrength: Number.isFinite(target.poleStrength) ? Number(target.poleStrength.toFixed(3)) : 1,
      orientation: {
        x: Number((target.orientation?.x || 0).toFixed(6)),
        y: Number((target.orientation?.y || 0).toFixed(6)),
        z: Number((target.orientation?.z || 0).toFixed(6)),
        order: target.orientation?.order || 'XYZ',
      },
    }
  })

  return wristTargets
}

export function serializePose({ name, sourceName, controlBones, fingerBones, poseOffsets, faceValues, faceControls, wristTargets }) {
  const poseName = normalizePoseName(name)
  const bones = {}
  const bonesToSerialize = controlBones || fingerBones || []

  for (const bone of bonesToSerialize) {
    const offset = cloneOffset(getBoneOffset(poseOffsets, bone.name))
    bones[bone.name] = {
      rotation: {
        x: Number(offset.x.toFixed(6)),
        y: Number(offset.y.toFixed(6)),
        z: Number(offset.z.toFixed(6)),
        order: bone.rotation.order,
      },
      quaternion: {
        x: Number(bone.quaternion.x.toFixed(6)),
        y: Number(bone.quaternion.y.toFixed(6)),
        z: Number(bone.quaternion.z.toFixed(6)),
        w: Number(bone.quaternion.w.toFixed(6)),
      },
    }
  }

  const face = {}

  if (faceValues && faceControls) {
    for (const control of faceControls) {
      const value = faceValues.get(control.name) || 0
      if (value > 0) {
        face[control.name] = Number(value.toFixed(4))
      }
    }
  }

  const serializedWristTargets = serializeWristTargets(wristTargets)

  return {
    version: 3,
    name: poseName,
    sourceModel: sourceName,
    coordinateSpace: 'rest-relative-euler-plus-face-morphs-plus-model-local-wrist-ik',
    createdAt: new Date().toISOString(),
    bones,
    face,
    wristTargets: serializedWristTargets,
  }
}

export function poseToOffsets(pose, controlBones) {
  const offsets = new Map()
  const poseBones = pose?.bones || {}

  for (const bone of controlBones) {
    const entry = poseBones[bone.name]
    if (!entry?.rotation) continue

    offsets.set(
      bone.name,
      createOffset(
        Number(entry.rotation.x) || 0,
        Number(entry.rotation.y) || 0,
        Number(entry.rotation.z) || 0,
      ),
    )
  }

  return offsets
}

export function poseToWristTargets(pose) {
  const targets = new Map()
  const rawTargets = pose?.wristTargets || pose?.ikTargets || {}

  Object.entries(rawTargets).forEach(([side, target]) => {
    if (!target?.position) return
    targets.set(side, cloneWristTarget(target))
  })

  return targets
}

export function readStoredPoses() {
  try {
    const raw = window.localStorage.getItem(POSE_STORAGE_KEY)
    const poses = raw ? JSON.parse(raw) : []
    return Array.isArray(poses) ? poses : []
  } catch {
    return []
  }
}

export function writeStoredPoses(poses) {
  window.localStorage.setItem(POSE_STORAGE_KEY, JSON.stringify(poses))
}

export function upsertStoredPose(pose) {
  const poses = readStoredPoses().filter((item) => item.name !== pose.name)
  poses.unshift(pose)
  writeStoredPoses(poses)
  return poses
}

export function removeStoredPose(name) {
  const poses = readStoredPoses().filter((item) => item.name !== name)
  writeStoredPoses(poses)
  return poses
}

export function downloadPoseJson(pose) {
  const blob = new Blob([`${JSON.stringify(pose, null, 2)}\n`], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `${pose.name}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
