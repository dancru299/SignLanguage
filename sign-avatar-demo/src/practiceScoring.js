export const PRACTICE_LESSONS = [
  {
    token: 'chu_a',
    label: 'A',
    dominantHand: 'right',
    allowMirror: true,
    target: {
      openness: 1.35,
      thumbIndex: 0.42,
      indexMiddle: 0.22,
      ringPinky: 0.2,
      thumbCurl: 0.5,
      indexCurl: 0.62,
      middleCurl: 0.62,
      ringCurl: 0.62,
      pinkyCurl: 0.62,
      palmFacingCamera: 0.72,
      palmNormalZ: 0.58,
    },
  },
  {
    token: 'chu_b',
    label: 'B',
    dominantHand: 'right',
    allowMirror: true,
    target: {
      openness: 2.45,
      thumbIndex: 0.72,
      indexMiddle: 0.26,
      ringPinky: 0.2,
      thumbCurl: 0.34,
      indexCurl: 0.08,
      middleCurl: 0.08,
      ringCurl: 0.08,
      pinkyCurl: 0.08,
      palmFacingCamera: 0.72,
      palmNormalZ: 0.58,
    },
  },
  {
    token: 'chu_c',
    label: 'C',
    dominantHand: 'right',
    allowMirror: true,
    target: {
      openness: 2.0,
      thumbIndex: 0.62,
      indexMiddle: 0.34,
      ringPinky: 0.28,
      thumbCurl: 0.28,
      indexCurl: 0.26,
      middleCurl: 0.26,
      ringCurl: 0.28,
      pinkyCurl: 0.3,
      palmFacingCamera: 0.68,
      palmNormalZ: 0.52,
    },
  },
  {
    token: 'chu_d',
    label: 'D',
    dominantHand: 'right',
    allowMirror: true,
    target: {
      openness: 1.62,
      thumbIndex: 0.58,
      indexMiddle: 0.56,
      ringPinky: 0.16,
      thumbCurl: 0.4,
      indexCurl: 0.08,
      middleCurl: 0.62,
      ringCurl: 0.62,
      pinkyCurl: 0.62,
      palmFacingCamera: 0.72,
      palmNormalZ: 0.58,
    },
  },
  {
    token: 'dung',
    label: 'Đúng',
    dominantHand: 'right',
    allowMirror: true,
    target: {
      openness: 1.45,
      thumbIndex: 0.52,
      indexMiddle: 0.3,
      ringPinky: 0.2,
      thumbCurl: 0.32,
      indexCurl: 0.58,
      middleCurl: 0.58,
      ringCurl: 0.58,
      pinkyCurl: 0.58,
      palmFacingCamera: 0.72,
      palmNormalZ: 0.58,
    },
  },
]

const FEATURE_CONFIG = {
  openness: { weight: 0.22, tolerance: 1.4 },
  thumbIndex: { weight: 0.16, tolerance: 0.72 },
  indexMiddle: { weight: 0.09, tolerance: 0.55 },
  ringPinky: { weight: 0.07, tolerance: 0.5 },
  thumbCurl: { weight: 0.06, tolerance: 0.34 },
  indexCurl: { weight: 0.08, tolerance: 0.34 },
  middleCurl: { weight: 0.07, tolerance: 0.34 },
  ringCurl: { weight: 0.06, tolerance: 0.34 },
  pinkyCurl: { weight: 0.06, tolerance: 0.34 },
  palmNormalX: { weight: 0.04, tolerance: 1.1 },
  palmNormalY: { weight: 0.04, tolerance: 1.1 },
  palmFacingCamera: { weight: 0.05, tolerance: 0.65 },
  palmNormalZ: { weight: 0.08, tolerance: 0.95 },
}

export const HAND_CONNECTIONS = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [17, 18],
  [18, 19],
  [19, 20],
  [0, 17],
]

const FINGER_JOINTS = {
  thumb: [1, 2, 3, 4],
  index: [5, 6, 7, 8],
  middle: [9, 10, 11, 12],
  ring: [13, 14, 15, 16],
  pinky: [17, 18, 19, 20],
}

function distance(a, b) {
  const dx = a.x - b.x
  const dy = a.y - b.y
  const dz = (a.z || 0) - (b.z || 0)
  return Math.sqrt(dx * dx + dy * dy + dz * dz)
}

function vector(a, b) {
  return {
    x: b.x - a.x,
    y: b.y - a.y,
    z: (b.z || 0) - (a.z || 0),
  }
}

function dot(a, b) {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  }
}

function length(value) {
  return Math.sqrt(dot(value, value))
}

function normalize(value) {
  const size = length(value)
  if (size <= 0.000001) return { x: 0, y: 0, z: 0 }

  return {
    x: value.x / size,
    y: value.y / size,
    z: value.z / size,
  }
}

function angleBetween(a, b) {
  const aSize = length(a)
  const bSize = length(b)
  if (aSize <= 0.000001 || bSize <= 0.000001) return 0

  const cosine = Math.max(-1, Math.min(1, dot(a, b) / (aSize * bSize)))
  return Math.acos(cosine)
}

function normalizedDistance(landmarks, a, b, scale) {
  return distance(landmarks[a], landmarks[b]) / scale
}

function fingerCurl(landmarks, joints) {
  const [mcp, pip, dip, tip] = joints
  const firstBend = angleBetween(vector(landmarks[mcp], landmarks[pip]), vector(landmarks[pip], landmarks[dip]))
  const secondBend = angleBetween(vector(landmarks[pip], landmarks[dip]), vector(landmarks[dip], landmarks[tip]))

  return Math.min(1, ((firstBend + secondBend) / 2) / Math.PI)
}

function palmNormal(landmarks, handedness = '') {
  const wristToIndex = vector(landmarks[0], landmarks[5])
  const wristToPinky = vector(landmarks[0], landmarks[17])
  return normalize(cross(wristToIndex, wristToPinky))
}

function canonicalPalmNormal(normal, handedness = '') {
  const hand = handedness.toLowerCase()
  const sideSign = hand === 'left' ? -1 : 1

  return {
    x: normal.x * sideSign,
    y: normal.y * sideSign,
    z: normal.z * sideSign,
  }
}

export function extractHandFeatures(landmarks, options = {}) {
  if (!landmarks || landmarks.length < 21) return null

  const palmScale = Math.max(
    distance(landmarks[0], landmarks[9]),
    distance(landmarks[5], landmarks[17]),
    0.001,
  )
  const handedness = options.handedness || ''
  const rawNormal = palmNormal(landmarks, handedness)
  const normal = canonicalPalmNormal(rawNormal, handedness)
  const fingerTips = [8, 12, 16, 20]
  const openness = fingerTips
    .map((tip) => normalizedDistance(landmarks, 0, tip, palmScale))
    .reduce((sum, value) => sum + value, 0) / fingerTips.length

  return {
    openness,
    thumbIndex: normalizedDistance(landmarks, 4, 8, palmScale),
    indexMiddle: normalizedDistance(landmarks, 8, 12, palmScale),
    middleRing: normalizedDistance(landmarks, 12, 16, palmScale),
    ringPinky: normalizedDistance(landmarks, 16, 20, palmScale),
    thumbCurl: fingerCurl(landmarks, FINGER_JOINTS.thumb),
    indexCurl: fingerCurl(landmarks, FINGER_JOINTS.index),
    middleCurl: fingerCurl(landmarks, FINGER_JOINTS.middle),
    ringCurl: fingerCurl(landmarks, FINGER_JOINTS.ring),
    pinkyCurl: fingerCurl(landmarks, FINGER_JOINTS.pinky),
    indexMiddleAngle: angleBetween(vector(landmarks[5], landmarks[8]), vector(landmarks[9], landmarks[12])) / Math.PI,
    rawPalmNormalX: rawNormal.x,
    rawPalmNormalY: rawNormal.y,
    rawPalmNormalZ: rawNormal.z,
    palmNormalX: normal.x,
    palmNormalY: normal.y,
    palmNormalZ: normal.z,
    palmFacingCamera: Math.abs(normal.z),
    handedness,
    mirroredForScoring: handedness.toLowerCase() === 'left',
    palmScale,
  }
}

function similarityForFeature(key, current, target) {
  const tolerance = FEATURE_CONFIG[key]?.tolerance || 0.5
  return Math.max(0, 1 - Math.abs(current - target) / tolerance)
}

function mirrorFeatureSet(features) {
  if (!features) return null

  return {
    ...features,
    palmNormalX: -features.palmNormalX,
    rawPalmNormalX: -features.rawPalmNormalX,
    mirroredForScoring: !features.mirroredForScoring,
  }
}

function scoreFeatureSet(features, lesson, mirrored = false) {
  const scoredTargets = Object.entries(lesson.target).filter(([key, target]) =>
    FEATURE_CONFIG[key] &&
    Number.isFinite(features[key]) &&
    Number.isFinite(target),
  )
  const weightTotal = scoredTargets.reduce((sum, [key]) => sum + FEATURE_CONFIG[key].weight, 0) || 1
  const details = scoredTargets.map(([key, target]) => {
    const current = features[key]
    const similarity = similarityForFeature(key, current, target)
    const weight = FEATURE_CONFIG[key].weight / weightTotal

    return {
      key,
      current,
      target,
      similarity,
      weight,
    }
  })
  const weighted = details.reduce((sum, item) => sum + item.similarity * item.weight, 0)

  return {
    score: Math.round(weighted * 100),
    details,
    mirrored,
    handedness: features.handedness || '',
  }
}

export function scorePractice(features, lesson) {
  if (!features || !lesson?.target) {
    return {
      score: 0,
      details: [],
      mirrored: false,
    }
  }

  const directScore = scoreFeatureSet(features, lesson, false)
  if (lesson.allowMirror === false) return directScore

  const mirroredScore = scoreFeatureSet(mirrorFeatureSet(features), lesson, true)
  return mirroredScore.score > directScore.score ? mirroredScore : directScore
}
