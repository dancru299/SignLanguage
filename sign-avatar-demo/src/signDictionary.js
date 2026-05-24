const LETTERS = [
  ['A', 'chu_a', 'a'],
  ['Ă', 'chu_aw', 'ăằắẳẵặ'],
  ['Â', 'chu_aa', 'âầấẩẫậ'],
  ['B', 'chu_b', 'b'],
  ['C', 'chu_c', 'c'],
  ['D', 'chu_d', 'd'],
  ['Đ', 'chu_dd', 'đ'],
  ['E', 'chu_e', 'eèéẻẽẹ'],
  ['Ê', 'chu_ee', 'êềếểễệ'],
  ['G', 'chu_g', 'g'],
  ['H', 'chu_h', 'h'],
  ['I', 'chu_i', 'iìíỉĩị'],
  ['K', 'chu_k', 'k'],
  ['L', 'chu_l', 'l'],
  ['M', 'chu_m', 'm'],
  ['N', 'chu_n', 'n'],
  ['O', 'chu_o', 'oòóỏõọ'],
  ['Ô', 'chu_oo', 'ôồốổỗộ'],
  ['Ơ', 'chu_ow', 'ơờớởỡợ'],
  ['P', 'chu_p', 'p'],
  ['Q', 'chu_q', 'q'],
  ['R', 'chu_r', 'r'],
  ['S', 'chu_s', 's'],
  ['T', 'chu_t', 't'],
  ['U', 'chu_u', 'uùúủũụ'],
  ['Ư', 'chu_uw', 'ưừứửữự'],
  ['V', 'chu_v', 'v'],
  ['X', 'chu_x', 'x'],
  ['Y', 'chu_y', 'yỳýỷỹỵ'],
]

const DIGITS = [
  ['0', 'so_0', '0'],
  ['1', 'so_1', '1'],
  ['2', 'so_2', '2'],
  ['3', 'so_3', '3'],
  ['4', 'so_4', '4'],
  ['5', 'so_5', '5'],
  ['6', 'so_6', '6'],
  ['7', 'so_7', '7'],
  ['8', 'so_8', '8'],
  ['9', 'so_9', '9'],
]

const PHRASES = [
  { label: 'Xin chào', token: 'xin_chao', words: ['xin', 'chao'] },
  { label: 'Cảm ơn', token: 'cam_on', words: ['cam', 'on'] },
  { label: 'Xin lỗi', token: 'xin_loi', words: ['xin', 'loi'] },
  { label: 'Đúng', token: 'dung', words: ['dung'] },
  { label: 'Sai', token: 'sai', words: ['sai'] },
]

const letterTokenByChar = new Map()

for (const [, token, chars] of LETTERS) {
  for (const char of chars) {
    letterTokenByChar.set(char, token)
  }
}

for (const [, token, chars] of DIGITS) {
  for (const char of chars) {
    letterTokenByChar.set(char, token)
  }
}

function normalizeWord(word) {
  return word
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
}

function findFinger(name) {
  const lower = name.toLowerCase()
  if (lower.includes('thumb')) return 'thumb'
  if (lower.includes('index')) return 'index'
  if (lower.includes('middle')) return 'middle'
  if (lower.includes('ring')) return 'ring'
  if (lower.includes('pinky') || lower.includes('little')) return 'pinky'
  return ''
}

function findBodyControl(name) {
  const lower = name.toLowerCase()
  const side = lower.includes('left') ? 'left' : lower.includes('right') ? 'right' : ''

  if (lower.includes('hand') && !findFinger(name)) return `${side}_hand`
  if (lower.includes('forearm')) return `${side}_forearm`
  if (lower.includes('arm') && !lower.includes('forearm')) return `${side}_arm`
  if (lower.includes('shoulder')) return `${side}_shoulder`
  if (lower.includes('head')) return 'head'
  if (lower.includes('neck')) return 'neck'
  if (lower.includes('chest')) return 'chest'
  if (lower.includes('spine2')) return 'chest'
  if (lower.includes('spine')) return 'spine'

  return ''
}

function segmentFactor(name) {
  const match = name.match(/(\d+)$/)
  const segment = match ? Number(match[1]) : 1
  return Math.max(0.35, 1 - (segment - 1) * 0.16)
}

function rotationAxisForBone(bone) {
  const name = typeof bone === 'string' ? bone : bone.name
  if (bone?.userData?.preferredAxis) return bone.userData.preferredAxis
  return /mixamorig/i.test(name) ? 'z' : 'x'
}

function bodyRotationForBone(name, body = {}) {
  const control = findBodyControl(name)
  const rotation = body[control]
  if (!rotation) return null

  return {
    x: Number((rotation.x || 0).toFixed(6)),
    y: Number((rotation.y || 0).toFixed(6)),
    z: Number((rotation.z || 0).toFixed(6)),
  }
}

function seedFace(faceControls, amount = 0) {
  const face = {}

  faceControls.slice(0, 3).forEach((control, index) => {
    const value = Math.max(0, Math.min(1, amount - index * 0.12))
    if (value > 0) {
      face[control.name] = Number(value.toFixed(4))
    }
  })

  return face
}

function makePose(name, label, sourceModel, controlBones, curls, body = {}, faceControls = [], faceAmount = 0) {
  const bones = {}

  for (const bone of controlBones) {
    const finger = findFinger(bone.name)
    const rotation = { x: 0, y: 0, z: 0, order: bone.rotation.order }

    if (finger) {
      const axis = rotationAxisForBone(bone)
      rotation[axis] = Number(((curls[finger] || 0) * segmentFactor(bone.name)).toFixed(6))
    } else {
      const bodyRotation = bodyRotationForBone(bone.name, body)
      if (!bodyRotation) continue

      rotation.x = bodyRotation.x
      rotation.y = bodyRotation.y
      rotation.z = bodyRotation.z
    }

    bones[bone.name] = {
      rotation,
      quaternion: { x: 0, y: 0, z: 0, w: 1 },
    }
  }

  return {
    version: 2,
    name,
    label,
    sourceModel,
    coordinateSpace: 'rest-relative-euler-plus-face-morphs',
    createdAt: 'seed',
    seedPose: true,
    bones,
    face: seedFace(faceControls, faceAmount),
  }
}

function generatedLetterCurls(index) {
  const phase = index % 7
  const base = 0.22 + phase * 0.13

  return {
    thumb: 0.35 + ((index + 2) % 5) * 0.12,
    index: base,
    middle: 0.25 + ((index + 1) % 6) * 0.14,
    ring: 0.4 + ((index + 3) % 5) * 0.13,
    pinky: 0.55 + ((index + 4) % 4) * 0.14,
  }
}

const specialCurls = {
  chu_a: { thumb: 0.55, index: 1.18, middle: 1.18, ring: 1.18, pinky: 1.18 },
  chu_b: { thumb: 0.42, index: 0.05, middle: 0.05, ring: 0.05, pinky: 0.05 },
  chu_c: { thumb: -0.36, index: 0.54, middle: 0.5, ring: 0.48, pinky: 0.46 },
  chu_d: { thumb: 0.55, index: 0.02, middle: 1.05, ring: 1.05, pinky: 1.05 },
  chu_e: { thumb: 0.72, index: 0.82, middle: 0.82, ring: 0.82, pinky: 0.82 },
  dung: { thumb: -0.35, index: 1.15, middle: 1.15, ring: 1.15, pinky: 1.15 },
  sai: { thumb: 0.28, index: 0.05, middle: 1.0, ring: 1.0, pinky: 1.0 },
  xin_chao: { thumb: 0.1, index: 0.12, middle: 0.12, ring: 0.12, pinky: 0.12 },
  cam_on: { thumb: 0.75, index: 0.68, middle: 0.35, ring: 0.35, pinky: 0.35 },
  xin_loi: { thumb: 0.45, index: 0.95, middle: 0.95, ring: 0.95, pinky: 0.95 },
  so_0: { thumb: -0.34, index: 0.5, middle: 0.5, ring: 0.52, pinky: 0.54 },
  so_1: { thumb: 0.62, index: 0.03, middle: 1.1, ring: 1.1, pinky: 1.1 },
  so_2: { thumb: 0.6, index: 0.03, middle: 0.03, ring: 1.08, pinky: 1.08 },
  so_3: { thumb: 0.08, index: 0.04, middle: 0.04, ring: 1.05, pinky: 1.05 },
  so_4: { thumb: 0.82, index: 0.04, middle: 0.04, ring: 0.04, pinky: 0.04 },
  so_5: { thumb: 0.05, index: 0.03, middle: 0.03, ring: 0.03, pinky: 0.03 },
  so_6: { thumb: 0.15, index: 0.9, middle: 0.9, ring: 0.9, pinky: 0.08 },
  so_7: { thumb: 0.12, index: 0.9, middle: 0.9, ring: 0.08, pinky: 0.9 },
  so_8: { thumb: 0.1, index: 0.9, middle: 0.08, ring: 0.9, pinky: 0.9 },
  so_9: { thumb: 0.08, index: 0.08, middle: 0.9, ring: 0.9, pinky: 0.9 },
}

const bodySignals = {
  xin_chao: {
    left_forearm: { z: -0.7 },
    left_arm: { z: -0.34 },
    left_hand: { x: 0.22, z: 0.28 },
    head: { x: 0.08 },
  },
  cam_on: {
    left_forearm: { z: -0.58 },
    left_arm: { z: -0.24 },
    right_forearm: { z: 0.42 },
    right_hand: { x: -0.2 },
    head: { x: 0.12 },
  },
  xin_loi: {
    left_forearm: { z: 0.46 },
    left_arm: { z: -0.38 },
    left_hand: { x: -0.18 },
    chest: { x: 0.08 },
    head: { x: 0.16 },
  },
  dung: {
    head: { x: 0.16 },
    neck: { x: 0.08 },
  },
  sai: {
    head: { y: -0.18 },
    neck: { y: -0.1 },
    left_hand: { z: -0.44 },
  },
}

const faceSignals = {
  xin_chao: 0.22,
  cam_on: 0.34,
  xin_loi: 0.28,
  dung: 0.18,
  sai: 0.44,
}

export function createSeedDictionary(controlBones, sourceModel, faceControls = []) {
  const entries = LETTERS.map(([label, token], index) => ({
    token,
    label,
    kind: 'letter',
    pose: makePose(
      token,
      label,
      sourceModel,
      controlBones,
      specialCurls[token] || generatedLetterCurls(index),
      {},
      faceControls,
      0,
    ),
  }))

  DIGITS.forEach(([label, token], index) => {
    entries.push({
      token,
      label,
      kind: 'digit',
      pose: makePose(
        token,
        label,
        sourceModel,
        controlBones,
        specialCurls[token] || generatedLetterCurls(index + LETTERS.length),
        {},
        faceControls,
        0,
      ),
    })
  })

  for (const phrase of PHRASES) {
    entries.push({
      token: phrase.token,
      label: phrase.label,
      kind: 'phrase',
      pose: makePose(
        phrase.token,
        phrase.label,
        sourceModel,
        controlBones,
        specialCurls[phrase.token],
        bodySignals[phrase.token],
        faceControls,
        faceSignals[phrase.token] || 0,
      ),
    })
  }

  return entries
}

export function createPoseDictionary(seedEntries, savedPoses) {
  const dictionary = new Map()

  for (const entry of seedEntries) {
    dictionary.set(entry.token, entry)
  }

  for (const pose of savedPoses) {
    dictionary.set(pose.name, {
      token: pose.name,
      label: pose.name,
      kind: 'local',
      pose,
    })
  }

  return dictionary
}

export function tokenizeTextToSigns(text) {
  const words = text
    .normalize('NFC')
    .toLowerCase()
    .match(/[\p{L}\p{N}_-]+/gu) || []

  const tokens = []

  for (let index = 0; index < words.length; index += 1) {
    const current = normalizeWord(words[index])
    const next = normalizeWord(words[index + 1] || '')
    const twoWordPhrase = PHRASES.find(
      (phrase) => phrase.words.length === 2 && phrase.words[0] === current && phrase.words[1] === next,
    )

    if (twoWordPhrase) {
      tokens.push({ token: twoWordPhrase.token, label: twoWordPhrase.label, source: 'phrase' })
      index += 1
      continue
    }

    const oneWordPhrase = PHRASES.find(
      (phrase) => phrase.words.length === 1 && phrase.words[0] === current,
    )

    if (oneWordPhrase) {
      tokens.push({ token: oneWordPhrase.token, label: oneWordPhrase.label, source: 'phrase' })
      continue
    }

    for (const char of words[index]) {
      const letterToken = letterTokenByChar.get(char)
      if (letterToken) {
        const letterEntry = LETTERS.find(([, token]) => token === letterToken)
        const digitEntry = DIGITS.find(([, token]) => token === letterToken)

        tokens.push({
          token: letterToken,
          label: letterEntry?.[0] || digitEntry?.[0] || char.toUpperCase(),
          source: digitEntry ? 'digit' : 'letter',
        })
      }
    }
  }

  return tokens
}
