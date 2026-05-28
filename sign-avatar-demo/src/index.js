import { isSenderMode, initRemoteCameraPhone } from './remoteCamera.js';

if (isSenderMode()) {
  initRemoteCameraPhone();
} else {
  // Dynamically load the main app when executing on the PC, bypassing heavy assets on phone
  import('./main.js').catch((err) => {
    console.error('Failed to load main sign avatar lab app:', err);
  });
}
