// animationCache.js - IndexedDB local caching for GLB animations
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const DB_NAME = 'vsl-animation-cache';
const STORE_NAME = 'glb-files';
const DB_VERSION = 1;

let dbPromise = null;

function getDB() {
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
  
  return dbPromise;
}

export async function getCachedGlb(token) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(token);
      request.onsuccess = () => resolve(request.result); // ArrayBuffer or undefined
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Read failed:', err);
    return undefined;
  }
}

export async function setCachedGlb(token, arrayBuffer) {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(arrayBuffer, token);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Write failed:', err);
  }
}

export async function clearAnimationCache() {
  try {
    const db = await getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (err) {
    console.warn('[IndexedDB] Clear failed:', err);
  }
}

const loader = new GLTFLoader();

/**
 * Loads an animation by its VSL token.
 * Tries local IndexedDB first, falls back to fetching from baseUrl (public bucket/folder).
 */
export async function loadSignAnimation(token, baseUrl = '/assets/animations/') {
  try {
    let arrayBuffer = await getCachedGlb(token);
    
    if (!arrayBuffer) {
      console.log(`[Cache Miss] Fetching animation for token: ${token}`);
      const response = await fetch(`${baseUrl}${token}.glb`);
      if (!response.ok) {
        throw new Error(`Failed to fetch GLB for token "${token}": ${response.statusText}`);
      }
      arrayBuffer = await response.arrayBuffer();
      await setCachedGlb(token, arrayBuffer);
    } else {
      console.log(`[Cache Hit] Loaded animation from IndexedDB for token: ${token}`);
    }
    
    // Parse ArrayBuffer to retrieve Three.js AnimationClips
    return new Promise((resolve, reject) => {
      loader.parse(arrayBuffer, '', (gltf) => {
        // Return animations and scene model if needed (normally only animations are required)
        resolve({
          animations: gltf.animations || [],
          gltf
        });
      }, reject);
    });
  } catch (err) {
    console.warn(`[Animation Loader] Fallback to procedurally generated sign for token: ${token}. Error details:`, err);
    return null; // Return null so the engine falls back to procedural seed pose
  }
}
