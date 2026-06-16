/* ═══════════════════════════════════════════════════════════════════════
   WizzCall — Main Application Controller
   ═══════════════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── DOM References ────────────────────────────────────────────────
  const $screenLanding   = document.getElementById('screen-landing');
  const $screenSearching = document.getElementById('screen-searching');
  const $screenCall      = document.getElementById('screen-call');
  const $overlayDisconnected = document.getElementById('overlay-disconnected');

  const $onlineCount     = document.getElementById('online-count');
  const $btnStart        = document.getElementById('btn-start');
  const $btnCancel       = document.getElementById('btn-cancel');
  const $btnMute         = document.getElementById('btn-mute');
  const $btnSkip         = document.getElementById('btn-skip');
  const $btnEnd          = document.getElementById('btn-end');
  const $btnFindNew      = document.getElementById('btn-find-new');
  const $btnGoHome       = document.getElementById('btn-go-home');

  const $partnerNickname = document.getElementById('partner-nickname');
  const $callTimer       = document.getElementById('call-timer');
  const $callStatus      = document.getElementById('call-status');
  const $icebreaker      = document.getElementById('icebreaker');
  const $icebreakerText  = document.getElementById('icebreaker-text');
  const $visualizer      = document.getElementById('visualizer');
  const $remoteAudio     = document.getElementById('remote-audio');

  const $muteIconOn      = document.getElementById('mute-icon-on');
  const $muteIconOff     = document.getElementById('mute-icon-off');

  // ─── State ─────────────────────────────────────────────────────────
  let currentScreen = 'landing'; // 'landing' | 'searching' | 'call'
  let partnerId = null;
  let myNickname = '';
  let timerInterval = null;
  let callSeconds = 0;

  // ─── Initialize ────────────────────────────────────────────────────
  const socket = io();
  const audioCall = new AudioCall();

  // Create visualizer bars on load
  createVisualizerBars($visualizer, 32);

  // ─── Screen Management ─────────────────────────────────────────────
  function showScreen(name) {
    currentScreen = name;

    $screenLanding.classList.remove('active');
    $screenSearching.classList.remove('active');
    $screenCall.classList.remove('active');

    switch (name) {
      case 'landing':
        $screenLanding.classList.add('active');
        break;
      case 'searching':
        $screenSearching.classList.add('active');
        break;
      case 'call':
        $screenCall.classList.add('active');
        break;
    }
  }

  // ─── Timer ─────────────────────────────────────────────────────────
  function startTimer() {
    callSeconds = 0;
    $callTimer.textContent = '00:00';
    timerInterval = setInterval(() => {
      callSeconds++;
      $callTimer.textContent = formatTime(callSeconds);
    }, 1000);
  }

  function stopTimer() {
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  }

  // ─── Mute UI ───────────────────────────────────────────────────────
  function updateMuteUI(isMuted) {
    if (isMuted) {
      $btnMute.classList.add('muted');
      $muteIconOn.classList.add('hidden');
      $muteIconOff.classList.remove('hidden');
      $btnMute.querySelector('.control-label').textContent = 'Unmute';
    } else {
      $btnMute.classList.remove('muted');
      $muteIconOn.classList.remove('hidden');
      $muteIconOff.classList.add('hidden');
      $btnMute.querySelector('.control-label').textContent = 'Mute';
    }
  }

  // ─── End current call & clean up ───────────────────────────────────
  function endCurrentCall() {
    audioCall.cleanup();
    stopTimer();
    resetVisualizerBars($visualizer);
    updateMuteUI(false);
    $remoteAudio.srcObject = null;
    partnerId = null;
  }

  // ─── WebRTC Call Setup ─────────────────────────────────────────────
  async function setupCall(isInitiator) {
    // Ensure we have microphone access
    await audioCall.requestMicrophone();

    // Create peer connection with callbacks
    audioCall.createPeerConnection({
      onIceCandidate: (candidate) => {
        socket.emit('ice-candidate', { to: partnerId, candidate });
      },
      onTrack: (remoteStream) => {
        $remoteAudio.srcObject = remoteStream;
        // Start visualizer once we have remote audio
        audioCall.startVisualizer($visualizer);
      },
      onConnectionStateChange: (state) => {
        console.log('[App] Connection state:', state);
        if (state === 'connected') {
          $callStatus.innerHTML = '<span class="status-dot connected"></span> Connected';
        } else if (state === 'disconnected' || state === 'failed') {
          $callStatus.innerHTML = '<span class="status-dot"></span> Reconnecting...';
        }
      }
    });

    // If we're the initiator, create and send the offer
    if (isInitiator) {
      const offer = await audioCall.createOffer();
      socket.emit('offer', { to: partnerId, offer });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // Socket.IO Event Handlers
  // ═══════════════════════════════════════════════════════════════════

  // Receive own nickname
  socket.on('nickname', (name) => {
    myNickname = name;
    console.log(`[App] Your nickname: ${name}`);
  });

  // Online user count update
  socket.on('online-count', (count) => {
    $onlineCount.textContent = count;
  });

  // Entered search queue
  socket.on('searching', () => {
    SFX.searching();
    showScreen('searching');
  });

  // Matched with a partner
  socket.on('matched', async (data) => {
    partnerId = data.partnerId;
    $partnerNickname.textContent = data.partnerNickname;
    $icebreakerText.textContent = data.icebreaker;
    $icebreaker.style.display = '';

    SFX.matched();
    showScreen('call');
    startTimer();

    try {
      await setupCall(data.initiator);
    } catch (err) {
      console.error('[App] Error setting up call:', err);
      alert('Could not access your microphone. Please allow microphone access and try again.');
      endCurrentCall();
      showScreen('landing');
    }
  });

  // Receive WebRTC offer
  socket.on('offer', async ({ from, offer }) => {
    if (from !== partnerId) return;
    try {
      const answer = await audioCall.handleOffer(offer);
      socket.emit('answer', { to: partnerId, answer });
    } catch (err) {
      console.error('[App] Error handling offer:', err);
    }
  });

  // Receive WebRTC answer
  socket.on('answer', async ({ from, answer }) => {
    if (from !== partnerId) return;
    try {
      await audioCall.handleAnswer(answer);
    } catch (err) {
      console.error('[App] Error handling answer:', err);
    }
  });

  // Receive ICE candidate
  socket.on('ice-candidate', async ({ from, candidate }) => {
    if (from !== partnerId) return;
    try {
      await audioCall.addIceCandidate(candidate);
    } catch (err) {
      console.error('[App] Error adding ICE candidate:', err);
    }
  });

  // Partner disconnected
  socket.on('partner-disconnected', () => {
    SFX.disconnected();
    endCurrentCall();
    $overlayDisconnected.classList.remove('hidden');
  });

  // ═══════════════════════════════════════════════════════════════════
  // UI Event Handlers
  // ═══════════════════════════════════════════════════════════════════

  // Start Talking button
  $btnStart.addEventListener('click', async () => {
    SFX.click();

    // Check if getUserMedia is available (requires secure context on mobile)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      const isSecure = window.isSecureContext;
      if (!isSecure) {
        alert(
          '🔒 Microphone access requires a secure (HTTPS) connection.\n\n' +
          'On your phone, use the HTTPS URL instead:\n' +
          window.location.href.replace('http://', 'https://').replace(':3000', ':3443') +
          '\n\nYou may need to accept the self-signed certificate warning.'
        );
      } else {
        alert('Your browser does not support microphone access. Please try a different browser.');
      }
      return;
    }

    // Request microphone permission upfront
    try {
      await audioCall.requestMicrophone();
    } catch (err) {
      console.error('[App] Microphone error:', err.name, err.message);
      if (err.name === 'NotAllowedError') {
        alert('Microphone permission was denied. Please allow microphone access in your browser settings and try again.');
      } else if (err.name === 'NotFoundError') {
        alert('No microphone was found on this device. Please connect a microphone and try again.');
      } else if (err.name === 'NotReadableError') {
        alert('Your microphone is in use by another app. Please close other apps using the mic and try again.');
      } else {
        alert('Could not access microphone: ' + err.message);
      }
      return;
    }

    socket.emit('join-queue');
  });

  // Cancel search
  $btnCancel.addEventListener('click', () => {
    SFX.click();
    socket.emit('leave-queue');
    showScreen('landing');
  });

  // Mute toggle
  $btnMute.addEventListener('click', () => {
    SFX.click();
    const isMuted = audioCall.toggleMute();
    updateMuteUI(isMuted);
  });

  // Skip to next person
  $btnSkip.addEventListener('click', () => {
    SFX.click();
    socket.emit('skip');
    endCurrentCall();
    // Immediately re-enter queue
    socket.emit('join-queue');
  });

  // End call
  $btnEnd.addEventListener('click', () => {
    SFX.click();
    socket.emit('end-call');
    endCurrentCall();
    showScreen('landing');
  });

  // Find new (from disconnected overlay)
  $btnFindNew.addEventListener('click', () => {
    SFX.click();
    $overlayDisconnected.classList.add('hidden');
    socket.emit('join-queue');
  });

  // Go home (from disconnected overlay)
  $btnGoHome.addEventListener('click', () => {
    SFX.click();
    $overlayDisconnected.classList.add('hidden');
    showScreen('landing');
  });

  // ─── Keyboard shortcut: Escape to cancel/end ──────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (currentScreen === 'searching') {
        $btnCancel.click();
      } else if (currentScreen === 'call') {
        $btnEnd.click();
      }
    }
    // M key to toggle mute during call
    if (e.key === 'm' || e.key === 'M') {
      if (currentScreen === 'call') {
        $btnMute.click();
      }
    }
  });

  // ─── Handle page unload ────────────────────────────────────────────
  window.addEventListener('beforeunload', () => {
    audioCall.destroy();
  });

  console.log('[App] WizzCall initialized ✨');
})();
