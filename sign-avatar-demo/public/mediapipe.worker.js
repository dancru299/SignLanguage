// public/mediapipe.worker.js - Classic Web Worker with Local Assets
self.module = { exports: {} };
self.exports = self.module.exports;

// Import the local bundle of MediaPipe Tasks Vision
importScripts('/vision_bundle.cjs');

// Destructure modules from our CommonJS exports polyfill
const { FilesetResolver, HandLandmarker } = self.module.exports;

let landmarker = null;

async function initLandmarker() {
  try {
    // Load WASM from local public/wasm directory
    const vision = await FilesetResolver.forVisionTasks('/wasm');
    
    landmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
    
    postMessage({ type: 'status', status: 'ready' });
  } catch (err) {
    postMessage({ type: 'status', status: 'error', error: err.message || String(err) });
  }
}

self.onmessage = async (event) => {
  const { type, imageBitmap, timestamp } = event.data;
  
  if (type === 'init') {
    await initLandmarker();
  } else if (type === 'detect') {
    if (!landmarker) {
      if (imageBitmap) imageBitmap.close();
      return;
    }
    
    try {
      const result = landmarker.detectForVideo(imageBitmap, timestamp);
      
      // Free memory
      if (imageBitmap) imageBitmap.close();
      
      postMessage({
        type: 'result',
        result,
        timestamp
      });
    } catch (err) {
      if (imageBitmap) imageBitmap.close();
      postMessage({ type: 'error', error: err.message || String(err) });
    }
  }
};
