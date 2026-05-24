const FINGER_PATTERN = /thumb|index|middle|ring|pinky|little|finger|digit/i
const SIGN_CONTROL_PATTERN = /thumb|index|middle|ring|pinky|little|finger|digit|hand|forearm|arm|shoulder|spine|chest|neck|head/i
const CONTROL_EXCLUDE_PATTERN = /headtop|_end$/i

export function classifyBonePart(name) {
  const lower = name.toLowerCase()

  if (FINGER_PATTERN.test(lower)) return 'fingers'
  if (lower.includes('hand')) return 'hands'
  if (lower.includes('arm') || lower.includes('shoulder')) return 'arms'
  if (lower.includes('spine') || lower.includes('chest') || lower.includes('neck') || lower.includes('head')) return 'body'

  return 'other'
}

export function findSignControlBones(root) {
  const allBones = []
  const controlBones = []
  const fingerBones = []
  const explicitControlsOnly = Boolean(root.userData?.vrm)

  root.traverse((node) => {
    const isNamedControl = !explicitControlsOnly &&
      SIGN_CONTROL_PATTERN.test(node.name) &&
      !CONTROL_EXCLUDE_PATTERN.test(node.name)
    const isExplicitControl = Boolean(node.userData?.signControl)

    if (node.isBone || isExplicitControl) {
      allBones.push(node)
    }

    if (!node.isBone && !isExplicitControl) return

    if (node.userData?.signPart === 'fingers' || FINGER_PATTERN.test(node.name)) {
      fingerBones.push(node)
    }

    if (isExplicitControl || isNamedControl) {
      node.userData.signPart = node.userData.signPart || classifyBonePart(node.name)
      controlBones.push(node)
    }
  })

  return {
    allBones,
    controlBones: controlBones.length > 0 ? controlBones : allBones,
    fingerBones,
    usedFallback: controlBones.length === 0,
  }
}

export function collectFaceControls(root) {
  const controls = []
  const skipMorphTargetScan = Boolean(root.userData?.disableMorphTargetFaceScan)

  root.traverse((node) => {
    const syntheticControls = node.userData?.faceControls
    if (Array.isArray(syntheticControls)) {
      syntheticControls.forEach((control, index) => {
        controls.push({
          id: control.id || `${node.uuid}:synthetic:${index}`,
          name: control.name || `${node.name || 'face'}_${index}`,
          value: 0,
          apply: control.apply,
        })
      })
    }

    if (skipMorphTargetScan || !node.isMesh || !node.morphTargetInfluences) return

    const dictionary = node.morphTargetDictionary || {}
    const namesByIndex = new Map(
      Object.entries(dictionary).map(([name, index]) => [index, name]),
    )

    node.morphTargetInfluences.forEach((value, index) => {
      const name = namesByIndex.get(index) || `${node.name || 'mesh'}_face_${index}`
      controls.push({
        id: `${node.uuid}:${index}`,
        name,
        mesh: node,
        index,
        value: Number(value) || 0,
      })
    })
  })

  return controls
}

export function setFaceControlValue(control, value) {
  const clamped = Math.max(0, Math.min(1, Number(value) || 0))

  if (typeof control.apply === 'function') {
    control.apply(clamped)
    control.value = clamped
    return
  }

  if (control.mesh?.morphTargetInfluences) {
    control.mesh.morphTargetInfluences[control.index] = clamped
    control.value = clamped
  }
}

export function readFaceValue(faceValues, name) {
  return faceValues.get(name) || 0
}

export function cloneFaceValues(faceValues) {
  const next = new Map()
  faceValues.forEach((value, name) => {
    next.set(name, Number(value) || 0)
  })
  return next
}

export function applyFaceValues(faceControls, faceValues) {
  for (const control of faceControls) {
    setFaceControlValue(control, readFaceValue(faceValues, control.name))
  }
}

export function faceMapFromObject(face = {}, faceControls = []) {
  const values = new Map()
  const allowed = new Set(faceControls.map((control) => control.name))

  Object.entries(face).forEach(([name, value]) => {
    if (allowed.has(name)) {
      values.set(name, Math.max(0, Math.min(1, Number(value) || 0)))
    }
  })

  return values
}

export function faceObjectFromMap(faceValues, faceControls) {
  const face = {}

  for (const control of faceControls) {
    const value = readFaceValue(faceValues, control.name)
    if (value > 0) {
      face[control.name] = Number(value.toFixed(4))
    }
  }

  return face
}
