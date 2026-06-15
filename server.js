const express = require('express');
const http = require('http');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const path = require('path');
const { execSync } = require('child_process');

// ─── Generate or load self-signed certificate for HTTPS ───────────────
// Required for getUserMedia on Android Chrome (needs secure context)
const CERT_DIR = path.join(__dirname, 'certs');
const CERT_PATH = path.join(CERT_DIR, 'cert.pem');
const KEY_PATH = path.join(CERT_DIR, 'key.pem');

let sslOptions;
try {
  if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    sslOptions = {
      cert: fs.readFileSync(CERT_PATH),
      key: fs.readFileSync(KEY_PATH)
    };
    console.log('[SSL] Loaded existing self-signed certificate');
  } else {
    console.log('[SSL] Generating new self-signed certificate...');
    if (!fs.existsSync(CERT_DIR)) fs.mkdirSync(CERT_DIR, { recursive: true });

    // Generate using node-forge
    const forge = require('node-forge');
    const pki = forge.pki;

    const keys = pki.rsa.generateKeyPair(2048);
    const cert = pki.createCertificate();

    cert.publicKey = keys.publicKey;
    cert.serialNumber = '01';
    cert.validity.notBefore = new Date();
    cert.validity.notAfter = new Date();
    cert.validity.notAfter.setFullYear(cert.validity.notBefore.getFullYear() + 1);

    const attrs = [{
      name: 'commonName',
      value: 'WizzCall Local Dev'
    }, {
      name: 'countryName',
      value: 'US'
    }, {
      shortName: 'ST',
      value: 'State'
    }, {
      name: 'localityName',
      value: 'City'
    }, {
      name: 'organizationName',
      value: 'WizzCall'
    }, {
      shortName: 'OU',
      value: 'Dev'
    }];
    cert.setSubject(attrs);
    cert.setIssuer(attrs);

    cert.sign(keys.privateKey, forge.md.sha256.create());

    const pemCert = pki.certificateToPem(cert);
    const pemKey = pki.privateKeyToPem(keys.privateKey);

    fs.writeFileSync(CERT_PATH, pemCert);
    fs.writeFileSync(KEY_PATH, pemKey);
    sslOptions = { cert: pemCert, key: pemKey };
    console.log('[SSL] Self-signed certificate generated and saved using node-forge');
  }
} catch (err) {
  console.warn('[SSL] Could not generate certificate, HTTPS disabled:', err.message);
  sslOptions = null;
}

const app = express();
const httpServer = http.createServer(app);
const httpsServer = sslOptions ? https.createServer(sslOptions, app) : null;

// Socket.IO attaches to both HTTP and HTTPS servers
const io = new Server({
  cors: { origin: '*' }
});
io.attach(httpServer);
if (httpsServer) io.attach(httpsServer);

app.use(express.static(path.join(__dirname, 'public')));

// ─── Nickname Generator ───────────────────────────────────────────────
const adjectives = [
  'Swift', 'Cozy', 'Neon', 'Cosmic', 'Chill', 'Mystic', 'Stellar', 'Wild',
  'Lucky', 'Brave', 'Silent', 'Funky', 'Zen', 'Pixel', 'Turbo', 'Frost',
  'Shadow', 'Crystal', 'Thunder', 'Velvet', 'Nova', 'Lunar', 'Solar', 'Amber',
  'Blaze', 'Drift', 'Echo', 'Glitch', 'Haze', 'Jade', 'Karma', 'Lumen',
  'Onyx', 'Prism', 'Quasar', 'Rogue', 'Sage', 'Tidal', 'Ultra', 'Vivid'
];
const animals = [
  'Panda', 'Falcon', 'Wolf', 'Phoenix', 'Tiger', 'Dolphin', 'Eagle', 'Fox',
  'Owl', 'Lion', 'Bear', 'Hawk', 'Lynx', 'Raven', 'Dragon', 'Cobra',
  'Jaguar', 'Panther', 'Viper', 'Shark', 'Orca', 'Mantis', 'Crane', 'Moth',
  'Bison', 'Gecko', 'Heron', 'Ibis', 'Koala', 'Lemur', 'Newt', 'Otter',
  'Puma', 'Quail', 'Stag', 'Toucan', 'Wren', 'Yak', 'Zebra', 'Asp'
];

function generateNickname() {
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const animal = animals[Math.floor(Math.random() * animals.length)];
  const num = Math.floor(Math.random() * 100);
  return `${adj}${animal}${num}`;
}

// ─── Icebreaker Questions ─────────────────────────────────────────────
const icebreakers = [
  "What's the best trip you've ever taken?",
  "If you could have dinner with anyone, who would it be?",
  "What's a skill you'd love to learn?",
  "What's your go-to karaoke song?",
  "If you could live anywhere in the world, where would it be?",
  "What's the most interesting thing you've read recently?",
  "Do you believe in aliens? Why or why not?",
  "What's your unpopular opinion?",
  "If you had a time machine, where would you go?",
  "What's the best advice you've ever received?",
  "What's your comfort movie or show?",
  "If you could master any musical instrument, which one?",
  "What's the weirdest food combo you actually enjoy?",
  "Are you a morning person or a night owl?",
  "What's something on your bucket list?",
  "If your life had a theme song, what would it be?",
  "What's a hobby you picked up recently?",
  "Would you rather explore space or the deep ocean?",
  "What superpower would you choose and why?",
  "What's the most spontaneous thing you've ever done?"
];

function getRandomIcebreaker() {
  return icebreakers[Math.floor(Math.random() * icebreakers.length)];
}

// ─── State ────────────────────────────────────────────────────────────
const users = new Map();   // socketId -> { nickname, partnerId }
const queue = [];          // array of socket IDs waiting for a match

function broadcastOnlineCount() {
  io.emit('online-count', users.size);
}

function removeFromQueue(socketId) {
  const idx = queue.indexOf(socketId);
  if (idx !== -1) queue.splice(idx, 1);
}

function disconnectPartner(socketId) {
  const userData = users.get(socketId);
  if (userData && userData.partnerId) {
    const partnerId = userData.partnerId;
    const partnerData = users.get(partnerId);
    if (partnerData) {
      partnerData.partnerId = null;
      io.to(partnerId).emit('partner-disconnected');
    }
    userData.partnerId = null;
  }
}

// ─── Socket.IO ────────────────────────────────────────────────────────
io.on('connection', (socket) => {
  const nickname = generateNickname();
  users.set(socket.id, { nickname, partnerId: null });
  broadcastOnlineCount();

  // Send user their nickname
  socket.emit('nickname', nickname);
  console.log(`[+] ${nickname} connected (${users.size} online)`);

  // ── Join matchmaking queue ──
  socket.on('join-queue', () => {
    removeFromQueue(socket.id);
    disconnectPartner(socket.id);

    // Try to find a match
    while (queue.length > 0) {
      const partnerId = queue.shift();
      const partnerData = users.get(partnerId);

      // Skip if partner disconnected while waiting
      if (!partnerData) continue;
      // Skip if partner is somehow already matched
      if (partnerData.partnerId) continue;

      const userData = users.get(socket.id);
      if (!userData) return;

      // Match found!
      userData.partnerId = partnerId;
      partnerData.partnerId = socket.id;

      const icebreaker = getRandomIcebreaker();

      socket.emit('matched', {
        partnerId,
        partnerNickname: partnerData.nickname,
        initiator: true,
        icebreaker
      });
      io.to(partnerId).emit('matched', {
        partnerId: socket.id,
        partnerNickname: userData.nickname,
        initiator: false,
        icebreaker
      });

      console.log(`[♥] Matched: ${userData.nickname} <-> ${partnerData.nickname}`);
      return;
    }

    // No match found — add to queue
    queue.push(socket.id);
    socket.emit('searching');
    console.log(`[~] ${nickname} is searching... (${queue.length} in queue)`);
  });

  // ── Leave queue ──
  socket.on('leave-queue', () => {
    removeFromQueue(socket.id);
  });

  // ── WebRTC Signaling ──
  socket.on('offer', ({ to, offer }) => {
    io.to(to).emit('offer', { from: socket.id, offer });
  });

  socket.on('answer', ({ to, answer }) => {
    io.to(to).emit('answer', { from: socket.id, answer });
  });

  socket.on('ice-candidate', ({ to, candidate }) => {
    io.to(to).emit('ice-candidate', { from: socket.id, candidate });
  });

  // ── Skip (disconnect + re-queue) ──
  socket.on('skip', () => {
    disconnectPartner(socket.id);
    console.log(`[>>] ${nickname} skipped`);
  });

  // ── End call ──
  socket.on('end-call', () => {
    disconnectPartner(socket.id);
    console.log(`[x] ${nickname} ended call`);
  });

  // ── Disconnect ──
  socket.on('disconnect', () => {
    disconnectPartner(socket.id);
    removeFromQueue(socket.id);
    console.log(`[-] ${nickname} disconnected (${users.size - 1} online)`);
    users.delete(socket.id);
    broadcastOnlineCount();
  });
});

// ─── Start Server ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
const HTTPS_PORT = process.env.HTTPS_PORT || 3443;

// Get local network IP for mobile access
function getLocalIP() {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

const localIP = getLocalIP();

httpServer.listen(PORT, () => {
  console.log(`\n  ⚡ WizzCall server running!`);
  console.log(`  ────────────────────────────────────`);
  console.log(`  🖥️  Local:   http://localhost:${PORT}`);
  console.log(`  📱 Network: http://${localIP}:${PORT}`);
});

if (httpsServer) {
  httpsServer.listen(HTTPS_PORT, () => {
    console.log(`  ────────────────────────────────────`);
    console.log(`  🔒 HTTPS:   https://localhost:${HTTPS_PORT}`);
    console.log(`  📱 Mobile:  https://${localIP}:${HTTPS_PORT}`);
    console.log(`  ────────────────────────────────────`);
    console.log(`  ℹ️  Use the HTTPS URL on Android/iOS`);
    console.log(`     for microphone access to work.\n`);
  });
}

