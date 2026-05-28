// remoteCamera.js - WebRTC Remote Camera Streaming (Phone to PC)

const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const WS_URL = `${wsProtocol}//${window.location.host}/ws-signaling`;

export function isSenderMode() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('mode') === 'sender';
}

// ----------------------------------------------------
// PHONE SENDER MODE
// ----------------------------------------------------
export function initRemoteCameraPhone() {
  const urlParams = new URLSearchParams(window.location.search);
  const targetId = urlParams.get('target');

  if (!targetId) {
    document.body.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; background:#111; color:#fff; font-family:sans-serif; text-align:center; padding:20px;">
        <h2 style="color:#d75c43;">Error</h2>
        <p>No target PC ID found. Please scan the QR code on your PC screen again.</p>
      </div>
    `;
    return;
  }

  // Render mobile sender interface
  document.body.innerHTML = `
    <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; min-height:100vh; background:#111; color:#fff; font-family:sans-serif; padding:18px; box-sizing:border-box;">
      <h2 style="margin-top:0; color:#16846f; font-weight:800; font-size:22px; letter-spacing:0.5px;">VSL MoCap Streamer</h2>
      <p style="margin:0 0 16px 0; font-size:13px; color:#888; text-align:center;">Keep this tab active. Use a high-end camera mode (60 FPS).</p>
      
      <div style="position:relative; width:100%; max-width:380px; aspect-ratio:3/4; background:#222; border-radius:12px; overflow:hidden; box-shadow:0 12px 32px rgba(0,0,0,0.5); margin-bottom:20px;">
        <video id="mocapVideo" autoplay playsinline muted style="width:100%; height:100%; object-fit:cover; transform:scaleX(-1);"></video>
        <div id="fpsBadge" style="position:absolute; top:12px; right:12px; background:rgba(22, 132, 111, 0.85); color:#fff; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:bold; backdrop-filter:blur(4px);">60 FPS (Target)</div>
      </div>
      
      <div id="mocapStatus" style="font-size:15px; font-weight:600; margin-bottom:22px; text-align:center; color:#ddd; padding:8px 16px; border-radius:8px; background:rgba(255,255,255,0.05); width:100%; max-width:380px; box-sizing:border-box;">
        Connecting to signaling...
      </div>
      
      <button id="startStreamBtn" disabled style="width:100%; max-width:380px; height:50px; font-size:16px; font-weight:bold; border-radius:8px; border:none; background:#16846f; color:#fff; cursor:pointer; opacity:0.5; transition:opacity 0.2s;">
        Start Camera Stream
      </button>
    </div>
  `;

  const mocapVideo = document.getElementById('mocapVideo');
  const mocapStatus = document.getElementById('mocapStatus');
  const startStreamBtn = document.getElementById('startStreamBtn');

  let localStream = null;
  let ws = null;
  let pc = null;
  let isConnected = false;

  // Initialize WebSocket connection
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    mocapStatus.textContent = 'Signaling connected. Requesting camera...';
    requestCamera();
  };

  ws.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'answer') {
        mocapStatus.textContent = 'PC accepted connection. Streaming...';
        mocapStatus.style.color = '#16846f';
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        isConnected = true;
      } else if (data.type === 'candidate' && pc) {
        if (data.candidate) {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      } else if (data.type === 'client-disconnected' && data.clientId === targetId) {
        mocapStatus.textContent = 'PC disconnected. Waiting...';
        mocapStatus.style.color = '#d75c43';
        cleanupPeer();
      }
    } catch (err) {
      console.error('[Sender] WS Message Error:', err);
    }
  };

  ws.onclose = () => {
    mocapStatus.textContent = 'Signaling disconnected. Retrying...';
    mocapStatus.style.color = '#d75c43';
    setTimeout(initRemoteCameraPhone, 3000);
  };

  async function requestCamera() {
    try {
      // Prompt for back or front camera with high framerate
      localStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          frameRate: { ideal: 60, min: 30 },
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        },
        audio: false
      });

      mocapVideo.srcObject = localStream;
      mocapStatus.textContent = 'Camera active. Ready to stream.';
      startStreamBtn.disabled = false;
      startStreamBtn.style.opacity = '1';
    } catch (err) {
      console.error('[Sender] Camera Access Failed:', err);
      mocapStatus.textContent = `Camera error: ${err.message || err}`;
      mocapStatus.style.color = '#d75c43';
    }
  }

  startStreamBtn.addEventListener('click', () => {
    if (isConnected) {
      cleanupPeer();
      startStreamBtn.textContent = 'Start Camera Stream';
      startStreamBtn.style.background = '#16846f';
      mocapStatus.textContent = 'Stream stopped. Ready to restart.';
      isConnected = false;
      return;
    }

    mocapStatus.textContent = 'Connecting to PC...';
    setupPeerConnection();
  });

  function setupPeerConnection() {
    if (!localStream) return;

    pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Add local tracks to send
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: 'candidate',
          target: targetId,
          candidate: event.candidate
        }));
      }
    };

    pc.createOffer()
      .then((offer) => pc.setLocalDescription(offer))
      .then(() => {
        ws.send(JSON.stringify({
          type: 'offer',
          target: targetId,
          sdp: pc.localDescription
        }));
        mocapStatus.textContent = 'Negotiating with PC...';
        startStreamBtn.textContent = 'Stop Stream';
        startStreamBtn.style.background = '#d75c43';
      })
      .catch((err) => {
        mocapStatus.textContent = `WebRTC Error: ${err.message}`;
      });
  }

  function cleanupPeer() {
    if (pc) {
      pc.close();
      pc = null;
    }
  }
}

// ----------------------------------------------------
// PC RECEIVER MODE
// ----------------------------------------------------
let pcWs = null;
let activePc = null;
let currentSenderId = null;

export function initRemoteCameraPC(onRemoteStreamReceived, onStatusUpdate) {
  if (pcWs) return; // Prevent duplicate instantiation

  pcWs = new WebSocket(WS_URL);

  pcWs.onopen = () => {
    onStatusUpdate('Signaling online. Generating QR code...');
  };

  pcWs.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.type === 'welcome') {
        const myId = data.clientId;
        // Generate pairing link
        const pairUrl = `${window.location.origin}/?mode=sender&target=${myId}`;
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(pairUrl)}`;
        
        onStatusUpdate('ready', { pairUrl, qrUrl, myId });
      } 
      else if (data.type === 'offer') {
        currentSenderId = data.sender;
        onStatusUpdate('connecting', { senderId: currentSenderId });
        
        setupPCReceiver(data.sdp, currentSenderId, onRemoteStreamReceived, onStatusUpdate);
      } 
      else if (data.type === 'candidate' && activePc && data.sender === currentSenderId) {
        if (data.candidate) {
          await activePc.addIceCandidate(new RTCIceCandidate(data.candidate));
        }
      }
      else if (data.type === 'client-disconnected' && data.clientId === currentSenderId) {
        onStatusUpdate('disconnected');
        cleanupPCReceiver();
      }
    } catch (err) {
      console.error('[PC] WS Message Error:', err);
    }
  };

  pcWs.onclose = () => {
    onStatusUpdate('Signaling offline. Reconnecting...');
    pcWs = null;
    setTimeout(() => initRemoteCameraPC(onRemoteStreamReceived, onStatusUpdate), 4000);
  };
}

function setupPCReceiver(offerSdp, senderId, onRemoteStreamReceived, onStatusUpdate) {
  cleanupPCReceiver();

  activePc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' }
    ]
  });

  activePc.onicecandidate = (event) => {
    if (event.candidate && pcWs.readyState === WebSocket.OPEN) {
      pcWs.send(JSON.stringify({
        type: 'candidate',
        target: senderId,
        candidate: event.candidate
      }));
    }
  };

  activePc.ontrack = (event) => {
    if (event.streams && event.streams[0]) {
      onRemoteStreamReceived(event.streams[0]);
      onStatusUpdate('connected');
    }
  };

  activePc.setRemoteDescription(new RTCSessionDescription(offerSdp))
    .then(() => activePc.createAnswer())
    .then((answer) => activePc.setLocalDescription(answer))
    .then(() => {
      pcWs.send(JSON.stringify({
        type: 'answer',
        target: senderId,
        sdp: activePc.localDescription
      }));
    })
    .catch((err) => {
      console.error('[PC] Failed to setup PeerConnection:', err);
      onStatusUpdate('error', { error: err.message });
    });
}

export function cleanupPCReceiver() {
  if (activePc) {
    activePc.close();
    activePc = null;
  }
  currentSenderId = null;
}
