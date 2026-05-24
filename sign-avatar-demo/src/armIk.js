import * as THREE from 'three'
import { cloneWristTarget, createWristTarget } from './poseSerialization.js'

const SIDE_NAMES = ['left', 'right']
const FINGER_PATTERN = /thumb|index|middle|ring|pinky|little|finger|digit/i
const EPSILON = 0.0001

function isSideBone(name, side) {
  return name.toLowerCase().includes(side)
}

function isFingerBone(name) {
  return FINGER_PATTERN.test(name)
}

function findControl(controlBones, side, predicate) {
  return controlBones.find((bone) => {
    const lower = bone.name.toLowerCase()
    return isSideBone(lower, side) && predicate(lower)
  }) || null
}

export function findArmChain(controlBones, side) {
  const shoulder = findControl(controlBones, side, (name) => name.includes('shoulder'))
  const arm = findControl(controlBones, side, (name) =>
    (name.includes('upperarm') || name.includes('upper_arm') || name.endsWith('_arm') || name.includes('arm')) &&
    !name.includes('forearm') &&
    !name.includes('lowerarm') &&
    !name.includes('lower_arm') &&
    !name.includes('shoulder') &&
    !isFingerBone(name),
  )
  const forearm = findControl(controlBones, side, (name) =>
    name.includes('forearm') || name.includes('lowerarm') || name.includes('lower_arm'),
  )
  const hand = findControl(controlBones, side, (name) =>
    name.includes('hand') && !isFingerBone(name),
  )

  return { shoulder, arm, forearm, hand }
}

function vectorFromObject(value = {}) {
  return new THREE.Vector3(value.x || 0, value.y || 0, value.z || 0)
}

function vectorToObject(vector) {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  }
}

function eulerToObject(euler) {
  return {
    x: euler.x,
    y: euler.y,
    z: euler.z,
    order: euler.order,
  }
}

function modelLocalToWorld(model, value = {}) {
  model.updateWorldMatrix(true, false)
  return model.localToWorld(vectorFromObject(value))
}

function worldToModelLocal(model, vector) {
  model.updateWorldMatrix(true, false)
  return model.worldToLocal(vector.clone())
}

function modelLocalVectorToWorld(model, value = {}) {
  const origin = modelLocalToWorld(model, { x: 0, y: 0, z: 0 })
  return modelLocalToWorld(model, value).sub(origin).normalize()
}

function defaultPolePosition(side, position) {
  const sideOffset = side === 'left' ? -0.36 : 0.36
  return {
    x: position.x + sideOffset,
    y: position.y + 0.18,
    z: position.z + 0.48,
  }
}

function outwardPoleVector(side) {
  return new THREE.Vector3(side === 'left' ? -0.56 : 0.56, 0.12, 0.82).normalize()
}

function capturePoleTarget(model, chain, side, wristPosition) {
  const { arm, forearm } = chain
  if (!arm || !forearm) return defaultPolePosition(side, wristPosition)

  const rootWorld = new THREE.Vector3()
  const elbowWorld = new THREE.Vector3()
  arm.getWorldPosition(rootWorld)
  forearm.getWorldPosition(elbowWorld)

  const elbowDirection = elbowWorld.clone().sub(rootWorld)
  const outwardWorld = modelLocalVectorToWorld(model, outwardPoleVector(side))
  const blendedDirection = elbowDirection.lengthSq() > EPSILON
    ? elbowDirection.normalize().multiplyScalar(0.72).add(outwardWorld.multiplyScalar(0.28)).normalize()
    : outwardWorld
  const poleWorld = rootWorld.clone().add(blendedDirection.multiplyScalar(0.62))

  return vectorToObject(worldToModelLocal(model, poleWorld))
}

export function captureWristTargets(model, controlBones) {
  const targets = new Map()
  if (!model) return targets

  model.updateWorldMatrix(true, true)

  SIDE_NAMES.forEach((side) => {
    const chain = findArmChain(controlBones, side)
    if (!chain.hand) return

    const handWorld = new THREE.Vector3()
    chain.hand.getWorldPosition(handWorld)
    const position = worldToModelLocal(model, handWorld)
    const pole = capturePoleTarget(model, chain, side, position)
    const orientation = eulerToObject(chain.hand.rotation)

    targets.set(side, createWristTarget(position, pole, orientation, {
      poleMode: 'fixed-model-local',
      poleStrength: 1,
    }))
  })

  return targets
}

export function captureWristTarget(model, controlBones, side) {
  return captureWristTargets(model, controlBones).get(side) || null
}

function getRestQuaternion(bone) {
  return bone.userData.restQuaternion || bone.quaternion
}

function orientBoneTowardWorldDirection(bone, childLocalPosition, desiredWorldDirection) {
  if (!bone?.parent || desiredWorldDirection.lengthSq() < EPSILON) return

  bone.parent.updateWorldMatrix(true, false)
  const parentWorldQuaternion = new THREE.Quaternion()
  bone.parent.getWorldQuaternion(parentWorldQuaternion)
  const inverseParentWorldQuaternion = parentWorldQuaternion.invert()

  const desiredLocalDirection = desiredWorldDirection
    .clone()
    .normalize()
    .applyQuaternion(inverseParentWorldQuaternion)
    .normalize()
  const restQuaternion = getRestQuaternion(bone).clone()
  const restChildDirection = childLocalPosition
    .clone()
    .normalize()
    .applyQuaternion(restQuaternion)
    .normalize()

  const delta = new THREE.Quaternion().setFromUnitVectors(restChildDirection, desiredLocalDirection)
  bone.quaternion.copy(delta.multiply(restQuaternion))
  bone.updateMatrixWorld(true)
}

function fallbackElbowDirection(direction, side) {
  const preferred = new THREE.Vector3(side === 'left' ? -0.5 : 0.5, 0.2, 0.8).normalize()
  const tangent = preferred.sub(direction.clone().multiplyScalar(preferred.dot(direction)))

  if (tangent.lengthSq() > EPSILON) {
    return tangent.normalize()
  }

  return new THREE.Vector3(0, 1, 0)
}

function solveElbowPosition(rootWorld, targetWorld, poleWorld, currentElbowWorld, upperLength, lowerLength, side) {
  const targetVector = targetWorld.clone().sub(rootWorld)
  const maxReach = Math.max(EPSILON, upperLength + lowerLength - EPSILON)
  const minReach = Math.max(EPSILON, Math.abs(upperLength - lowerLength) + EPSILON)
  const distance = THREE.MathUtils.clamp(targetVector.length(), minReach, maxReach)
  const direction = targetVector.lengthSq() > EPSILON
    ? targetVector.normalize()
    : new THREE.Vector3(0, 1, 0)

  const poleVector = poleWorld.clone().sub(rootWorld)
  const projectedPole = poleVector.sub(direction.clone().multiplyScalar(poleVector.dot(direction)))
  const currentElbowVector = currentElbowWorld.clone().sub(rootWorld)
  const projectedCurrentElbow = currentElbowVector.sub(direction.clone().multiplyScalar(currentElbowVector.dot(direction)))
  let elbowDirection = projectedPole.lengthSq() > EPSILON
    ? projectedPole.normalize()
    : null

  if (!elbowDirection && projectedCurrentElbow.lengthSq() > EPSILON) {
    elbowDirection = projectedCurrentElbow.normalize()
  }

  if (!elbowDirection) {
    elbowDirection = fallbackElbowDirection(direction, side)
  }

  const rootToElbow = ((upperLength * upperLength) - (lowerLength * lowerLength) + (distance * distance)) / (2 * distance)
  const elbowHeight = Math.sqrt(Math.max(0, (upperLength * upperLength) - (rootToElbow * rootToElbow)))

  return rootWorld
    .clone()
    .add(direction.multiplyScalar(rootToElbow))
    .add(elbowDirection.multiplyScalar(elbowHeight))
}

function applyTwoBoneIk(model, chain, target, side) {
  const { arm, forearm, hand } = chain
  if (!arm || !forearm || !hand || !target?.position) return false

  model.updateWorldMatrix(true, true)

  const rootWorld = new THREE.Vector3()
  const currentElbowWorld = new THREE.Vector3()
  const currentHandWorld = new THREE.Vector3()
  arm.getWorldPosition(rootWorld)
  forearm.getWorldPosition(currentElbowWorld)
  hand.getWorldPosition(currentHandWorld)

  const upperLength = Math.max(EPSILON, rootWorld.distanceTo(currentElbowWorld))
  const lowerLength = Math.max(EPSILON, currentElbowWorld.distanceTo(currentHandWorld))
  const targetWorld = modelLocalToWorld(model, target.position)
  const poleWorld = target.pole
    ? modelLocalToWorld(model, target.pole)
    : modelLocalToWorld(model, defaultPolePosition(side, target.position))
  const elbowWorld = solveElbowPosition(
    rootWorld,
    targetWorld,
    poleWorld,
    currentElbowWorld,
    upperLength,
    lowerLength,
    side,
  )

  orientBoneTowardWorldDirection(
    arm,
    forearm.position,
    elbowWorld.clone().sub(rootWorld),
  )

  model.updateWorldMatrix(true, true)
  forearm.getWorldPosition(currentElbowWorld)

  orientBoneTowardWorldDirection(
    forearm,
    hand.position,
    targetWorld.clone().sub(currentElbowWorld),
  )

  return true
}

export function applyArmIkTargets(model, controlBones, wristTargets) {
  if (!model || !wristTargets?.size) return 0

  let applied = 0

  SIDE_NAMES.forEach((side) => {
    const target = wristTargets.get(side)
    if (!target) return

    if (applyTwoBoneIk(model, findArmChain(controlBones, side), target, side)) {
      applied += 1
    }
  })

  return applied
}

export function interpolateWristTargets(startTargets, targetTargets, t) {
  const next = new Map()
  if (!targetTargets?.size) return next

  targetTargets.forEach((target, side) => {
    const start = startTargets?.get(side) || target
    const startPosition = vectorFromObject(start.position)
    const targetPosition = vectorFromObject(target.position)
    const travel = startPosition.distanceTo(targetPosition)
    const position = startPosition.clone().lerp(targetPosition, t)
    const arc = Math.sin(Math.PI * t) * Math.min(0.18, travel * 0.32)

    position.y += arc
    position.z += arc * 0.34

    const startPole = vectorFromObject(start.pole || defaultPolePosition(side, start.position))
    const targetPole = vectorFromObject(target.pole || defaultPolePosition(side, target.position))
    const pole = startPole.lerp(targetPole, t)
    const interpolated = cloneWristTarget(target)
    interpolated.position = vectorToObject(position)
    interpolated.pole = vectorToObject(pole)
    next.set(side, interpolated)
  })

  return next
}
