import './style.css'
import * as THREE from 'three'
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import {
  applyBoneOffset,
  cacheRestPose,
  collectBoneChain,
  createDemoHandRig,
  makeTargetQuaternion,
  restoreRestPose,
} from './handRig.js'
import { createSignAvatarRig } from './signAvatarRig.js'
import {
  applyArmIkTargets,
  captureWristTarget,
  captureWristTargets,
  interpolateWristTargets,
} from './armIk.js'
import {
  cloneOffsets,
  cloneWristTarget,
  cloneWristTargets,
  downloadPoseJson,
  getBoneOffset,
  normalizePoseName,
  poseToOffsets,
  poseToWristTargets,
  readStoredPoses,
  removeStoredPose,
  serializePose,
  setBoneAxisOffset,
  upsertStoredPose,
} from './poseSerialization.js'
import {
  createPoseDictionary,
  createSeedDictionary,
  tokenizeTextToSigns,
} from './signDictionary.js'
import {
  applyFaceValues,
  cloneFaceValues,
  collectFaceControls,
  faceMapFromObject,
  findSignControlBones,
  readFaceValue,
  setFaceControlValue,
} from './signRig.js'
import {
  extractHandFeatures,
  HAND_CONNECTIONS,
  PRACTICE_LESSONS,
  scorePractice,
} from './practiceScoring.js'
import { prepareVrmForSignLab } from './vrmRig.js'

const DEFAULT_VRM_AVATAR = {
  url: '/models/AvatarSample_C.vrm',
  name: 'AvatarSample_C VRM',
}

const REFERENCE_AVATAR = {
  url: '/models/osa-polydancer.glb',
  name: 'OSA Polydancer',
}

const state = {
  mode: 'lab',
  model: null,
  vrm: null,
  helper: null,
  allBones: [],
  controlBones: [],
  filteredControlBones: [],
  fingerBones: [],
  faceControls: [],
  faceValues: new Map(),
  activeFaceControl: null,
  activeBone: null,
  axis: 'x',
  curl: 0.62,
  auto: false,
  chain: true,
  sourceName: 'Sign avatar rig',
  usedFallback: false,
  poseOffsets: new Map(),
  wristTargets: new Map(),
  activeIkSide: 'left',
  savedPoses: [],
  seedEntries: [],
  signDictionary: new Map(),
  transition: null,
  transitionMs: 300,
  playback: {
    playing: false,
    queue: [],
    index: 0,
    waitUntil: 0,
    holdMs: 520,
    missing: [],
  },
  recognizer: null,
  practice: {
    handLandmarker: null,
    stream: null,
    running: false,
    lastVideoTime: -1,
    lastDetectAt: 0,
    targetFps: 18,
    frameIntervalMs: 1000 / 18,
    detectedFrames: 0,
    skippedFrames: 0,
    measuredFps: 0,
    lastFpsAt: 0,
    lastHandedness: '',
    lesson: PRACTICE_LESSONS[2],
    score: 0,
  },
  performance: {
    renderFrames: 0,
    renderFps: 0,
    lastRenderFpsAt: 0,
  },
}

document.querySelector('#app').innerHTML = `
  <main class="app-shell lab-mode" id="appShell">
    <nav class="mode-tabs" aria-label="Workspace mode">
      <button id="learnerModeButton" type="button">Learner</button>
      <button id="labModeButton" type="button" class="is-active">Pose Lab</button>
    </nav>

    <aside class="panel" aria-label="Bone controls">
      <div class="title-block">
        <div class="mark" aria-hidden="true">SL</div>
        <div>
          <h1>Tay 3D MVP</h1>
          <p>Bone control lab</p>
        </div>
      </div>

      <div class="control-row">
        <label class="field-label" for="modelInput">Model</label>
        <div class="button-group">
          <label class="file-control">
            <input id="modelInput" type="file" accept=".glb,.gltf,.vrm" />
            <span>Load file</span>
          </label>
          <button id="sampleVrmButton" type="button">VRM sample</button>
          <button id="signRigButton" type="button">Sign rig</button>
          <button id="avatarButton" type="button">OSA ref</button>
          <button id="demoButton" type="button">Hand rig</button>
        </div>
      </div>

      <div class="pipeline" aria-label="MVP status">
        <div><span>Model</span><strong id="modelStatus">loading</strong></div>
        <div><span>Controls</span><strong id="boneCount">0</strong></div>
        <div><span>Active</span><strong id="activeBoneName">none</strong></div>
      </div>

      <div class="control-row">
        <label class="field-label" for="controlScope">Control scope</label>
        <select id="controlScope">
          <option value="all">All sign controls</option>
          <option value="fingers">Fingers</option>
          <option value="hands">Hands</option>
          <option value="arms">Arms/shoulders</option>
          <option value="body">Head/body</option>
        </select>
      </div>

      <div class="control-row">
        <label class="field-label" for="boneSelect">Control bone</label>
        <select id="boneSelect"></select>
      </div>

      <fieldset class="control-row">
        <legend class="field-label">Axis</legend>
        <div class="segments" role="radiogroup" aria-label="Rotate axis">
          <label><input type="radio" name="axis" value="x" checked /><span>X</span></label>
          <label><input type="radio" name="axis" value="y" /><span>Y</span></label>
          <label><input type="radio" name="axis" value="z" /><span>Z</span></label>
        </div>
      </fieldset>

      <div class="control-row">
        <div class="range-head">
          <label class="field-label" for="curlRange">Rotate</label>
          <output id="curlValue" for="curlRange">36 deg</output>
        </div>
        <input id="curlRange" type="range" min="-90" max="90" value="36" />
      </div>

      <div class="switch-list">
        <label><input id="autoToggle" type="checkbox" /> Auto move</label>
        <label><input id="chainToggle" type="checkbox" checked /> Rotate chain</label>
        <label><input id="helperToggle" type="checkbox" /> Show bones</label>
      </div>

      <div class="button-pair">
        <button id="poseButton" type="button">Apply pose</button>
        <button id="resetButton" type="button">Reset</button>
      </div>

      <section class="pose-lab" aria-label="Pose library">
        <div class="section-title">
          <h2>Pose library</h2>
          <span>Phase 1</span>
        </div>

        <div class="control-row">
          <label class="field-label" for="poseName">Pose name</label>
          <input id="poseName" type="text" value="chu_A" autocomplete="off" />
        </div>

        <div class="button-pair">
          <button id="savePoseButton" type="button">Save local</button>
          <button id="exportPoseButton" type="button">Export JSON</button>
        </div>

        <label class="file-control import-control">
          <input id="importPoseInput" type="file" accept=".json,application/json" />
          <span>Import Pose JSON</span>
        </label>

        <div class="control-row">
          <label class="field-label" for="savedPoseSelect">Saved poses</label>
          <select id="savedPoseSelect"></select>
        </div>

        <div class="button-pair">
          <button id="loadSavedPoseButton" type="button">Load pose</button>
          <button id="deletePoseButton" type="button">Delete</button>
        </div>

        <div class="control-row">
          <div class="range-head">
            <label class="field-label" for="transitionRange">Transition</label>
            <output id="transitionValue" for="transitionRange">300 ms</output>
          </div>
          <input id="transitionRange" type="range" min="0" max="1200" step="50" value="300" />
        </div>
      </section>

      <section class="ik-lab" aria-label="Wrist inverse kinematics">
        <div class="section-title">
          <h2>Wrist IK</h2>
          <span>Natural arm</span>
        </div>

        <div class="control-row">
          <label class="field-label" for="ikSideSelect">Hand</label>
          <select id="ikSideSelect">
            <option value="left">Left wrist</option>
            <option value="right">Right wrist</option>
          </select>
        </div>

        <div class="control-row">
          <div class="range-head">
            <label class="field-label" for="ikXRange">Target X</label>
            <output id="ikXValue" for="ikXRange">0.00</output>
          </div>
          <input id="ikXRange" type="range" min="-1.2" max="1.2" step="0.01" value="0" />
        </div>

        <div class="control-row">
          <div class="range-head">
            <label class="field-label" for="ikYRange">Target Y</label>
            <output id="ikYValue" for="ikYRange">0.00</output>
          </div>
          <input id="ikYRange" type="range" min="-0.8" max="1.8" step="0.01" value="0" />
        </div>

        <div class="control-row">
          <div class="range-head">
            <label class="field-label" for="ikZRange">Target Z</label>
            <output id="ikZValue" for="ikZRange">0.00</output>
          </div>
          <input id="ikZRange" type="range" min="-0.6" max="1.2" step="0.01" value="0" />
        </div>

        <div class="button-pair">
          <button id="captureWristButton" type="button">Capture wrist</button>
          <button id="clearWristButton" type="button">Clear IK</button>
        </div>

        <div class="queue-status" id="ikStatus">IK waits for a model</div>
      </section>

      <section class="face-lab" aria-label="Facial expression controls">
        <div class="section-title">
          <h2>Face / non-manual</h2>
          <span>Important</span>
        </div>

        <div class="control-row">
          <label class="field-label" for="faceSelect">Expression channel</label>
          <select id="faceSelect"></select>
        </div>

        <div class="control-row">
          <div class="range-head">
            <label class="field-label" for="faceRange">Expression</label>
            <output id="faceValue" for="faceRange">0%</output>
          </div>
          <input id="faceRange" type="range" min="0" max="100" value="0" />
        </div>

        <button id="resetFaceButton" type="button">Reset face</button>
      </section>

      <section class="translator-lab" aria-label="Speech to sign">
        <div class="section-title">
          <h2>Text to sign</h2>
          <span>Phase 2</span>
        </div>

        <div class="control-row">
          <label class="field-label" for="speechText">Input text</label>
          <textarea id="speechText" rows="3">A B C xin chào</textarea>
        </div>

        <div class="button-pair">
          <button id="playTextButton" type="button">Play text</button>
          <button id="listenButton" type="button">Listen</button>
        </div>

        <button id="stopPlaybackButton" type="button">Stop queue</button>

        <div class="queue-status" id="queueStatus">Dictionary loading...</div>
      </section>

      <section class="practice-lab" aria-label="Camera practice">
        <div class="section-title">
          <h2>Camera practice</h2>
          <span>Phase 2.2</span>
        </div>

        <div class="control-row">
          <label class="field-label" for="lessonSelect">Lesson</label>
          <select id="lessonSelect"></select>
        </div>

        <div class="button-pair">
          <button id="startPracticeButton" type="button">Start camera</button>
          <button id="stopPracticeButton" type="button">Stop</button>
        </div>

        <div class="score-meter" aria-label="Practice score">
          <div id="scoreFill"></div>
        </div>
        <div class="queue-status" id="practiceStatus">Camera idle</div>
      </section>

      <pre id="debugLog" aria-live="polite"></pre>
    </aside>

    <section class="stage" aria-label="3D viewport">
      <div id="scene"></div>
      <section class="learner-panel" id="learnerPanel" aria-label="Learner practice">
        <div class="learner-header">
          <div>
            <h2>Practice</h2>
            <strong id="learnerLessonTitle">Lesson C</strong>
          </div>
          <div class="learner-actions">
            <select id="learnerLessonSelect" aria-label="Learner lesson"></select>
            <button id="learnerStartButton" type="button">Start</button>
            <button id="learnerStopButton" type="button">Stop</button>
          </div>
        </div>
        <div class="learner-progress" aria-label="Learner progress">
          <div id="learnerScoreFill"></div>
        </div>
        <div class="learner-metrics">
          <span id="learnerScoreText">0%</span>
          <span id="learnerHandText">No hand</span>
          <span id="learnerPerfText">Render -- fps / AI -- fps</span>
        </div>
      </section>
      <div class="subtitle-bar" id="subtitleBar">
        <span id="subtitleText">Ready</span>
      </div>
      <div class="practice-camera" id="practiceCamera">
        <video id="practiceVideo" autoplay playsinline muted></video>
        <canvas id="landmarkCanvas"></canvas>
        <div class="camera-score">
          <strong id="scoreText">0%</strong>
          <span id="lessonLabel">Lesson C</span>
        </div>
      </div>
      <div class="viewport-badge">
        <span id="sourceBadge">Sign avatar rig</span>
        <span>Three.js</span>
      </div>
    </section>
  </main>
`

const els = {
  appShell: document.querySelector('#appShell'),
  learnerModeButton: document.querySelector('#learnerModeButton'),
  labModeButton: document.querySelector('#labModeButton'),
  scene: document.querySelector('#scene'),
  modelInput: document.querySelector('#modelInput'),
  sampleVrmButton: document.querySelector('#sampleVrmButton'),
  signRigButton: document.querySelector('#signRigButton'),
  avatarButton: document.querySelector('#avatarButton'),
  demoButton: document.querySelector('#demoButton'),
  modelStatus: document.querySelector('#modelStatus'),
  boneCount: document.querySelector('#boneCount'),
  activeBoneName: document.querySelector('#activeBoneName'),
  controlScope: document.querySelector('#controlScope'),
  boneSelect: document.querySelector('#boneSelect'),
  axisInputs: document.querySelectorAll('input[name="axis"]'),
  curlRange: document.querySelector('#curlRange'),
  curlValue: document.querySelector('#curlValue'),
  autoToggle: document.querySelector('#autoToggle'),
  chainToggle: document.querySelector('#chainToggle'),
  helperToggle: document.querySelector('#helperToggle'),
  poseButton: document.querySelector('#poseButton'),
  resetButton: document.querySelector('#resetButton'),
  poseName: document.querySelector('#poseName'),
  savePoseButton: document.querySelector('#savePoseButton'),
  exportPoseButton: document.querySelector('#exportPoseButton'),
  importPoseInput: document.querySelector('#importPoseInput'),
  savedPoseSelect: document.querySelector('#savedPoseSelect'),
  loadSavedPoseButton: document.querySelector('#loadSavedPoseButton'),
  deletePoseButton: document.querySelector('#deletePoseButton'),
  transitionRange: document.querySelector('#transitionRange'),
  transitionValue: document.querySelector('#transitionValue'),
  ikSideSelect: document.querySelector('#ikSideSelect'),
  ikXRange: document.querySelector('#ikXRange'),
  ikXValue: document.querySelector('#ikXValue'),
  ikYRange: document.querySelector('#ikYRange'),
  ikYValue: document.querySelector('#ikYValue'),
  ikZRange: document.querySelector('#ikZRange'),
  ikZValue: document.querySelector('#ikZValue'),
  captureWristButton: document.querySelector('#captureWristButton'),
  clearWristButton: document.querySelector('#clearWristButton'),
  ikStatus: document.querySelector('#ikStatus'),
  faceSelect: document.querySelector('#faceSelect'),
  faceRange: document.querySelector('#faceRange'),
  faceValue: document.querySelector('#faceValue'),
  resetFaceButton: document.querySelector('#resetFaceButton'),
  speechText: document.querySelector('#speechText'),
  playTextButton: document.querySelector('#playTextButton'),
  listenButton: document.querySelector('#listenButton'),
  stopPlaybackButton: document.querySelector('#stopPlaybackButton'),
  queueStatus: document.querySelector('#queueStatus'),
  lessonSelect: document.querySelector('#lessonSelect'),
  learnerLessonSelect: document.querySelector('#learnerLessonSelect'),
  learnerLessonTitle: document.querySelector('#learnerLessonTitle'),
  learnerStartButton: document.querySelector('#learnerStartButton'),
  learnerStopButton: document.querySelector('#learnerStopButton'),
  learnerScoreFill: document.querySelector('#learnerScoreFill'),
  learnerScoreText: document.querySelector('#learnerScoreText'),
  learnerHandText: document.querySelector('#learnerHandText'),
  learnerPerfText: document.querySelector('#learnerPerfText'),
  startPracticeButton: document.querySelector('#startPracticeButton'),
  stopPracticeButton: document.querySelector('#stopPracticeButton'),
  scoreFill: document.querySelector('#scoreFill'),
  practiceStatus: document.querySelector('#practiceStatus'),
  practiceCamera: document.querySelector('#practiceCamera'),
  practiceVideo: document.querySelector('#practiceVideo'),
  landmarkCanvas: document.querySelector('#landmarkCanvas'),
  scoreText: document.querySelector('#scoreText'),
  lessonLabel: document.querySelector('#lessonLabel'),
  subtitleText: document.querySelector('#subtitleText'),
  debugLog: document.querySelector('#debugLog'),
  sourceBadge: document.querySelector('#sourceBadge'),
}

const scene = new THREE.Scene()
scene.background = new THREE.Color(0xf4f8f5)

const FLOOR_Y = -1.05
const MODEL_FLOOR_CLEARANCE = 0.025

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100)
camera.position.set(2.8, 1.7, 4.8)

const renderer = new THREE.WebGLRenderer({ antialias: true })
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
renderer.shadowMap.enabled = true
renderer.shadowMap.type = THREE.PCFShadowMap
els.scene.appendChild(renderer.domElement)

const controls = new OrbitControls(camera, renderer.domElement)
controls.enableDamping = true
controls.target.set(0, 0.48, 0)
controls.minDistance = 2.6
controls.maxDistance = 8

if (import.meta.env.DEV) {
  window.signAvatarLab = {
    state,
    scene,
    camera,
    controls,
  }
}

const keyLight = new THREE.DirectionalLight(0xffffff, 2.8)
keyLight.position.set(3, 5, 4)
keyLight.castShadow = true
keyLight.shadow.mapSize.set(1024, 1024)
scene.add(keyLight)

const fillLight = new THREE.HemisphereLight(0xe9fff7, 0xded5cf, 1.9)
scene.add(fillLight)

const floor = new THREE.Mesh(
  new THREE.CircleGeometry(1.95, 72),
  new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.86,
  }),
)
floor.name = 'soft_shadow_floor'
floor.rotation.x = -Math.PI / 2
floor.position.y = FLOOR_Y
floor.receiveShadow = true
scene.add(floor)

const loader = new GLTFLoader()
loader.register((parser) => new VRMLoaderPlugin(parser))

let lastFrameTime = performance.now()

function resize() {
  const { clientWidth, clientHeight } = els.scene
  renderer.setSize(clientWidth, clientHeight, false)
  camera.aspect = clientWidth / clientHeight
  camera.updateProjectionMatrix()
}

function setLog(lines) {
  els.debugLog.textContent = lines.join('\n')
}

function updateStatus() {
  els.modelStatus.textContent = state.sourceName
  els.boneCount.textContent = `${state.controlBones.length}/${state.allBones.length}`
  els.activeBoneName.textContent = state.activeBone?.name || 'none'
  els.sourceBadge.textContent = state.sourceName

  const activeName = state.activeBone?.name || 'none'
  setLog([
    `model: ${state.sourceName}`,
    `signControls: ${state.controlBones.length} bone(s)`,
    `faceChannels: ${state.faceControls.length}`,
    state.vrm ? `vrmMappedControls: ${state.model?.userData?.vrmMappedControlCount || 0}` : 'vrmMappedControls: n/a',
    state.vrm ? `restPose: ${state.model?.userData?.signingReadyPose || 'vrm-default'}` : 'restPose: model default',
    `wristIK: ${state.wristTargets.size} target(s)`,
    `activeBone: ${activeName}`,
    `rotate axis: ${state.axis.toUpperCase()}`,
    state.usedFallback ? 'fallback: showing every bone' : 'fallback: no',
  ])
}

function setQueueStatus(text) {
  els.queueStatus.textContent = text
}

function setSubtitle(text = 'Ready') {
  els.subtitleText.textContent = text
}

function setPracticeStatus(text) {
  els.practiceStatus.textContent = text
  els.learnerHandText.textContent = text
}

function updateScore(score) {
  state.practice.score = score
  els.scoreText.textContent = `${score}%`
  els.scoreFill.style.width = `${score}%`
  els.learnerScoreText.textContent = `${score}%`
  els.learnerScoreFill.style.width = `${score}%`
}

function updatePerformanceText() {
  const renderFps = state.performance.renderFps ? `${state.performance.renderFps}` : '--'
  const aiFps = state.practice.measuredFps ? `${state.practice.measuredFps}` : '--'
  const skipped = state.practice.skippedFrames
  const text = `Render ${renderFps} fps / AI ${aiFps} fps / Skip ${skipped}`

  els.learnerPerfText.textContent = text
}

function setMode(mode) {
  state.mode = mode
  els.appShell.classList.toggle('learner-mode', mode === 'learner')
  els.appShell.classList.toggle('lab-mode', mode !== 'learner')
  els.learnerModeButton.classList.toggle('is-active', mode === 'learner')
  els.labModeButton.classList.toggle('is-active', mode !== 'learner')
  resize()
}

function setActiveBoneByName(name) {
  state.activeBone = state.controlBones.find((bone) => bone.name === name) || null
  if (state.activeBone) {
    setAxis(preferredAxisForBone(state.activeBone))
  }
  els.activeBoneName.textContent = state.activeBone?.name || 'none'
  updateRotationControlsFromActiveBone()
  updateStatus()
}

function fillBoneSelect() {
  els.boneSelect.innerHTML = ''
  const scope = els.controlScope.value
  state.filteredControlBones = scope === 'all'
    ? state.controlBones
    : state.controlBones.filter((bone) => bone.userData.signPart === scope)

  if (state.filteredControlBones.length === 0) {
    state.filteredControlBones = state.controlBones
  }

  for (const bone of state.filteredControlBones) {
    const option = document.createElement('option')
    option.value = bone.name
    option.textContent = bone.name
    els.boneSelect.append(option)
  }

  if (!state.filteredControlBones.includes(state.activeBone)) {
    state.activeBone = state.filteredControlBones[0] || state.controlBones[0] || null
    if (state.activeBone) {
      setAxis(preferredAxisForBone(state.activeBone))
    }
  }

  if (state.activeBone) {
    els.boneSelect.value = state.activeBone.name
  }

  updateRotationControlsFromActiveBone()
}

function setAxis(axis) {
  state.axis = axis
  els.axisInputs.forEach((input) => {
    input.checked = input.value === axis
  })
  updateRotationControlsFromActiveBone()
}

function preferredAxisForBone(bone) {
  if (bone?.userData?.preferredAxis) return bone.userData.preferredAxis
  return /mixamorig/i.test(bone?.name || '') ? 'z' : 'x'
}

function updateRotationControlsFromActiveBone() {
  if (!state.activeBone) return

  const offset = getBoneOffset(state.poseOffsets, state.activeBone.name)
  const degrees = THREE.MathUtils.radToDeg(offset[state.axis] || 0)
  state.curl = THREE.MathUtils.degToRad(degrees)
  els.curlRange.value = String(Math.round(degrees))
  updateCurlValue(degrees)
}

function updateTransitionValue(ms) {
  state.transitionMs = Number(ms)
  els.transitionValue.value = `${state.transitionMs} ms`
  els.transitionValue.textContent = `${state.transitionMs} ms`
}

function setIkStatus(text) {
  els.ikStatus.textContent = text
}

function setIkOutput(axis, value) {
  const formatted = Number(value || 0).toFixed(2)
  els[`ik${axis}Value`].value = formatted
  els[`ik${axis}Value`].textContent = formatted
}

function setIkRange(axis, value) {
  els[`ik${axis}Range`].value = String(Number(value || 0).toFixed(2))
  setIkOutput(axis, value)
}

function previewWristTarget(side = state.activeIkSide) {
  return state.wristTargets.get(side) || captureWristTarget(state.model, state.controlBones, side)
}

function refreshIkControls() {
  const side = state.activeIkSide
  const target = previewWristTarget(side)
  els.ikSideSelect.value = side

  if (!target?.position) {
    setIkRange('X', 0)
    setIkRange('Y', 0)
    setIkRange('Z', 0)
    setIkStatus('No wrist chain found')
    return
  }

  setIkRange('X', target.position.x)
  setIkRange('Y', target.position.y)
  setIkRange('Z', target.position.z)
  setIkStatus(state.wristTargets.has(side) ? `${side} wrist IK active` : `${side} wrist preview`)
}

function updateIkRangeLabels() {
  setIkOutput('X', els.ikXRange.value)
  setIkOutput('Y', els.ikYRange.value)
  setIkOutput('Z', els.ikZRange.value)
}

function applyIkTargetFromControls() {
  const side = state.activeIkSide
  const preview = previewWristTarget(side)

  if (!preview?.position) return

  const target = cloneWristTarget(preview)
  target.position.x = Number(els.ikXRange.value)
  target.position.y = Number(els.ikYRange.value)
  target.position.z = Number(els.ikZRange.value)
  state.wristTargets.set(side, target)
  state.transition = null
  updateIkRangeLabels()
  applyPoseOffsets()
  setIkStatus(`${side} wrist IK active`)
}

function refreshSavedPoseSelect(selectedName = '') {
  state.savedPoses = readStoredPoses()
  refreshSignDictionary()
  els.savedPoseSelect.innerHTML = ''

  if (state.savedPoses.length === 0) {
    const option = document.createElement('option')
    option.value = ''
    option.textContent = 'No saved poses'
    els.savedPoseSelect.append(option)
    return
  }

  for (const pose of state.savedPoses) {
    const option = document.createElement('option')
    option.value = pose.name
    option.textContent = pose.name
    els.savedPoseSelect.append(option)
  }

  if (selectedName) {
    els.savedPoseSelect.value = selectedName
  }
}

function refreshSignDictionary() {
  state.signDictionary = createPoseDictionary(state.seedEntries, state.savedPoses)

  if (els.queueStatus) {
    setQueueStatus(`${state.signDictionary.size} signs ready`)
  }
}

function fillFaceSelect() {
  els.faceSelect.innerHTML = ''

  if (state.faceControls.length === 0) {
    const option = document.createElement('option')
    option.value = ''
    option.textContent = 'No face channels'
    els.faceSelect.append(option)
    els.faceRange.disabled = true
    els.resetFaceButton.disabled = true
    return
  }

  els.faceRange.disabled = false
  els.resetFaceButton.disabled = false

  for (const control of state.faceControls) {
    const option = document.createElement('option')
    option.value = control.name
    option.textContent = control.name
    els.faceSelect.append(option)
  }

  state.activeFaceControl = state.faceControls[0]
  els.faceSelect.value = state.activeFaceControl.name
  updateFaceControlsFromActive()
}

function updateFaceControlsFromActive() {
  if (!state.activeFaceControl) {
    els.faceValue.textContent = '0%'
    els.faceRange.value = '0'
    return
  }

  const value = readFaceValue(state.faceValues, state.activeFaceControl.name)
  els.faceRange.value = String(Math.round(value * 100))
  els.faceValue.value = `${Math.round(value * 100)}%`
  els.faceValue.textContent = `${Math.round(value * 100)}%`
}

function removeCurrentModel() {
  if (state.helper) {
    scene.remove(state.helper)
    state.helper.geometry.dispose()
    state.helper = null
  }

  if (state.model) {
    scene.remove(state.model)
    state.model = null
  }

  state.vrm = null
}

function normalizeImportedModel(model) {
  const box = new THREE.Box3().setFromObject(model)
  const size = new THREE.Vector3()
  const center = new THREE.Vector3()
  box.getSize(size)
  box.getCenter(center)

  const maxSide = Math.max(size.x, size.y, size.z) || 1
  const scale = 2.8 / maxSide
  model.scale.setScalar(scale)
  model.position.sub(center.multiplyScalar(scale))

  model.updateWorldMatrix(true, true)
  const alignedBox = new THREE.Box3().setFromObject(model)
  const floorOffset = FLOOR_Y + MODEL_FLOOR_CLEARANCE - alignedBox.min.y
  model.position.y += floorOffset
  model.userData.floorAlignment = {
    floorY: FLOOR_Y,
    clearance: MODEL_FLOOR_CLEARANCE,
    offset: Number(floorOffset.toFixed(4)),
  }

  model.traverse((node) => {
    if (!node.isMesh) return
    node.castShadow = true
    node.receiveShadow = true
    node.frustumCulled = false
  })
}

function inspectModel(model, sourceName, options = {}) {
  removeCurrentModel()

  state.model = model
  state.vrm = options.vrm || null
  state.sourceName = sourceName
  cacheRestPose(model)
  scene.add(model)

  state.helper = new THREE.SkeletonHelper(model)
  state.helper.visible = els.helperToggle.checked
  state.helper.material.linewidth = 2
  scene.add(state.helper)

  const result = findSignControlBones(model)
  state.allBones = result.allBones
  state.controlBones = result.controlBones
  state.fingerBones = result.fingerBones
  state.faceControls = collectFaceControls(model)
  state.faceValues = new Map()
  state.usedFallback = result.usedFallback
  state.poseOffsets = new Map()
  state.wristTargets = new Map()
  state.transition = null
  stopPlayback()
  state.seedEntries = createSeedDictionary(state.controlBones, sourceName, state.faceControls)
  state.activeBone = state.controlBones.find((bone) => /left.*index.*0?1/i.test(bone.name)) ||
    state.controlBones.find((bone) => /lefthandindex1/i.test(bone.name)) ||
    state.controlBones.find((bone) => /index/i.test(bone.name)) ||
    state.controlBones[0] ||
    null
  setAxis(preferredAxisForBone(state.activeBone))

  fillBoneSelect()
  fillFaceSelect()
  refreshSavedPoseSelect()
  updateStatus()
  applyPoseOffsets()
  focusCameraOnActiveBone()
  refreshIkControls()
}

async function loadDemoHandModel() {
  const model = createDemoHandRig()
  inspectModel(model, 'Hand rig')
}

async function loadSignAvatarModel() {
  const model = createSignAvatarRig()
  inspectModel(model, 'Sign avatar rig')
}

function loadGltfFromUrl(url) {
  return new Promise((resolve, reject) => {
    loader.load(url, resolve, undefined, reject)
  })
}

function prepareLoadedGltf(gltf, sourceName) {
  const vrm = gltf.userData?.vrm

  if (vrm) {
    const model = prepareVrmForSignLab(vrm)
    normalizeImportedModel(model)
    return { model, vrm, sourceName }
  }

  normalizeImportedModel(gltf.scene)
  return { model: gltf.scene, vrm: null, sourceName }
}

async function loadSampleVrmAvatar() {
  els.modelStatus.textContent = 'loading'

  try {
    const gltf = await loadGltfFromUrl(DEFAULT_VRM_AVATAR.url)
    const prepared = prepareLoadedGltf(gltf, DEFAULT_VRM_AVATAR.name)
    inspectModel(prepared.model, prepared.sourceName, { vrm: prepared.vrm })
  } catch (error) {
    console.error('Sample VRM load failed', error)
    setLog([
      `Could not load ${DEFAULT_VRM_AVATAR.url}`,
      error.message || String(error),
      'Falling back to generated sign rig.',
    ])
    await loadSignAvatarModel()
  }
}

async function loadDefaultAvatar() {
  els.modelStatus.textContent = 'loading'

  try {
    const gltf = await loadGltfFromUrl(REFERENCE_AVATAR.url)
    const prepared = prepareLoadedGltf(gltf, REFERENCE_AVATAR.name)
    inspectModel(prepared.model, prepared.sourceName, { vrm: prepared.vrm })
  } catch (error) {
    console.error('Default avatar load failed', error)
    setLog([
      `Could not load ${REFERENCE_AVATAR.url}`,
      error.message || String(error),
      'Falling back to generated sign rig.',
    ])
    await loadSignAvatarModel()
  }
}

function loadGltfFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)

    loader.load(
      url,
      (gltf) => {
        URL.revokeObjectURL(url)
        resolve(gltf)
      },
      undefined,
      (error) => {
        URL.revokeObjectURL(url)
        reject(error)
      },
    )
  })
}

function selectedRotationChain() {
  if (!state.activeBone) return []
  return state.chain ? collectBoneChain(state.activeBone) : [state.activeBone]
}

function applyRotationControlToChain() {
  const chain = selectedRotationChain()

  chain.forEach((bone, index) => {
    const falloff = Math.max(0.45, 1 - index * 0.2)
    setBoneAxisOffset(state.poseOffsets, bone.name, state.axis, state.curl * falloff)
  })
}

function focusCameraOnActiveBone() {
  if (!state.activeBone) return

  const target = new THREE.Vector3()
  state.activeBone.updateWorldMatrix(true, false)
  state.activeBone.getWorldPosition(target)

  if (state.sourceName === 'Hand rig') {
    target.set(0, 0.48, 0)
    camera.position.set(2.8, 1.7, 4.8)
  } else if (state.sourceName === 'Sign avatar rig') {
    target.set(0, 0.08, 0.02)
    camera.position.set(2.45, 1.1, 4.35)
  } else if (state.vrm) {
    target.set(0, 0.12, 0)
    camera.position.set(2.2, 1.0, 4.2)
  } else {
    camera.position.copy(target).add(new THREE.Vector3(0.55, 0.28, 1.25))
  }

  controls.target.copy(target)
  controls.update()
}

function applyPoseOffsets(updateUi = true) {
  if (!state.model) return

  restoreRestPose(state.model)

  state.controlBones.forEach((bone) => {
    applyBoneOffset(bone, getBoneOffset(state.poseOffsets, bone.name))
  })
  applyFaceValues(state.faceControls, state.faceValues)
  applyArmIkTargets(state.model, state.controlBones, state.wristTargets)

  if (updateUi) {
    updateStatus()
  }
}

function targetQuaternionsForOffsets(offsets) {
  const targets = new Map()

  state.controlBones.forEach((bone) => {
    targets.set(bone.name, makeTargetQuaternion(bone, getBoneOffset(offsets, bone.name)))
  })

  return targets
}

function transitionToOffsets(targetOffsets, duration = state.transitionMs) {
  transitionToPoseState(targetOffsets, state.faceValues, duration, state.wristTargets)
}

function transitionToPoseState(
  targetOffsets,
  targetFaceValues = state.faceValues,
  duration = state.transitionMs,
  targetWristTargets = new Map(),
) {
  if (!state.model || duration <= 0) {
    state.poseOffsets = cloneOffsets(targetOffsets)
    state.faceValues = cloneFaceValues(targetFaceValues)
    state.wristTargets = cloneWristTargets(targetWristTargets)
    applyPoseOffsets()
    refreshIkControls()
    return
  }

  const startQuaternions = new Map()
  state.controlBones.forEach((bone) => {
    startQuaternions.set(bone.name, bone.quaternion.clone())
  })
  const startFaceValues = cloneFaceValues(state.faceValues)

  state.transition = {
    startTime: performance.now(),
    duration,
    startQuaternions,
    targetQuaternions: targetQuaternionsForOffsets(targetOffsets),
    targetOffsets: cloneOffsets(targetOffsets),
    startFaceValues,
    targetFaceValues: cloneFaceValues(targetFaceValues),
    startWristTargets: captureWristTargets(state.model, state.controlBones),
    targetWristTargets: cloneWristTargets(targetWristTargets),
  }
}

function transitionToPose(targetPose, duration = state.transitionMs) {
  transitionToPoseState(
    poseToOffsets(targetPose, state.controlBones),
    faceMapFromObject(targetPose?.face, state.faceControls),
    duration,
    poseToWristTargets(targetPose),
  )
}

function easeSignMotion(rawT) {
  const settleStart = 0.72

  if (rawT <= settleStart) {
    const t = rawT / settleStart
    return 0.9 * (1 - ((1 - t) ** 3))
  }

  const t = (rawT - settleStart) / (1 - settleStart)
  const settle = t * t * t * (t * (t * 6 - 15) + 10)
  return 0.9 + settle * 0.1
}

function updateTransition(time) {
  if (!state.transition) return false

  const elapsed = time - state.transition.startTime
  const rawT = Math.min(1, elapsed / state.transition.duration)
  const easedT = easeSignMotion(rawT)

  state.controlBones.forEach((bone) => {
    const start = state.transition.startQuaternions.get(bone.name)
    const target = state.transition.targetQuaternions.get(bone.name)
    if (!start || !target) return

    bone.quaternion.slerpQuaternions(start, target, easedT)
  })
  state.faceControls.forEach((control) => {
    const start = readFaceValue(state.transition.startFaceValues, control.name)
    const target = readFaceValue(state.transition.targetFaceValues, control.name)
    setFaceControlValue(control, THREE.MathUtils.lerp(start, target, easedT))
  })
  const wristTargets = interpolateWristTargets(
    state.transition.startWristTargets,
    state.transition.targetWristTargets,
    easedT,
  )
  applyArmIkTargets(state.model, state.controlBones, wristTargets)

  if (rawT >= 1) {
    state.poseOffsets = state.transition.targetOffsets
    state.faceValues = state.transition.targetFaceValues
    state.wristTargets = state.transition.targetWristTargets
    state.transition = null
    applyPoseOffsets(false)
    updateRotationControlsFromActiveBone()
    updateFaceControlsFromActive()
    refreshIkControls()
    updateStatus()
  }

  return true
}

function captureCurrentPose() {
  applyPoseOffsets(false)
  const wristTargets = captureWristTargets(state.model, state.controlBones)

  return serializePose({
    name: els.poseName.value,
    sourceName: state.sourceName,
    controlBones: state.controlBones,
    poseOffsets: state.poseOffsets,
    faceValues: state.faceValues,
    faceControls: state.faceControls,
    wristTargets,
  })
}

function loadPose(pose) {
  state.auto = false
  els.autoToggle.checked = false
  els.poseName.value = pose.name || normalizePoseName(els.poseName.value)
  transitionToPose(pose)
}

function stopPlayback(message = 'Queue stopped') {
  state.playback.playing = false
  state.playback.queue = []
  state.playback.index = 0
  state.playback.waitUntil = 0
  state.playback.missing = []
  setSubtitle('Ready')

  if (els.queueStatus) {
    setQueueStatus(message)
  }
}

function buildQueueFromText(text) {
  const tokens = tokenizeTextToSigns(text)
  const queue = []
  const missing = []

  for (const item of tokens) {
    const entry = state.signDictionary.get(item.token)

    if (entry?.pose) {
      queue.push({
        token: item.token,
        label: entry.label || item.label,
        source: item.source,
        pose: entry.pose,
      })
    } else {
      missing.push(item.label || item.token)
    }
  }

  return { tokens, queue, missing }
}

function playNextQueuedPose(time = performance.now()) {
  if (!state.playback.playing) return

  if (state.playback.index >= state.playback.queue.length) {
    const missingText = state.playback.missing.length
      ? ` Missing: ${state.playback.missing.join(', ')}.`
      : ''
    stopPlayback(`Done: ${state.playback.queue.length} sign(s).${missingText}`)
    return
  }

  const item = state.playback.queue[state.playback.index]
  state.playback.index += 1
  state.playback.waitUntil = time + state.transitionMs + state.playback.holdMs
  setSubtitle(item.label)
  setQueueStatus(`Playing ${state.playback.index}/${state.playback.queue.length}: ${item.label}`)
  transitionToPose(item.pose)
}

function playTextAsSigns(text) {
  const { tokens, queue, missing } = buildQueueFromText(text)

  if (queue.length === 0) {
    stopPlayback(tokens.length ? `No matching poses. Missing: ${missing.join(', ')}` : 'No input text')
    return
  }

  state.auto = false
  els.autoToggle.checked = false
  state.playback = {
    ...state.playback,
    playing: true,
    queue,
    index: 0,
    waitUntil: 0,
    missing,
  }

  playNextQueuedPose()
}

function updatePlayback(time, isTransitioning) {
  if (!state.playback.playing || isTransitioning || time < state.playback.waitUntil) {
    return
  }

  playNextQueuedPose(time)
}

function setupSpeechRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition

  if (!Recognition) {
    els.listenButton.disabled = true
    els.listenButton.title = 'SpeechRecognition is not available in this browser.'
    return
  }

  state.recognizer = new Recognition()
  state.recognizer.lang = 'vi-VN'
  state.recognizer.interimResults = false
  state.recognizer.continuous = false

  state.recognizer.addEventListener('result', (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript || '')
      .join(' ')
      .trim()

    if (transcript) {
      els.speechText.value = transcript
      playTextAsSigns(transcript)
    }
  })

  state.recognizer.addEventListener('end', () => {
    els.listenButton.textContent = 'Listen'
  })

  state.recognizer.addEventListener('error', (event) => {
    els.listenButton.textContent = 'Listen'
    setQueueStatus(`Speech error: ${event.error}`)
  })
}

function fillPracticeLessons() {
  els.lessonSelect.innerHTML = ''
  els.learnerLessonSelect.innerHTML = ''

  for (const lesson of PRACTICE_LESSONS) {
    const option = document.createElement('option')
    option.value = lesson.token
    option.textContent = lesson.label
    els.lessonSelect.append(option)

    const learnerOption = document.createElement('option')
    learnerOption.value = lesson.token
    learnerOption.textContent = lesson.label
    els.learnerLessonSelect.append(learnerOption)
  }

  els.lessonSelect.value = state.practice.lesson.token
  els.learnerLessonSelect.value = state.practice.lesson.token
  els.lessonLabel.textContent = `Lesson ${state.practice.lesson.label}`
  els.learnerLessonTitle.textContent = `Lesson ${state.practice.lesson.label}`
}

function selectPracticeLesson(token, playSample = true) {
  state.practice.lesson =
    PRACTICE_LESSONS.find((lesson) => lesson.token === token) || PRACTICE_LESSONS[0]
  els.lessonSelect.value = state.practice.lesson.token
  els.learnerLessonSelect.value = state.practice.lesson.token
  els.lessonLabel.textContent = `Lesson ${state.practice.lesson.label}`
  els.learnerLessonTitle.textContent = `Lesson ${state.practice.lesson.label}`

  if (!playSample) return

  const entry = state.signDictionary.get(state.practice.lesson.token)
  if (entry?.pose) {
    playTextAsSigns(state.practice.lesson.label)
  }
}

async function loadHandLandmarker() {
  if (state.practice.handLandmarker) return state.practice.handLandmarker

  setPracticeStatus('Loading MediaPipe...')
  const vision = await FilesetResolver.forVisionTasks(
    'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  )

  state.practice.handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
      delegate: 'GPU',
    },
    runningMode: 'VIDEO',
    numHands: 2,
    minHandDetectionConfidence: 0.5,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })

  return state.practice.handLandmarker
}

function drawLandmarks(landmarks) {
  const canvas = els.landmarkCanvas
  const video = els.practiceVideo
  const ctx = canvas.getContext('2d')
  const width = video.videoWidth || 320
  const height = video.videoHeight || 240

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
  }

  ctx.clearRect(0, 0, width, height)
  if (!landmarks?.length) return

  ctx.lineWidth = 3
  ctx.strokeStyle = '#19a88a'
  ctx.fillStyle = '#ffffff'

  for (const hand of landmarks) {
    for (const [from, to] of HAND_CONNECTIONS) {
      const a = hand[from]
      const b = hand[to]
      ctx.beginPath()
      ctx.moveTo(a.x * width, a.y * height)
      ctx.lineTo(b.x * width, b.y * height)
      ctx.stroke()
    }

    for (const point of hand) {
      ctx.beginPath()
      ctx.arc(point.x * width, point.y * height, 4, 0, Math.PI * 2)
      ctx.fill()
    }
  }
}

function evaluatePracticeFrame(result) {
  const firstHand = result.landmarks?.[0]
  const firstWorldHand = result.worldLandmarks?.[0]
  const handedness = result.handednesses?.[0]?.[0]?.categoryName || ''
  state.practice.lastHandedness = handedness
  drawLandmarks(result.landmarks)

  if (!firstHand) {
    updateScore(0)
    setPracticeStatus('No hand detected')
    return
  }

  const features = extractHandFeatures(firstWorldHand || firstHand, { handedness })
  const scoreResult = scorePractice(features, state.practice.lesson)
  updateScore(scoreResult.score)
  const palmDetail = scoreResult.details.find((detail) => detail.key === 'palmNormalZ')
  const statusHint = palmDetail && palmDetail.similarity < 0.45 ? ' - check palm direction' : ''
  const mirrorHint = scoreResult.mirrored ? ' - mirrored hand accepted' : ''
  const handHint = handedness ? `${handedness} hand` : 'Hand'
  setPracticeStatus(`${handHint}: ${state.practice.lesson.label} ${scoreResult.score}%${mirrorHint}${statusHint}`)

  if (scoreResult.score >= 85) {
    setSubtitle(`${state.practice.lesson.label} matched`)
  }
}

function practiceLoop() {
  if (!state.practice.running) return

  const video = els.practiceVideo
  const now = performance.now()
  const canDetect = now - state.practice.lastDetectAt >= state.practice.frameIntervalMs

  if (
    canDetect &&
    state.practice.handLandmarker &&
    video.readyState >= 2 &&
    video.currentTime !== state.practice.lastVideoTime
  ) {
    const result = state.practice.handLandmarker.detectForVideo(video, now)
    evaluatePracticeFrame(result)
    state.practice.lastVideoTime = video.currentTime
    state.practice.lastDetectAt = now
    state.practice.detectedFrames += 1
  } else if (state.practice.handLandmarker && video.readyState >= 2) {
    state.practice.skippedFrames += 1
  }

  if (now - state.practice.lastFpsAt >= 1000) {
    state.practice.measuredFps = state.practice.detectedFrames
    state.practice.detectedFrames = 0
    state.practice.skippedFrames = 0
    state.practice.lastFpsAt = now
    updatePerformanceText()
  }

  requestAnimationFrame(practiceLoop)
}

async function startPracticeCamera() {
  try {
    await loadHandLandmarker()
    state.practice.stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
      },
      audio: false,
    })

    els.practiceVideo.srcObject = state.practice.stream
    await els.practiceVideo.play()
    state.practice.running = true
    state.practice.lastVideoTime = -1
    state.practice.lastDetectAt = 0
    state.practice.lastFpsAt = performance.now()
    state.practice.detectedFrames = 0
    state.practice.skippedFrames = 0
    state.practice.measuredFps = 0
    els.practiceCamera.classList.add('is-active')
    setPracticeStatus('Camera running')
    updatePerformanceText()
    practiceLoop()
  } catch (error) {
    setPracticeStatus(`Camera error: ${error.message || error}`)
  }
}

function stopPracticeCamera() {
  state.practice.running = false

  if (state.practice.stream) {
    state.practice.stream.getTracks().forEach((track) => track.stop())
    state.practice.stream = null
  }

  els.practiceVideo.srcObject = null
  els.practiceCamera.classList.remove('is-active')
  drawLandmarks([])
  updateScore(0)
  setPracticeStatus('Camera idle')
  state.practice.measuredFps = 0
  updatePerformanceText()
}

function updateCurlValue(degrees) {
  els.curlValue.value = `${Math.round(degrees)} deg`
  els.curlValue.textContent = `${Math.round(degrees)} deg`
}

els.modelInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  els.modelStatus.textContent = 'loading'

  try {
    const gltf = await loadGltfFromFile(file)
    const prepared = prepareLoadedGltf(gltf, file.name)
    inspectModel(prepared.model, prepared.sourceName, { vrm: prepared.vrm })
  } catch (error) {
    setLog(['load error:', error.message || String(error)])
  }
})

els.learnerModeButton.addEventListener('click', () => {
  setMode('learner')
})

els.labModeButton.addEventListener('click', () => {
  setMode('lab')
})

els.demoButton.addEventListener('click', () => {
  els.modelInput.value = ''
  loadDemoHandModel()
})

els.sampleVrmButton.addEventListener('click', () => {
  els.modelInput.value = ''
  loadSampleVrmAvatar()
})

els.signRigButton.addEventListener('click', () => {
  els.modelInput.value = ''
  loadSignAvatarModel()
})

els.avatarButton.addEventListener('click', () => {
  els.modelInput.value = ''
  loadDefaultAvatar()
})

els.boneSelect.addEventListener('change', (event) => {
  setActiveBoneByName(event.target.value)
})

els.controlScope.addEventListener('change', () => {
  fillBoneSelect()
  updateStatus()
})

els.axisInputs.forEach((input) => {
  input.addEventListener('change', () => {
    setAxis(input.value)
    updateStatus()
  })
})

els.curlRange.addEventListener('input', (event) => {
  const degrees = Number(event.target.value)
  state.curl = THREE.MathUtils.degToRad(degrees)
  state.auto = false
  state.transition = null
  els.autoToggle.checked = false
  updateCurlValue(degrees)
  applyRotationControlToChain()
  applyPoseOffsets()
})

els.autoToggle.addEventListener('change', (event) => {
  state.auto = event.target.checked
})

els.chainToggle.addEventListener('change', (event) => {
  state.chain = event.target.checked
  applyRotationControlToChain()
  applyPoseOffsets()
})

els.helperToggle.addEventListener('change', (event) => {
  if (state.helper) {
    state.helper.visible = event.target.checked
  }
})

els.poseButton.addEventListener('click', () => {
  state.auto = false
  state.transition = null
  els.autoToggle.checked = false
  applyRotationControlToChain()
  applyPoseOffsets()
})

els.resetButton.addEventListener('click', () => {
  state.auto = false
  state.curl = 0
  state.poseOffsets = new Map()
  state.faceValues = new Map()
  state.wristTargets = new Map()
  state.transition = null
  els.autoToggle.checked = false
  els.curlRange.value = '0'
  updateCurlValue(0)
  updateFaceControlsFromActive()
  applyPoseOffsets()
  refreshIkControls()
})

els.faceSelect.addEventListener('change', (event) => {
  state.activeFaceControl = state.faceControls.find((control) => control.name === event.target.value) || null
  updateFaceControlsFromActive()
})

els.faceRange.addEventListener('input', (event) => {
  if (!state.activeFaceControl) return

  state.auto = false
  state.transition = null
  els.autoToggle.checked = false
  state.faceValues.set(state.activeFaceControl.name, Number(event.target.value) / 100)
  updateFaceControlsFromActive()
  applyPoseOffsets()
})

els.resetFaceButton.addEventListener('click', () => {
  state.faceValues = new Map()
  updateFaceControlsFromActive()
  applyPoseOffsets()
})

els.transitionRange.addEventListener('input', (event) => {
  updateTransitionValue(event.target.value)
})

els.ikSideSelect.addEventListener('change', (event) => {
  state.activeIkSide = event.target.value
  refreshIkControls()
})

;[els.ikXRange, els.ikYRange, els.ikZRange].forEach((input) => {
  input.addEventListener('input', applyIkTargetFromControls)
})

els.captureWristButton.addEventListener('click', () => {
  const target = captureWristTarget(state.model, state.controlBones, state.activeIkSide)
  if (!target) {
    setIkStatus('No wrist chain found')
    return
  }

  state.wristTargets.set(state.activeIkSide, target)
  state.transition = null
  refreshIkControls()
  applyPoseOffsets()
})

els.clearWristButton.addEventListener('click', () => {
  state.wristTargets.delete(state.activeIkSide)
  state.transition = null
  applyPoseOffsets()
  refreshIkControls()
})

els.savePoseButton.addEventListener('click', () => {
  const pose = captureCurrentPose()
  upsertStoredPose(pose)
  refreshSavedPoseSelect(pose.name)
  setLog([`saved: ${pose.name}`, `${Object.keys(pose.bones).length} bone rotations`, 'storage: localStorage'])
})

els.exportPoseButton.addEventListener('click', () => {
  const pose = captureCurrentPose()
  downloadPoseJson(pose)
  setLog([`exported: ${pose.name}`, `${Object.keys(pose.bones).length} bone rotations`, 'format: pose JSON v3'])
})

els.importPoseInput.addEventListener('change', async (event) => {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    const pose = JSON.parse(await file.text())
    loadPose(pose)
    setLog([`imported: ${pose.name || file.name}`, `matched bones: ${poseToOffsets(pose, state.controlBones).size}`, 'transition: on'])
  } catch (error) {
    setLog(['pose import error:', error.message || String(error)])
  } finally {
    els.importPoseInput.value = ''
  }
})

els.loadSavedPoseButton.addEventListener('click', () => {
  const pose = state.savedPoses.find((item) => item.name === els.savedPoseSelect.value)
  if (!pose) return

  loadPose(pose)
  setLog([`loaded: ${pose.name}`, `matched bones: ${poseToOffsets(pose, state.controlBones).size}`, 'source: localStorage'])
})

els.deletePoseButton.addEventListener('click', () => {
  const name = els.savedPoseSelect.value
  if (!name) return

  removeStoredPose(name)
  refreshSavedPoseSelect()
  setLog([`deleted: ${name}`, 'storage: localStorage'])
})

els.playTextButton.addEventListener('click', () => {
  playTextAsSigns(els.speechText.value)
})

els.stopPlaybackButton.addEventListener('click', () => {
  stopPlayback()
  state.transition = null
})

els.listenButton.addEventListener('click', () => {
  if (!state.recognizer) return

  els.listenButton.textContent = 'Listening...'
  state.recognizer.start()
})

els.lessonSelect.addEventListener('change', (event) => {
  selectPracticeLesson(event.target.value)
})

els.learnerLessonSelect.addEventListener('change', (event) => {
  selectPracticeLesson(event.target.value)
})

els.startPracticeButton.addEventListener('click', startPracticeCamera)
els.stopPracticeButton.addEventListener('click', stopPracticeCamera)
els.learnerStartButton.addEventListener('click', startPracticeCamera)
els.learnerStopButton.addEventListener('click', stopPracticeCamera)

function animate(time) {
  requestAnimationFrame(animate)

  const delta = Math.min((time - lastFrameTime) / 1000, 0.05)
  lastFrameTime = time
  state.performance.renderFrames += 1

  if (time - state.performance.lastRenderFpsAt >= 1000) {
    state.performance.renderFps = state.performance.renderFrames
    state.performance.renderFrames = 0
    state.performance.lastRenderFpsAt = time
    updatePerformanceText()
  }

  const isTransitioning = updateTransition(time)
  updatePlayback(time, isTransitioning)

  if (!state.playback.playing && !isTransitioning && state.auto && state.model && state.activeBone) {
    const degrees = 36 + Math.sin(time * 0.0024) * 28
    state.curl = THREE.MathUtils.degToRad(degrees)
    els.curlRange.value = String(Math.round(degrees))
    updateCurlValue(degrees)
    applyRotationControlToChain()
    applyPoseOffsets(false)
  }

  controls.update()
  if (state.vrm) {
    state.vrm.update(delta)
  }
  renderer.render(scene, camera)
}

resize()
window.addEventListener('resize', resize)
updateTransitionValue(state.transitionMs)
refreshSavedPoseSelect()
setupSpeechRecognition()
fillPracticeLessons()
updatePerformanceText()
setMode('lab')
loadSampleVrmAvatar()
requestAnimationFrame(animate)
