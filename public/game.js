'use strict';

// ─── Socket ──────────────────────────────────────────────────────────────────
const socket = io();

// ─── Metadata 10 Level Permainan ─────────────────────────────────────────────
const ALL_LEVELS = [
  { id: 1, idx: 0, name: 'First Steps',       icon: '🔑', tag: 'Tutorial Co-op',    desc: 'Lompat bersama & raih kunci pertama.',             unlocked: true },
  { id: 2, idx: 1, name: 'The Step',          icon: '📦', tag: 'Heavy Box DDS',     desc: 'Dorong peti bersama & tumpuk badan lewati tembok.', unlocked: true },
  { id: 3, idx: 2, name: 'Hold the Door',     icon: '⚡', tag: 'Multi-Buttons DDS', desc: 'Injak tombol jurang untuk nyalakan jembatan ganda.', unlocked: true },
  { id: 4, idx: 3, name: 'Bouncer',           icon: '🦘', tag: 'Springboard Co-op', desc: 'Lompat dari trampolin & tumpuk badan di udara.',  unlocked: true },
  { id: 5, idx: 4, name: 'Shield Co-op',      icon: '🛡️', tag: 'Dual-Shield Synergy', desc: 'P1 pelindung atas, P2 pelindung depan. Tumpuk badan & tembus laser!', unlocked: true },
  { id: 6, idx: 5, name: 'The Tower',         icon: '🗼', tag: 'Tower Stacking',    desc: 'Tumpuk seluruh badan setinggi menara.',            unlocked: true },
  { id: 7, idx: 6, name: 'Team Push',         icon: '🪨', tag: 'All Players Push',  desc: 'Dorong batu raksasa bersama seluruh tim.',         unlocked: true },
  { id: 8, idx: 7, name: 'Moving Ferry',      icon: '🚢', tag: 'Electric Ferry',    desc: 'Menyeberang di atas platform gerak sempit.',       unlocked: true },
  { id: 9, idx: 8, name: 'Trap Switch',       icon: '🔀', tag: 'Dual Paths',        desc: 'Koordinasi jalur atas & tombol bawah.',            unlocked: true },
  { id: 10, idx: 9, name: 'Final Exam',       icon: '🏆', tag: 'The Grand Finale',  desc: 'Ujian puncak seluruh puzzle kerja sama.',          unlocked: true },
  { id: 11, idx: 10, name: 'The Great Divide', icon: '🏹', tag: 'Human Slingshot',   desc: 'Lontarkan kawan melintasi jurang maut dengan ketapel manusia!', unlocked: true },
  { id: 12, idx: 11, name: 'The Balance',      icon: '⚖️', tag: 'Seesaw Co-op',      desc: 'Bagi berat tim di timbangan raksasa untuk raih kunci.',        unlocked: true },
  { id: 13, idx: 12, name: 'Color Checkpoint', icon: '🎨', tag: 'Color Lasers',      desc: 'Lewati laser warna yang sesuai karaktermu & matikan saklar.',  unlocked: true },
  { id: 14, idx: 13, name: 'Tangled',          icon: '🔗', tag: 'Tether Chain',      desc: 'Terikat tali maut bersama rekan, lompat kompak di pilar asam!', unlocked: true },
  { id: 15, idx: 14, name: 'Lights Out',       icon: '🔦', tag: 'Darkness & Torch',  desc: 'Bawa obor di kegelapan pekat & pandu rekan lewati duri.',      unlocked: true },
  { id: 16, idx: 15, name: 'Hamster Power',    icon: '⚡', tag: 'Generator Wheel',   desc: 'Berlari di roda generator untuk hidupkan elevator tim.',       unlocked: true },
  { id: 17, idx: 16, name: 'Leap of Faith',    icon: '🌫️', tag: 'Invisible Solid',  desc: 'Injak saklar untuk mengungkap lantai ilusi melintasi jurang.', unlocked: true },
  { id: 18, idx: 17, name: 'Panic Room',       icon: '🧱', tag: 'Compactor Wall',    desc: 'Dinding maut maju perlahan! Cepat tumpuk badan sebelum tergilas!', unlocked: true },
  { id: 19, idx: 18, name: 'Tethered in Dark', icon: '🕯️', tag: 'Tether + Darkness', desc: 'Gelap gulita dan terikat bersama! Jangan sampai kawan terjatuh.', unlocked: true },
  { id: 20, idx: 19, name: 'Ultimate Machine', icon: '⚙️', tag: 'Generator + Illusion', desc: 'Pacu roda generator untuk nyalakan jembatan ilusi seberang!', unlocked: true },
];

// ─── DOM References ──────────────────────────────────────────────────────────
const screens = {
  lobby   : document.getElementById('screen-lobby'),
  game    : document.getElementById('screen-game'),
  win     : document.getElementById('screen-win'),
  rejected: document.getElementById('screen-rejected'),
};

const $ = id => document.getElementById(id);

const elName          = $('player-name');
const btnJoin         = $('btn-join');
const btnStart        = $('btn-start');
const btnRestart      = $('btn-restart');
const btnNextLevel    = $('btn-next-level');
const btnRetry        = $('btn-retry');
const btnLeave        = $('btn-leave');
const btnEndGame      = $('btn-end-game');
const btnLobbyWin     = $('btn-lobby-from-win');
const btnThemeToggle  = $('btn-theme-toggle');
const themeIcon       = $('theme-icon');
const themeLabel      = $('theme-label');
const cardJoin        = $('card-join');
const waitingArea     = $('waiting-area');
const playerList      = $('player-list');
const playerCount     = $('player-count');
const waitingMsg      = $('waiting-msg');
const startHint       = $('start-hint');
const levelGrid       = $('level-grid');
const hudLevel        = $('hud-level');
const hudDDS          = $('hud-dds');
const hudKeyStatus    = $('hud-key-status');
const hudPlayers      = $('hud-players');
const elCamSwitcher   = $('cam-switcher');

const canvas = $('game-canvas');
const ctx    = canvas.getContext('2d');

// ─── State ───────────────────────────────────────────────────────────────────
let myId             = null;
let isHost           = false;
let myColor          = '#fff';
let currentLevel     = null;
let selectedLevelIdx = 0;
let lastSnapshot     = null;
let keyCollected     = false;
let animRunning      = false;

// Dynamic Entities State (DDS)
let currentBoxes           = [];
let currentButtons         = [];
let currentBridges         = [];
let currentGates           = [];
let currentLasers          = [];
let currentSpringboards    = [];
let currentSlingshot          = null;
let currentMovingPlatforms    = [];
let currentSeesaws            = [];
let currentTorches            = [];
let currentGeneratorWheels    = [];
let currentInvisiblePlatforms = [];
let currentCompactorWall      = null;
let lightingCanvas            = null;

// Shared Viewport Camera (Pico Park scrolling)
const VIEW_W        = 1200;
const VIEW_H        = 600;
let currentCamX     = 0;
let renderCamX      = 0;
let renderCamY      = 0;
let renderCamZoom   = 1.0;

// Input tracking
const keys     = { left: false, right: false, up: false, down: false };
let   lastSent = { left: false, right: false, up: false, down: false };

// Animation
let keyAnim     = 0;
let energyAnim  = 0;
let cloudOffset = 0;
let laserAnim   = 0;

// ─── Theme Management (Light / Dark) ─────────────────────────────────────────
function initTheme() {
  const savedTheme = localStorage.getItem('boxbuds-theme') || 'light';
  applyTheme(savedTheme === 'dark');
}

function applyTheme(isDark) {
  if (isDark) {
    document.body.classList.add('dark-theme');
    document.body.classList.remove('light-theme');
    themeIcon.textContent  = '🌙';
    themeLabel.textContent = 'Mode Gelap';
    localStorage.setItem('boxbuds-theme', 'dark');
  } else {
    document.body.classList.remove('dark-theme');
    document.body.classList.add('light-theme');
    themeIcon.textContent  = '☀️';
    themeLabel.textContent = 'Mode Terang';
    localStorage.setItem('boxbuds-theme', 'light');
  }
}

btnThemeToggle.addEventListener('click', () => {
  const isDark = document.body.classList.contains('dark-theme');
  applyTheme(!isDark);
});

initTheme();

// ─── Screen Helper ───────────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// Reset semua state ke kondisi lobby awal
function resetToLobby() {
  currentLevel        = null;
  lastSnapshot        = null;
  keyCollected        = false;
  animRunning         = false;
  currentBoxes        = [];
  currentButtons      = [];
  currentBridges      = [];
  currentLasers       = [];
  currentSpringboards = [];
  currentSlingshot    = null;
  currentCamX         = 0;
  renderCamX          = 0;
  renderCamY          = 0;
  renderCamZoom       = 1.0;
  if (elCamSwitcher) elCamSwitcher.classList.add('hidden');
  selectedCamMode     = 'slingshot';

  btnJoin.disabled = false;
  elName.disabled  = false;
  elName.value     = '';
  playerList.innerHTML = '';

  cardJoin.classList.remove('hidden');
  waitingArea.classList.add('hidden');

  btnStart.classList.add('hidden');
  btnStart.disabled = true;
  btnStart.textContent = '▶ Mulai Game';
  if (startHint) startHint.classList.add('hidden');
  waitingMsg.classList.remove('hidden');

  btnLeave.classList.add('hidden');
  btnEndGame.classList.add('hidden');
  if (btnNextLevel) btnNextLevel.classList.add('hidden');

  myId   = null;
  isHost = false;

  renderLevelGrid();
}

// Tampilkan notifikasi ringan di layar
let notifTimeout = null;
function showGameNotif(msg) {
  let el = document.getElementById('game-notif');
  if (!el) {
    el = document.createElement('div');
    el.id = 'game-notif';
    el.style.cssText = [
      'position:fixed', 'top:75px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(18,22,36,0.92)', 'color:#38bdf8', 'padding:10px 22px',
      'border-radius:24px', 'font:bold 13px Segoe UI', 'z-index:999',
      'border:1px solid rgba(56,189,248,0.3)', 'box-shadow:0 6px 20px rgba(0,0,0,0.4)',
      'pointer-events:none', 'transition:opacity .3s',
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(notifTimeout);
  notifTimeout = setTimeout(() => { el.style.opacity = '0'; }, 2600);
}

// ─── Visual Level Selection Grid ─────────────────────────────────────────────
function renderLevelGrid() {
  levelGrid.innerHTML = '';

  ALL_LEVELS.forEach(lvl => {
    const card = document.createElement('div');
    const isSelected = lvl.idx === selectedLevelIdx;

    card.className = `level-card ${lvl.unlocked ? 'unlocked' : 'locked'} ${isSelected ? 'selected' : ''}`;
    card.dataset.idx = lvl.idx;

    card.innerHTML = `
      <div class="level-card-top">
        <span class="level-num">${lvl.id < 10 ? 'LVL 0' + lvl.id : 'LVL ' + lvl.id}</span>
        <span class="level-badge ${isSelected ? 'badge-selected' : (lvl.unlocked ? 'badge-open' : 'badge-locked')}">
          ${isSelected ? '★ DIPILIH' : (lvl.unlocked ? 'TERBUKA' : '🔒 TERKUNCI')}
        </span>
      </div>
      <div class="level-icon-title">
        <span class="level-icon">${lvl.icon}</span>
        <div class="level-title">${lvl.name}</div>
      </div>
      <div class="level-desc">${lvl.desc}</div>
    `;

    card.addEventListener('click', () => {
      if (!lvl.unlocked) {
        card.style.animation = 'shake .3s';
        setTimeout(() => card.style.animation = '', 300);
        showGameNotif(`🔒 Level ${lvl.id} (${lvl.name}) masih terkunci!`);
        return;
      }

      if (!isHost) {
        showGameNotif('Hanya Host yang dapat menentukan level permainan!');
        return;
      }

      selectedLevelIdx = lvl.idx;
      renderLevelGrid();
      socket.emit('selectLevel', { levelIdx: lvl.idx, levelId: lvl.id });
    });

    levelGrid.appendChild(card);
  });
}

// ─── Canvas Sizing (Fixed Viewport 1200 x 600) ───────────────────────────────
function resizeCanvas() {
  const maxW   = Math.min(window.innerWidth  - 32, 1200);
  const maxH   = Math.min(window.innerHeight - 130, 600);
  const scaleX = maxW / VIEW_W;
  const scaleY = maxH / VIEW_H;
  const scale  = Math.min(scaleX, scaleY, 1);
  canvas.width  = Math.floor(VIEW_W * scale);
  canvas.height = Math.floor(VIEW_H * scale);
  canvas.dataset.scale = scale;
}

window.addEventListener('resize', resizeCanvas);

// ─── Switch Camera Controller (Level 11) ────────────────────────────────────
let selectedCamMode = 'slingshot'; // 'slingshot' | 'seberang' | 'myPlayer' | 'panorama'
const CAM_MODES   = ['slingshot', 'seberang', 'myPlayer', 'panorama'];
const CAM_LABELS  = {
  slingshot: '🏹 Ketapel (Kiri)',
  seberang : '⛰️ Seberang (Kanan)',
  myPlayer : '👤 Karakter Saya',
  panorama : '🌐 Panorama Penuh',
};

function setCameraMode(mode) {
  if (!CAM_MODES.includes(mode)) return;
  selectedCamMode = mode;

  // Update styling tombol aktif di bar
  document.querySelectorAll('.cam-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });

  showGameNotif(`📷 Switch Kamera: ${CAM_LABELS[mode]}`);
}

function cycleCameraMode() {
  const currentIdx = CAM_MODES.indexOf(selectedCamMode);
  const nextIdx = (currentIdx + 1) % CAM_MODES.length;
  setCameraMode(CAM_MODES[nextIdx]);
}

// ─── Input Handling ──────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  // Jangan tangkap tombol jika pemain sedang mengetik di input field (misal nama di lobby)
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
    return;
  }

  if (['ArrowLeft',  'a', 'A'].includes(e.key))  keys.left  = true;
  if (['ArrowRight', 'd', 'D'].includes(e.key))  keys.right = true;
  if (['ArrowUp', 'w', 'W'].includes(e.key))     { e.preventDefault(); keys.up = true; }
  if (['ArrowDown', 's', 'S'].includes(e.key))   { e.preventDefault(); keys.down = true; }
  if (e.code === 'Space')                        { e.preventDefault(); keys.up = true; }

  // Keyboard shortcut C untuk Switch Camera di Level 11
  if (['c', 'C'].includes(e.key) && screens.game.classList.contains('active')) {
    e.preventDefault();
    if (currentLevel && currentLevel.id === 11) {
      cycleCameraMode();
    }
  }

  // Keyboard shortcut R untuk Retry
  if (['r', 'R'].includes(e.key) && screens.game.classList.contains('active')) {
    e.preventDefault();
    socket.emit('retryLevel');
  }
});

document.addEventListener('keyup', e => {
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
    return;
  }

  if (['ArrowLeft',  'a', 'A'].includes(e.key))  keys.left  = false;
  if (['ArrowRight', 'd', 'D'].includes(e.key))  keys.right = false;
  if (['ArrowUp', 'w', 'W'].includes(e.key))      keys.up   = false;
  if (['ArrowDown', 's', 'S'].includes(e.key))    keys.down = false;
  if (e.code === 'Space')                         keys.up   = false;
});

// ─── Slingshot Angry Birds Drag & Aim ────────────────────────────────────────
let isDraggingSlingshot = false;
let dragAimAngle        = 0.785; // rad (default 45°)
let dragTensionRatio    = 0;     // 0.0 s/d 1.0

function getCanvasWorldCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const scale = parseFloat(canvas.dataset.scale) || 1;
  const t = (e.touches && e.touches.length > 0) ? e.touches[0] : ((e.changedTouches && e.changedTouches.length > 0) ? e.changedTouches[0] : e);
  const screenX = (t.clientX - rect.left) / scale;
  const screenY = (t.clientY - rect.top) / scale;
  const worldX = screenX / (renderCamZoom || 1.0) + renderCamX;
  const worldY = screenY / (renderCamZoom || 1.0) + (renderCamY || 0);
  return { worldX, worldY };
}

function handleSlingshotStart(e) {
  if (!currentSlingshot || !currentSlingshot.ammoId) return;

  const { worldX, worldY } = getCanvasWorldCoords(e);
  const pouchX = currentSlingshot.pouchX;
  const pouchY = currentSlingshot.pouchY;

  // Klik atau sentuh di sekitar area ketapel / kantong / peluru (radius 120px)
  const dist = Math.hypot(worldX - pouchX, worldY - pouchY);
  if (dist < 120) {
    if (e.cancelable) e.preventDefault();
    isDraggingSlingshot = true;
    canvas.style.cursor = 'grabbing';
    handleSlingshotMove(e);
  }
}

function handleSlingshotMove(e) {
  if (!isDraggingSlingshot || !currentSlingshot || !currentSlingshot.ammoId) return;
  if (e.cancelable) e.preventDefault();

  const { worldX, worldY } = getCanvasWorldCoords(e);
  const pouchX = currentSlingshot.pouchX;
  const pouchY = currentSlingshot.pouchY;

  // 🎯 Logika Angry Birds:
  // Peluru dilontarkan ke arah KANAN & ATAS.
  // Pemain MENARIK karet ketapel ke arah KIRI & BAWAH.
  const pullLeft = pouchX - worldX; // Semakin ke kiri mouse ditarik, nilai positif semakin besar
  const pullDown = worldY - pouchY; // Semakin ke bawah mouse ditarik, nilai positif semakin besar

  // Batasi agar tarikan selalu mengarah melontarkan ke kanan (tebing seberang)
  const effPullLeft = Math.max(10, pullLeft);
  const effPullDown = Math.max(5, pullDown);

  // Sudut elevasi tembakan parabola (15° s/d 75°)
  const rawAngle = Math.atan2(effPullDown, effPullLeft);
  dragAimAngle = Math.max(0.26, Math.min(1.31, rawAngle));

  // Daya tarikan pegas (Tension 0% - 100%)
  const maxPullDist = 120; // Jarak tarik maksimal (px)
  const pullDist = Math.hypot(Math.max(0, pullLeft), Math.max(0, pullDown));
  dragTensionRatio = Math.min(1.0, Math.max(0, (pullDist - 12) / (maxPullDist - 12)));

  // Kirim aim realtime ke server agar kawan lain melihat ketapel merenggang
  socket.emit('slingshotAim', {
    tension  : dragTensionRatio,
    angle    : dragAimAngle,
    isPulling: dragTensionRatio > 0.05,
  });
}

function handleSlingshotEnd(e) {
  if (!isDraggingSlingshot) return;
  isDraggingSlingshot = false;
  canvas.style.cursor = 'default';

  if (dragTensionRatio >= 0.12) {
    // 🚀 LONTARKAN TEMAN KE DEPAN DENGAN DAYA & SUDUT TERKALIBRASI!
    socket.emit('slingshotLaunch', {
      tension: dragTensionRatio,
      angle  : dragAimAngle,
    });
  } else {
    // Tarikan dibatalkan jika terlalu kecil (< 12%)
    socket.emit('slingshotAim', {
      tension  : 0,
      angle    : dragAimAngle,
      isPulling: false,
    });
  }
  dragTensionRatio = 0;
}

canvas.addEventListener('mousedown', e => {
  if (e.button === 0) handleSlingshotStart(e);
});
window.addEventListener('mousemove', e => {
  if (isDraggingSlingshot) {
    handleSlingshotMove(e);
  } else if (currentSlingshot && currentSlingshot.ammoId) {
    // Ubah cursor menjadi grab saat berada di dekat ketapel
    const { worldX, worldY } = getCanvasWorldCoords(e);
    const dist = Math.hypot(worldX - currentSlingshot.pouchX, worldY - currentSlingshot.pouchY);
    canvas.style.cursor = dist < 120 ? 'grab' : 'default';
  } else {
    if (canvas.style.cursor !== 'default') canvas.style.cursor = 'default';
  }
});
window.addEventListener('mouseup', handleSlingshotEnd);

canvas.addEventListener('touchstart', handleSlingshotStart, { passive: false });
window.addEventListener('touchmove', handleSlingshotMove, { passive: false });
window.addEventListener('touchend', handleSlingshotEnd);

// Kirim input pada 60 FPS saat terjadi perubahan tombol gerak
setInterval(() => {
  if (!myId) return;

  if (keys.left !== lastSent.left || keys.right !== lastSent.right ||
      keys.up !== lastSent.up || keys.down !== lastSent.down) {
    socket.emit('input', {
      left : keys.left,
      right: keys.right,
      up   : keys.up,
      down : keys.down,
    });
    lastSent = { ...keys };
  }
}, 1000 / 60);

// ─── Lobby UI & Tombol Kontrol ───────────────────────────────────────────────
btnJoin.addEventListener('click', () => {
  const name = elName.value.trim() || 'Pemain';
  socket.emit('joinLobby', { name });
  btnJoin.disabled = true;
  elName.disabled  = true;
});

btnStart.addEventListener('click', () => socket.emit('startGame'));
btnRestart.addEventListener('click', () => socket.emit('restartGame'));
btnRetry.addEventListener('click', () => socket.emit('retryLevel'));

// Tombol Switch Camera di Level 11
document.querySelectorAll('.cam-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setCameraMode(btn.dataset.mode);
  });
});

if (btnNextLevel) {
  btnNextLevel.addEventListener('click', () => socket.emit('nextLevel'));
}

elName.addEventListener('keydown', e => { if (e.key === 'Enter') btnJoin.click(); });

btnLeave.addEventListener('click', () => {
  if (confirm('Keluar dari game? Kamu akan kembali ke lobby.')) {
    socket.emit('leaveGame');
  }
});

btnEndGame.addEventListener('click', () => {
  if (confirm('Akhiri game untuk semua pemain dan kembali ke lobby?')) {
    socket.emit('endGame');
  }
});

btnLobbyWin.addEventListener('click', () => {
  socket.emit('endGame');
});

// ─── Socket Events ───────────────────────────────────────────────────────────
socket.on('rejected', ({ reason }) => {
  $('reject-reason').textContent = reason;
  showScreen('rejected');
});

socket.on('joined', ({ id, color, colorName, isHost: host }) => {
  myId    = id;
  isHost  = host;
  myColor = color;

  cardJoin.classList.add('hidden');
  waitingArea.classList.remove('hidden');

  renderLevelGrid();

  if (host) {
    btnStart.classList.remove('hidden');
    btnStart.disabled = true;
    startHint.classList.remove('hidden');
    waitingMsg.classList.add('hidden');
  }
});

socket.on('lobbyUpdate', ({ players }) => {
  playerCount.textContent = players.length;
  playerList.innerHTML    = '';

  players.forEach(p => {
    const li  = document.createElement('li');
    const dot = document.createElement('span');
    dot.className        = 'player-dot';
    dot.style.background = p.color;
    dot.style.boxShadow  = `0 0 8px ${p.color}`;
    dot.style.color      = p.color;
    li.appendChild(dot);
    li.appendChild(document.createTextNode(`${p.name} (${p.colorName})`));

    if (p.isHost) {
      const badge = document.createElement('span');
      badge.className   = 'player-host-badge';
      badge.textContent = 'HOST';
      li.appendChild(badge);
    }
    playerList.appendChild(li);
  });

  const me = players.find(p => p.id === myId);
  if (me?.isHost) {
    isHost = true;
    btnStart.classList.remove('hidden');
    waitingMsg.classList.add('hidden');

    if (players.length >= 2) {
      btnStart.disabled     = false;
      btnStart.textContent  = `▶ Mulai Game (${players.length} Pemain)`;
      if (startHint) startHint.classList.add('hidden');
    } else {
      btnStart.disabled    = true;
      btnStart.textContent = '▶ Mulai Game';
      if (startHint) startHint.classList.remove('hidden');
    }
  }
});

socket.on('levelSelected', ({ levelIdx, levelId, levelName }) => {
  const match = ALL_LEVELS.find(l => (levelId !== undefined ? l.id === levelId : l.idx === levelIdx));
  if (match) selectedLevelIdx = match.idx;
  else selectedLevelIdx = levelIdx;
  renderLevelGrid();
  showGameNotif(`Host memilih: ${levelName}`);
});

socket.on('gameStarted', ({ level, playerCount: pCount, slingshot }) => {
  currentLevel        = level;
  keyCollected        = false;
  currentCamX         = 0;
  renderCamX          = 0;
  renderCamY          = 0;
  renderCamZoom       = 1.0;
  if (level.id === 11) {
    if (elCamSwitcher) elCamSwitcher.classList.remove('hidden');
    setCameraMode('slingshot');
  } else {
    if (elCamSwitcher) elCamSwitcher.classList.add('hidden');
  }
  currentGates        = level.activeGates || [];
  currentSlingshot    = slingshot || null;
  resizeCanvas();

  hudLevel.textContent     = level.name;
  hudKeyStatus.textContent = '🔑 Kunci: Belum Diambil';
  hudKeyStatus.classList.remove('collected');

  if (hudDDS) {
    if (level.id === 5) {
      hudDDS.textContent = '🛡️ Dual-Shield Co-op: P1 (Top Shield) & P2 (Front Shield)';
    } else if (level.id === 6) {
      hudDDS.textContent = `🗼 Tower Co-op: Butuh Tumpuk ${pCount} Pemain Raih Kunci`;
    } else if (level.id === 7) {
      hudDDS.textContent = `🪨 Heavy Push: Seluruh ${pCount} Pemain Wajib Kompak Mendorong`;
    } else if (level.id === 8) {
      hudDDS.textContent = `🚢 Electric Ferry: Feri Pas-pasan ${pCount} Pemain`;
    } else if (level.id === 9) {
      hudDDS.textContent = `🔀 Trap Switch: 1 Pelari Atas + ${pCount - 1} Tombol Bawah`;
    } else if (level.id === 10) {
      hudDDS.textContent = `🏆 Final Exam: Ujian Puncak Seluruh Sinergi Tim`;
    } else if (level.id === 11) {
      hudDDS.textContent = `🏹 Ketapel Manusia: Jurang 1320px | Skala ${pCount - 1} Tombol Ledge`;
    } else if (level.id === 12) {
      hudDDS.textContent = `⚖️ Seesaw Co-op: Timbangan Raksasa | Butuh Beban Tim`;
    } else if (level.id === 13) {
      hudDDS.textContent = `🎨 Color Lasers: Lewati Laser Warna Sesuai Karaktermu`;
    } else if (level.id === 14) {
      hudDDS.textContent = `🔗 Tether Chain: Semua Pemain Terikat Tali Maut`;
    } else if (level.id === 15) {
      hudDDS.textContent = `🔦 Darkness: Gelap Gulita | Ikuti Pembawa Obor`;
    } else if (level.id === 16) {
      hudDDS.textContent = `⚡ Hamster Power: ${Math.max(1, pCount - 2)} Pelari di Roda Listrik`;
    } else if (level.id === 17) {
      hudDDS.textContent = `🌫️ Leap of Faith: Lantai Ilusi | Tahan Saklar Penunjuk`;
    } else if (level.id === 18) {
      hudDDS.textContent = `🧱 Panic Room: Dinding Bergerak! Cepat Panjat Tebing!`;
    } else if (level.id === 19) {
      hudDDS.textContent = `🕯️ Tethered in Dark: Terikat Bersama di Kegelapan`;
    } else if (level.id === 20) {
      hudDDS.textContent = `⚙️ Ultimate Machine: Generator + Lantai Ilusi`;
    } else {
      hudDDS.textContent = `⚙ DDS: ${pCount} Pemain (Skala ${pCount - 1}x)`;
    }
  }

  btnLeave.classList.remove('hidden');
  if (isHost) btnEndGame.classList.remove('hidden');

  showScreen('game');
  if (!animRunning) {
    animRunning = true;
    requestAnimationFrame(renderLoop);
  }
});

socket.on('gameState', ({ players, keyCollected: kc, boxes, buttons, bridges, gates, lasers, springboards, slingshot, movingPlatforms, seesaws, torches, generatorWheels, invisiblePlatforms, compactorWall, camX }) => {
  lastSnapshot              = players;
  keyCollected              = kc;
  currentBoxes              = boxes || [];
  currentButtons            = buttons || [];
  currentBridges            = bridges || [];
  currentGates              = gates || [];
  currentLasers             = lasers || [];
  currentSpringboards       = springboards || [];
  currentSlingshot          = slingshot || null;
  currentMovingPlatforms    = movingPlatforms || [];
  currentSeesaws            = seesaws || [];
  currentTorches            = torches || [];
  currentGeneratorWheels    = generatorWheels || [];
  currentInvisiblePlatforms = invisiblePlatforms || [];
  currentCompactorWall      = compactorWall || null;
  currentCamX               = camX || 0;

  hudPlayers.textContent = `👥 ${players.length} Pemain`;
  if (kc && !hudKeyStatus.classList.contains('collected')) {
    hudKeyStatus.textContent = '🔑 Kunci: Berhasil Diambil!';
    hudKeyStatus.classList.add('collected');
  }
});

socket.on('slingshotFired', ({ tension }) => {
  showGameNotif(`🚀 WUSSHHH! Rekanmu terlontar melintasi jurang (${Math.round(tension * 100)}% Daya)!`);
  canvas.style.transform = 'translateY(-5px)';
  setTimeout(() => { canvas.style.transform = ''; }, 120);
});

socket.on('keyCollected', () => {
  keyCollected = true;
  hudKeyStatus.textContent = '🔑 Kunci: Berhasil Diambil!';
  hudKeyStatus.classList.add('collected');
  canvas.style.boxShadow = '0 0 50px #f59e0b';
  setTimeout(() => { canvas.style.boxShadow = ''; }, 700);
});

socket.on('levelRetryNotification', ({ by }) => {
  showGameNotif(`🔄 Level diulang oleh ${by || 'rekan tim'}!`);
  canvas.style.outline = '3px solid #f59e0b';
  setTimeout(() => { canvas.style.outline = ''; }, 400);
});

socket.on('playerVaporized', ({ name }) => {
  showGameNotif(`⚡ ${name || 'Rekan'} terkena rintangan laser!`);
  canvas.style.outline = '3px solid #ff0033';
  setTimeout(() => { canvas.style.outline = ''; }, 400);
});

socket.on('levelComplete', ({ level, hasNext, nextLevelName }) => {
  showScreen('win');
  if (btnNextLevel) {
    if (hasNext && isHost) {
      btnNextLevel.classList.remove('hidden');
      btnNextLevel.textContent = `▶ Level Selanjutnya (${nextLevelName || 'Next'})`;
    } else {
      btnNextLevel.classList.add('hidden');
    }
  }
});

socket.on('leftGame', () => {
  resetToLobby();
  showScreen('lobby');
});

socket.on('backToLobby', () => {
  resetToLobby();
  showScreen('lobby');
});

socket.on('playerLeft', ({ id, name }) => {
  if (lastSnapshot) lastSnapshot = lastSnapshot.filter(p => p.id !== id);
  showGameNotif(`${name || 'Seorang pemain'} keluar dari game`);
});

socket.on('playerRoster', ({ players }) => {
  const me = players.find(p => p.id === myId);
  if (me?.isHost && !isHost) {
    isHost = true;
    btnEndGame.classList.remove('hidden');
    showGameNotif('Kamu sekarang adalah Host room!');
  }
});

// Inisialisasi awal grid level
renderLevelGrid();

// ─── Rendering Loop (Shared Viewport Camera) ─────────────────────────────────
function renderLoop() {
  if (!animRunning) return;
  requestAnimationFrame(renderLoop);
  if (!currentLevel || !lastSnapshot) return;

  // ── Dynamic Zoom & Cinematic Camera Controller (Level 11 & Slingshot) ─────
  let targetCamZoom = 1.0;
  let targetCamX = currentCamX;

  if (currentLevel.id === 11) {
    const launchedPlayer = lastSnapshot.find(p => p.isLaunched || p.vx > 250);
    const isAiming = isDraggingSlingshot || (currentSlingshot && currentSlingshot.ammoId && (currentSlingshot.isPulling || dragTensionRatio > 0.05));

    if (isAiming) {
      // 🦅 ZOOM OUT PANORAMIK (Gaya Asli Angry Birds):
      // Menampilkan seluruh dunia dari tebing kiri sampai tebing kanan (x: 0 s/d 2800)
      targetCamZoom = 0.44;
      targetCamX = 0;
    } else if (launchedPlayer) {
      // 🚀 ACTION / BULLET CAM:
      // Zoom-in dan kamera mulus mengikuti kawan yang sedang terbang melintasi jurang
      targetCamZoom = 0.88;
      const visibleW = VIEW_W / targetCamZoom;
      targetCamX = Math.max(0, Math.min(currentLevel.worldW - visibleW, launchedPlayer.x - visibleW * 0.4));
    } else {
      // 📷 SWITCH CAMERA CONTROLLER:
      if (selectedCamMode === 'slingshot') {
        // Fokus ke tebing kiri & ketapel (x: 0 s/d 1200)
        targetCamZoom = 1.0;
        targetCamX = 0;
      } else if (selectedCamMode === 'seberang') {
        // Fokus ke tebing kanan & rintangan ledge (x: 1600 s/d 2800)
        targetCamZoom = 1.0;
        targetCamX = Math.max(0, currentLevel.worldW - VIEW_W);
      } else if (selectedCamMode === 'panorama') {
        // Tampilan panorama penuh
        targetCamZoom = 0.44;
        targetCamX = 0;
      } else { // 'myPlayer' (Default mengikuti posisi karakter saya sendiri)
        const me = lastSnapshot.find(p => p.id === myId);
        targetCamZoom = 1.0;
        if (me) {
          targetCamX = Math.max(0, Math.min(currentLevel.worldW - VIEW_W, me.x - VIEW_W / 2));
        } else {
          targetCamX = currentCamX;
        }
      }
    }
  }

  // Smooth interpolation (lerp) untuk zoom dan posisi kamera
  renderCamZoom += (targetCamZoom - renderCamZoom) * 0.08;
  renderCamX    += (targetCamX - renderCamX) * 0.12;

  // Selaraskan dasar lantai ke bagian bawah layar saat zoom out
  const visibleWorldH = VIEW_H / renderCamZoom;
  const targetCamY = renderCamZoom < 0.98 ? (600 - visibleWorldH) : 0;
  renderCamY += (targetCamY - renderCamY) * 0.12;

  const scale = parseFloat(canvas.dataset.scale) || 1;
  ctx.save();
  ctx.scale(scale, scale);

  // Background statis/parallax di layar
  drawBackground(renderCamX);

  // Geser & Skala koordinat dunia berdasarkan posisi & zoom kamera!
  ctx.save();
  ctx.scale(renderCamZoom, renderCamZoom);
  ctx.translate(-renderCamX, -renderCamY);

  drawTiles();
  drawInvisiblePlatforms();
  drawBridges();
  drawMovingPlatforms();
  drawSeesaws();
  drawGates();
  drawButtons();
  drawGeneratorWheels();
  drawCompactorWall();
  drawSpringboards();
  drawLasers();
  drawSlingshot();
  drawBoxes();
  drawKey();
  drawTorches();
  drawDoor();
  drawTethers();
  drawPlayers();
  drawDoorProgress();

  ctx.restore();

  // Darkness & Obor Fog of War Mask
  drawDarknessMask();

  // Indikator tepi layar (Pico Park Screen Constraint) jika zoom normal
  if (renderCamZoom > 0.92) {
    drawScreenConstraintsIndicator();
  }

  // 🎥 Overlay Badge Zoom Dinamis di Layar (Level 11)
  if (currentLevel.id === 11 && renderCamZoom < 0.95) {
    drawCinematicCamBadge();
  }

  ctx.restore();
}

// ── Overlay Badge Zoom Dinamis (Angry Birds Cinematic Camera) ───────────────
function drawCinematicCamBadge() {
  ctx.save();
  const isDark = document.body.classList.contains('dark-theme');
  const launched = lastSnapshot && lastSnapshot.find(p => p.isLaunched || p.vx > 250);
  const isAiming = isDraggingSlingshot || (currentSlingshot && currentSlingshot.ammoId && (currentSlingshot.isPulling || dragTensionRatio > 0.05));

  let text = '';
  let color = '#38bdf8';
  if (isAiming) {
    text = '🦅 PANORAMA VIEW (ANGRY BIRDS) — TEBING KANAN & SASARAN TERLIHAT PENUH';
    color = '#f59e0b';
  } else if (launched) {
    text = `🚀 ACTION CAM — MENGIKUTI PENERBANGAN ${launched.name.toUpperCase()}!`;
    color = '#10b981';
  }

  if (text) {
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    const txtW = ctx.measureText(text).width + 24;
    const badgeX = VIEW_W / 2 - txtW / 2;
    const badgeY = 16;

    ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)';
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    roundRect(ctx, badgeX, badgeY, txtW, 24, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.fillText(text, VIEW_W / 2, badgeY + 16);
  }
  ctx.restore();
}

// ── Background (Adaptif & Parallax Awan) ──────────────────────────────────────
function drawBackground(camX) {
  const isDark = document.body.classList.contains('dark-theme');

  // Khusus Level 12: Sunset Alpine Mountain (Tema Puncak Timbangan)
  if (currentLevel && currentLevel.id === 12) {
    drawLevel12Background(camX, isDark);
    return;
  }

  if (isDark) {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#0a0d17');
    grad.addColorStop(1, '#131b2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    [[80,40],[200,25],[350,60],[500,20],[700,45],[900,30],[1100,55],
     [150,80],[600,70],[1000,90],[430,110],[760,15],[50,120]].forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    grad.addColorStop(0, '#bae6fd');
    grad.addColorStop(0.7, '#e0f2fe');
    grad.addColorStop(1, '#f0f9ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    cloudOffset += 0.25;
    drawCuteClouds(camX, cloudOffset);
  }
}

function drawLevel12Background(camX, isDark) {
  ctx.save();
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  if (isDark) {
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.35, '#1e1b4b');
    grad.addColorStop(0.7, '#312e81');
    grad.addColorStop(1, '#020617');
  } else {
    grad.addColorStop(0, '#f97316'); // Golden Sunset
    grad.addColorStop(0.25, '#fb923c');
    grad.addColorStop(0.55, '#f472b6'); // Alpine Pink
    grad.addColorStop(0.85, '#a855f7'); // Twilight Purple
    grad.addColorStop(1, '#6366f1'); // Deep Indigo Valley
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Matahari Terbenam / Bulan Gunung
  const sunX = VIEW_W * 0.72 - (camX * 0.04) % (VIEW_W + 300);
  const sunY = 150;
  const sunGrad = ctx.createRadialGradient(sunX, sunY, 15, sunX, sunY, 110);
  if (isDark) {
    sunGrad.addColorStop(0, 'rgba(254, 240, 138, 0.95)');
    sunGrad.addColorStop(0.35, 'rgba(250, 204, 21, 0.4)');
    sunGrad.addColorStop(1, 'rgba(250, 204, 21, 0)');
  } else {
    sunGrad.addColorStop(0, 'rgba(255, 247, 237, 1)');
    sunGrad.addColorStop(0.25, 'rgba(254, 215, 170, 0.8)');
    sunGrad.addColorStop(0.6, 'rgba(249, 115, 22, 0.35)');
    sunGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
  }
  ctx.fillStyle = sunGrad;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 110, 0, Math.PI * 2);
  ctx.fill();

  // Pegunungan Alpine Lapis 1 (Jauh - Siluet Ungu Berkabut)
  ctx.fillStyle = isDark ? 'rgba(30, 27, 75, 0.65)' : 'rgba(107, 33, 168, 0.4)';
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  const farOffset = (camX * 0.12) % 600;
  for (let x = -600; x <= VIEW_W + 600; x += 300) {
    const px = x - farOffset;
    ctx.lineTo(px, VIEW_H - 170);
    ctx.lineTo(px + 140, VIEW_H - 310);
    ctx.lineTo(px + 300, VIEW_H - 170);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.closePath();
  ctx.fill();

  // Pegunungan Alpine Lapis 2 (Menengah - Puncak Runcing Siluet Gelap)
  ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(76, 29, 149, 0.6)';
  ctx.beginPath();
  ctx.moveTo(0, VIEW_H);
  const midOffset = (camX * 0.22) % 400;
  for (let x = -400; x <= VIEW_W + 400; x += 200) {
    const px = x - midOffset;
    ctx.lineTo(px, VIEW_H - 110);
    ctx.lineTo(px + 90, VIEW_H - 220);
    ctx.lineTo(px + 200, VIEW_H - 110);
  }
  ctx.lineTo(VIEW_W, VIEW_H);
  ctx.closePath();
  ctx.fill();

  // Parallax Awan Senja Lembut
  cloudOffset += 0.2;
  drawCuteClouds(camX, cloudOffset);
  ctx.restore();
}

function drawCuteClouds(camX, offset) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';

  const clouds = [
    { x: 100, y: 70, s: 44 },
    { x: 380, y: 45, s: 52 },
    { x: 680, y: 85, s: 46 },
    { x: 960, y: 55, s: 50 },
    { x: 1220, y: 75, s: 48 },
    { x: 1540, y: 40, s: 54 },
    { x: 1880, y: 90, s: 42 },
    { x: 2200, y: 60, s: 52 }
  ];

  clouds.forEach(c => {
    // Parallax scrolling: awan bergerak lebih lambat dari kamera
    const screenX = (c.x + offset - camX * 0.3) % (VIEW_W + 300) - 100;
    ctx.beginPath();
    ctx.arc(screenX, c.y, c.s * 0.45, 0, Math.PI * 2);
    ctx.arc(screenX + c.s * 0.35, c.y - c.s * 0.15, c.s * 0.4, 0, Math.PI * 2);
    ctx.arc(screenX + c.s * 0.7, c.y, c.s * 0.35, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.restore();
}

// ── Tilemap (Ubin Platform) ──────────────────────────────────────────────────
function drawTiles() {
  const { tiles, tileSize: ts } = currentLevel;
  const isDark = document.body.classList.contains('dark-theme');

  for (let r = 0; r < tiles.length; r++) {
    const row = tiles[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== '1') continue;
      const tx = c * ts, ty = r * ts;

      if (isDark) {
        const tg = ctx.createLinearGradient(tx, ty, tx, ty + ts);
        tg.addColorStop(0, '#2e3856');
        tg.addColorStop(1, '#1c2236');
        ctx.fillStyle = tg;
        ctx.fillRect(tx, ty, ts, ts);

        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(tx, ty, ts, 4);

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth   = 0.5;
        ctx.strokeRect(tx + 0.25, ty + 0.25, ts - 0.5, ts - 0.5);
      } else {
        const tg = ctx.createLinearGradient(tx, ty, tx, ty + ts);
        tg.addColorStop(0, '#475569');
        tg.addColorStop(1, '#334155');
        ctx.fillStyle = tg;
        ctx.fillRect(tx, ty, ts, ts);

        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(tx, ty, ts, 5);

        ctx.strokeStyle = 'rgba(255,255,255,0.15)';
        ctx.lineWidth   = 0.5;
        ctx.strokeRect(tx + 0.25, ty + 0.25, ts - 0.5, ts - 0.5);
      }
    }
  }
}

// ── Dynamic Bridges (DDS) ────────────────────────────────────────────────────
function drawBridges() {
  energyAnim += 0.05;
  currentBridges.forEach(brg => {
    if (brg.active) {
      ctx.save();
      ctx.shadowColor = '#0284c7';
      ctx.shadowBlur  = 18;

      const bg = ctx.createLinearGradient(brg.x, brg.y, brg.x, brg.y + brg.h);
      bg.addColorStop(0, '#38bdf8');
      bg.addColorStop(1, '#0284c7');
      ctx.fillStyle = bg;
      roundRect(ctx, brg.x, brg.y, brg.w, brg.h, 4);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth   = 2;
      const step = 28;
      const offset = (energyAnim * 20) % step;
      for (let x = brg.x + offset; x < brg.x + brg.w - 8; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, brg.y + 2);
        ctx.lineTo(x + 10, brg.y + brg.h - 2);
        ctx.stroke();
      }
      ctx.restore();
    } else if (!brg.hideInactive) {
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.45)';
      ctx.lineWidth   = 2;
      ctx.strokeRect(brg.x, brg.y, brg.w, brg.h);

      if (brg.w < 600) {
        ctx.fillStyle   = 'rgba(2, 132, 199, 0.75)';
        ctx.font        = 'bold 11px Segoe UI';
        ctx.textAlign   = 'center';
        ctx.fillText('⚡ INJAK SEMUA TOMBOL UNTUK NYALAKAN JEMBATAN ⚡', brg.x + brg.w / 2, brg.y + brg.h + 20);
      }
      ctx.restore();
    }
  });
}

// ── Moving Platforms (Level 8 Electric Ferry) ─────────────────────────────────
function drawMovingPlatforms() {
  if (!currentMovingPlatforms || currentMovingPlatforms.length === 0) return;
  currentMovingPlatforms.forEach(mp => {
    ctx.save();

    // Thruster hover glow underneath
    ctx.shadowColor = '#38bdf8';
    ctx.shadowBlur = 12;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.beginPath();
    ctx.ellipse(mp.x + mp.w / 2, mp.y + mp.h + 6, mp.w * 0.42, 6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ferry Hull
    const hullGrad = ctx.createLinearGradient(mp.x, mp.y, mp.x, mp.y + mp.h);
    hullGrad.addColorStop(0, '#475569');
    hullGrad.addColorStop(0.5, '#1e293b');
    hullGrad.addColorStop(1, '#0f172a');
    ctx.fillStyle = hullGrad;
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    roundRect(ctx, mp.x, mp.y, mp.w, mp.h, 6);
    ctx.fill();
    ctx.stroke();

    // Top deck neon surface
    ctx.fillStyle = '#06b6d4';
    ctx.fillRect(mp.x + 4, mp.y + 2, mp.w - 8, 3);

    // Hazard / propulsion stripes
    const stripeStep = 24;
    ctx.strokeStyle = 'rgba(255, 214, 10, 0.65)';
    ctx.lineWidth = 2;
    for (let sx = mp.x + 8; sx < mp.x + mp.w - 8; sx += stripeStep) {
      ctx.beginPath();
      ctx.moveTo(sx, mp.y + 6);
      ctx.lineTo(sx + 8, mp.y + mp.h - 4);
      ctx.stroke();
    }

    // Label
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🚢 FERI PENGANGKUT', mp.x + mp.w / 2, mp.y - 8);

    ctx.restore();
  });
}

// ── Seesaws (Level 12 The Balance) ───────────────────────────────────────────
function drawSeesaws() {
  if (!currentSeesaws || currentSeesaws.length === 0) return;
  const isDark = document.body.classList.contains('dark-theme');

  currentSeesaws.forEach(sw => {
    ctx.save();
    const halfL = sw.length / 2;
    const h = sw.thickness || 14;
    const curAngle = sw.angle || 0;
    const deg = (curAngle * 180 / Math.PI);
    const isBalanced = Math.abs(curAngle) < 0.035;

    // 1. Fulcrum Stand (Heavy Industrial Triangular A-Frame)
    const standW = 44;
    const standH = 34;
    const baseGrad = ctx.createLinearGradient(sw.pivotX - standW / 2, sw.pivotY, sw.pivotX + standW / 2, sw.pivotY + standH);
    baseGrad.addColorStop(0, isDark ? '#334155' : '#64748b');
    baseGrad.addColorStop(0.5, isDark ? '#1e293b' : '#475569');
    baseGrad.addColorStop(1, isDark ? '#0f172a' : '#334155');

    ctx.fillStyle = baseGrad;
    ctx.strokeStyle = isDark ? '#64748b' : '#1e293b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(sw.pivotX, sw.pivotY);
    ctx.lineTo(sw.pivotX - standW / 2, sw.pivotY + standH);
    ctx.lineTo(sw.pivotX + standW / 2, sw.pivotY + standH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Cross-strut detail on stand
    ctx.strokeStyle = isDark ? '#475569' : '#94a3b8';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(sw.pivotX - 10, sw.pivotY + 16);
    ctx.lineTo(sw.pivotX + 10, sw.pivotY + 16);
    ctx.stroke();

    // 2. Rotating Beam
    ctx.save();
    ctx.translate(sw.pivotX, sw.pivotY);
    ctx.rotate(curAngle);

    // Dynamic glow if balanced or active
    if (isBalanced) {
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur = 10;
    } else {
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 4;
    }

    // Heavy reinforced beam gradient
    const beamGrad = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
    if (isDark) {
      beamGrad.addColorStop(0, '#475569');
      beamGrad.addColorStop(0.4, '#334155');
      beamGrad.addColorStop(1, '#1e293b');
    } else {
      beamGrad.addColorStop(0, '#f8fafc');
      beamGrad.addColorStop(0.3, '#cbd5e1');
      beamGrad.addColorStop(0.7, '#94a3b8');
      beamGrad.addColorStop(1, '#64748b');
    }

    ctx.fillStyle = beamGrad;
    ctx.strokeStyle = isBalanced ? '#10b981' : (isDark ? '#38bdf8' : '#0284c7');
    ctx.lineWidth = 2;
    roundRect(ctx, -halfL, -h / 2, sw.length, h, 4);
    ctx.fill();
    ctx.stroke();

    // Tread lines / grip pattern across the beam
    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.15)';
    ctx.lineWidth = 1;
    for (let gx = -halfL + 25; gx < halfL - 20; gx += 20) {
      ctx.beginPath();
      ctx.moveTo(gx, -h / 2 + 2);
      ctx.lineTo(gx + 6, h / 2 - 2);
      ctx.stroke();
    }

    // Colored non-slip hazard edges
    // Left edge (Merah / Rose)
    ctx.fillStyle = '#ef4444';
    roundRect(ctx, -halfL + 2, -h / 2 - 2, 48, 4, 2);
    ctx.fill();
    // Right edge (Hijau Emerald)
    ctx.fillStyle = '#10b981';
    roundRect(ctx, halfL - 50, -h / 2 - 2, 48, 4, 2);
    ctx.fill();

    // Center balance marker
    ctx.fillStyle = isBalanced ? '#10b981' : '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 - 4);
    ctx.lineTo(-4, -h / 2);
    ctx.lineTo(4, -h / 2);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // 3. Heavy Pivot Axle Pin (drawn on top of beam)
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sw.pivotX, sw.pivotY, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(sw.pivotX, sw.pivotY, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // 4. Tilt Angle HUD Readout Pill (below fulcrum)
    const meterY = sw.pivotY + standH + 14;
    ctx.font = 'bold 10px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    let meterText = `⚖️ ${Math.abs(deg).toFixed(1)}°`;
    if (isBalanced) {
      meterText = `⚖️ 0.0° (SEIMBANG)`;
    } else if (deg > 0) {
      meterText = `⚖️ ${deg.toFixed(1)}° ▶`;
    } else {
      meterText = `◀ ${Math.abs(deg).toFixed(1)}° ⚖️`;
    }

    const mMetrics = ctx.measureText(meterText);
    const pillW = Math.max(76, mMetrics.width + 16);
    const pillH = 18;

    ctx.fillStyle = isDark ? 'rgba(15, 23, 42, 0.85)' : 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = isBalanced ? '#10b981' : (Math.abs(deg) > 15 ? '#ef4444' : '#38bdf8');
    ctx.lineWidth = 1.5;
    roundRect(ctx, sw.pivotX - pillW / 2, meterY - pillH / 2, pillW, pillH, 9);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = isBalanced ? '#10b981' : (isDark ? '#e2e8f0' : '#1e293b');
    ctx.fillText(meterText, sw.pivotX, meterY);

    ctx.restore();
  });
}

// ── Invisible Platforms (Level 17 & 20 Lantai Ilusi) ─────────────────────────
function drawInvisiblePlatforms() {
  if (!currentInvisiblePlatforms || currentInvisiblePlatforms.length === 0) return;
  currentInvisiblePlatforms.forEach(ip => {
    if (ip.isRevealed) {
      ctx.save();
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 14;

      const grad = ctx.createLinearGradient(ip.x, ip.y, ip.x, ip.y + ip.h);
      grad.addColorStop(0, 'rgba(6, 182, 212, 0.85)');
      grad.addColorStop(1, 'rgba(14, 116, 144, 0.95)');
      ctx.fillStyle = grad;
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 2;
      roundRect(ctx, ip.x, ip.y, ip.w, ip.h, 4);
      ctx.fill();
      ctx.stroke();

      // Magical rune / sparkle pattern
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      for (let rx = ip.x + 12; rx < ip.x + ip.w - 8; rx += 28) {
        ctx.beginPath();
        ctx.arc(rx, ip.y + ip.h / 2, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  });
}

// ── Generator Wheels (Level 16 & 20 Hamster Power) ───────────────────────────
function drawGeneratorWheels() {
  if (!currentGeneratorWheels || currentGeneratorWheels.length === 0) return;
  currentGeneratorWheels.forEach(gw => {
    ctx.save();
    const r = gw.radius || 48;
    const pwr = gw.power || 0;

    // Glowing energy ring on floor
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.arc(gw.x, gw.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Charged arc
    if (pwr > 0) {
      ctx.strokeStyle = pwr >= 100 ? '#22c55e' : '#38bdf8';
      ctx.shadowColor = pwr >= 100 ? '#22c55e' : '#38bdf8';
      ctx.shadowBlur = 12;
      ctx.lineWidth = 8;
      ctx.beginPath();
      const startA = -Math.PI / 2;
      const endA = startA + (Math.PI * 2 * (pwr / 100));
      ctx.arc(gw.x, gw.y, r, startA, endA);
      ctx.stroke();
    }

    // Outer wheel rim
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(gw.x, gw.y, r, 0, Math.PI * 2);
    ctx.stroke();

    // Rotating inner spokes
    ctx.save();
    ctx.translate(gw.x, gw.y);
    ctx.rotate(gw.rotation || 0);
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * (r - 2), Math.sin(a) * (r - 2));
      ctx.stroke();
    }
    ctx.restore();

    // Power text label
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`⚡ ${Math.round(pwr)}%`, gw.x, gw.y - r - 12);

    if (gw.reqRunners > 1) {
      ctx.font = '10px Segoe UI, sans-serif';
      ctx.fillStyle = gw.currentRunners >= gw.reqRunners ? '#4ade80' : '#f59e0b';
      ctx.fillText(`Pelari: ${gw.currentRunners || 0}/${gw.reqRunners}`, gw.x, gw.y - r - 26);
    }
    ctx.restore();
  });
}

// ── Compactor Wall (Level 18 Panic Room) ──────────────────────────────────────
function drawCompactorWall() {
  if (!currentCompactorWall || !currentCompactorWall.active) return;
  const cw = currentCompactorWall;
  ctx.save();

  // Massive dark steel compactor body
  const grad = ctx.createLinearGradient(cw.currentX, 0, cw.currentX + cw.w, 0);
  grad.addColorStop(0, '#0f172a');
  grad.addColorStop(0.7, '#1e293b');
  grad.addColorStop(1, '#334155');
  ctx.fillStyle = grad;
  ctx.fillRect(cw.currentX, 0, cw.w, 600);

  // Hazard diagonal chevrons on front face
  ctx.strokeStyle = 'rgba(234, 179, 8, 0.7)';
  ctx.lineWidth = 6;
  const step = 36;
  for (let y = 0; y < 600; y += step) {
    ctx.beginPath();
    ctx.moveTo(cw.currentX + cw.w - 18, y);
    ctx.lineTo(cw.currentX + cw.w - 4, y + 18);
    ctx.stroke();
  }

  // Grinding diamond spikes along front crushing edge
  ctx.fillStyle = '#cbd5e1';
  ctx.strokeStyle = '#64748b';
  ctx.lineWidth = 1;
  const spikeH = 24;
  for (let y = 0; y < 600; y += spikeH) {
    ctx.beginPath();
    ctx.moveTo(cw.currentX + cw.w, y);
    ctx.lineTo(cw.currentX + cw.w + 14, y + spikeH / 2);
    ctx.lineTo(cw.currentX + cw.w, y + spikeH);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // Red warning alarm beacon on top
  const alarmPulse = (Math.sin(Date.now() * 0.015) + 1) / 2;
  ctx.fillStyle = `rgba(239, 68, 68, ${0.4 + alarmPulse * 0.6})`;
  ctx.shadowColor = '#ef4444';
  ctx.shadowBlur = 16 * alarmPulse;
  ctx.beginPath();
  ctx.arc(cw.currentX + cw.w - 14, 30, 10, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

// ── Torches (Level 15 & 19 Darkness & Obor) ───────────────────────────────────
function drawTorches() {
  if (!currentTorches || currentTorches.length === 0) return;
  currentTorches.forEach(t => {
    ctx.save();
    // Torch handle
    ctx.fillStyle = '#78350f';
    ctx.fillRect(t.x - 3, t.y, 6, 18);

    // Brazier cup
    ctx.fillStyle = '#b45309';
    ctx.beginPath();
    ctx.moveTo(t.x - 6, t.y);
    ctx.lineTo(t.x + 6, t.y);
    ctx.lineTo(t.x + 4, t.y + 4);
    ctx.lineTo(t.x - 4, t.y + 4);
    ctx.closePath();
    ctx.fill();

    // Flickering fire flame
    const flameFlicker = Math.sin(Date.now() * 0.02) * 2;
    const flameGrad = ctx.createRadialGradient(t.x, t.y - 4, 1, t.x, t.y - 4, 10);
    flameGrad.addColorStop(0, '#ffffff');
    flameGrad.addColorStop(0.3, '#fde047');
    flameGrad.addColorStop(0.7, '#f97316');
    flameGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');

    ctx.fillStyle = flameGrad;
    ctx.shadowColor = '#f97316';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(t.x + flameFlicker, t.y - 5, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  });
}

// ── Tethers (Level 14 & 19 Tali Kematian) ─────────────────────────────────────
function drawTethers() {
  if (!currentLevel || !currentLevel.hasTether) return;
  if (!lastSnapshot || lastSnapshot.length < 2) return;

  const maxDist = (currentLevel.tether && currentLevel.tether.maxDistance) || 165;

  ctx.save();
  for (let i = 0; i < lastSnapshot.length - 1; i++) {
    const p1 = lastSnapshot[i];
    const p2 = lastSnapshot[i + 1];

    const x1 = p1.x + 18;
    const y1 = p1.y + 18;
    const x2 = p2.x + 18;
    const y2 = p2.y + 18;

    const dist = Math.hypot(x2 - x1, y2 - y1);
    const tension = Math.min(1.0, dist / maxDist);

    const isTense = tension > 0.82;
    ctx.strokeStyle = isTense ? '#f43f5e' : (tension > 0.6 ? '#f59e0b' : '#38bdf8');
    ctx.lineWidth = isTense ? 3 : 2.5;
    ctx.shadowColor = ctx.strokeStyle;
    ctx.shadowBlur = isTense ? 10 : 6;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    const midX = (x1 + x2) / 2;
    const sag = Math.max(0, (1.0 - tension) * 18);
    const midY = (y1 + y2) / 2 + sag;
    ctx.quadraticCurveTo(midX, midY, x2, y2);
    ctx.stroke();

    ctx.fillStyle = ctx.strokeStyle;
    ctx.beginPath();
    ctx.arc(x1, y1, 3.5, 0, Math.PI * 2);
    ctx.arc(x2, y2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// ── Darkness & Obor (Fog of War Composite Mask) ──────────────────────────────
function drawDarknessMask() {
  if (!currentLevel || !currentLevel.darkness || !currentLevel.darkness.enabled) return;

  if (!lightingCanvas) {
    lightingCanvas = document.createElement('canvas');
  }
  lightingCanvas.width = VIEW_W;
  lightingCanvas.height = VIEW_H;
  const lctx = lightingCanvas.getContext('2d');

  // Layar hitam pekat
  lctx.fillStyle = 'rgba(5, 7, 14, 0.965)';
  lctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // Mode destination-out: memotong lubang cahaya transparan
  lctx.globalCompositeOperation = 'destination-out';

  // 1. Lubang cahaya Obor
  const torch = currentTorches && currentTorches[0];
  if (torch) {
    const tx = (torch.x - renderCamX) * renderCamZoom;
    const ty = (torch.y - renderCamY) * renderCamZoom;
    const baseR = (currentLevel.darkness.torchRadius || 230) * renderCamZoom;

    const flicker = (Math.sin(Date.now() * 0.014) * 8 + Math.cos(Date.now() * 0.028) * 5) * renderCamZoom;
    const r = Math.max(80, baseR + flicker);

    const grad = lctx.createRadialGradient(tx, ty, 20 * renderCamZoom, tx, ty, r);
    grad.addColorStop(0, 'rgba(0,0,0,1.0)');
    grad.addColorStop(0.65, 'rgba(0,0,0,0.85)');
    grad.addColorStop(0.9, 'rgba(0,0,0,0.3)');
    grad.addColorStop(1, 'rgba(0,0,0,0.0)');

    lctx.fillStyle = grad;
    lctx.beginPath();
    lctx.arc(tx, ty, r, 0, Math.PI * 2);
    lctx.fill();
  }

  // 2. Cahaya ambient di sekitar masing-masing karakter
  (lastSnapshot || []).forEach(p => {
    const px = (p.x + 18 - renderCamX) * renderCamZoom;
    const py = (p.y + 18 - renderCamY) * renderCamZoom;
    const ambR = (currentLevel.darkness.ambientRadius || 50) * renderCamZoom;

    const pGrad = lctx.createRadialGradient(px, py, 6 * renderCamZoom, px, py, ambR);
    pGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
    pGrad.addColorStop(0.8, 'rgba(0,0,0,0.25)');
    pGrad.addColorStop(1, 'rgba(0,0,0,0.0)');

    lctx.fillStyle = pGrad;
    lctx.beginPath();
    lctx.arc(px, py, ambR, 0, Math.PI * 2);
    lctx.fill();
  });

  lctx.globalCompositeOperation = 'source-over';

  // Gambar lapisan kegelapan ke atas layar utama
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const scale = parseFloat(canvas.dataset.scale) || 1;
  ctx.scale(scale, scale);
  ctx.drawImage(lightingCanvas, 0, 0);
  ctx.restore();
}

// ── Dynamic Gates (Anti-Strand Gate Barriers) ─────────────────────────────────
function drawGates() {
  currentGates.forEach(gate => {
    ctx.save();
    if (!gate.open) {
      // Gerbang Tertutup: Pagar baja bertulang dengan aksen hazard
      ctx.fillStyle = '#1e293b';
      roundRect(ctx, gate.x, gate.y, gate.w, gate.h, 6);
      ctx.fill();

      // Border oranye hazard
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth   = 3;
      ctx.stroke();

      // Kisi-kisi gerbang baja
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
      ctx.lineWidth   = 2;
      for (let y = gate.y + 14; y < gate.y + gate.h - 4; y += 14) {
        ctx.beginPath();
        ctx.moveTo(gate.x + 6, y);
        ctx.lineTo(gate.x + gate.w - 6, y);
        ctx.stroke();
      }

      // Ikon gembok dan label gerbang
      ctx.fillStyle = '#f59e0b';
      ctx.font      = 'bold 11px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText(`🔒 ${gate.label || 'GERBANG'}`, gate.x + gate.w / 2, gate.y - 10);
    } else {
      // Gerbang Terbuka: bingkai hijau neon menyala, lorong tembus
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth   = 2;
      ctx.setLineDash([6, 4]);
      roundRect(ctx, gate.x, gate.y, gate.w, gate.h, 6);
      ctx.stroke();

      ctx.fillStyle = 'rgba(16, 185, 129, 0.12)';
      ctx.fillRect(gate.x, gate.y, gate.w, gate.h);

      ctx.fillStyle = '#10b981';
      ctx.font      = 'bold 11px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText(`🔓 ${gate.label || 'GERBANG'} TERBUKA`, gate.x + gate.w / 2, gate.y - 10);
    }
    ctx.restore();
  });
}

// ── Dynamic Buttons (DDS) ────────────────────────────────────────────────────
function drawButtons() {
  currentButtons.forEach(btn => {
    if (!btn.active) return;

    const isPressed = btn.pressed || btn.latched;
    const pressOffset = isPressed ? 4 : 0;
    const h = btn.h - pressOffset;
    const y = btn.y + pressOffset;

    ctx.fillStyle = '#1e293b';
    roundRect(ctx, btn.x - 2, btn.y + 6, btn.w + 4, btn.h, 3);
    ctx.fill();

    ctx.save();
    if (isPressed) {
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur  = 16;
      ctx.fillStyle   = '#10b981';
    } else {
      ctx.shadowColor = btn.isLatch ? '#38bdf8' : '#f59e0b';
      ctx.shadowBlur  = 12;
      ctx.fillStyle   = btn.isLatch ? '#38bdf8' : '#f59e0b';
    }
    roundRect(ctx, btn.x, y, btn.w, h, 3);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = isPressed ? '#10b981' : (btn.isLatch ? '#0284c7' : '#f59e0b');
    ctx.font      = 'bold 10px Segoe UI';
    ctx.textAlign = 'center';
    const label = btn.label || (btn.isLatch ? '🔒 KAIT' : (btn.laserIndex !== undefined ? `LASER #${btn.laserIndex + 1}` : `BTN #${btn.index + 1}`));
    ctx.fillText(label, btn.x + btn.w / 2, btn.y - 8);
  });
}

// ── Dynamic Lasers (Level 5 Hazard & Dual-Shield Co-op) ──────────────────────
function drawLasers() {
  laserAnim += 0.08;

  currentLasers.forEach(laser => {
    const isHorizontal = laser.orientation === 'horizontal';
    const isOff = keyCollected || laser.isBlocked || !laser.active;
    const isShielded = laser.blockedByShield;

    const lx = laser.x;
    const ly = laser.y;
    const lw = isHorizontal ? (isShielded && laser.cutRight ? Math.max(10, laser.cutRight - lx) : laser.w) : laser.w;
    const lh = !isHorizontal ? (isShielded && laser.cutBottom ? Math.max(10, laser.cutBottom - ly) : laser.h) : laser.h;

    // Emitter nodes
    ctx.fillStyle = '#1e293b';
    if (isHorizontal) {
      roundRect(ctx, lx - 10, ly - 4, 12, laser.h + 8, 3);
      ctx.fill();
      roundRect(ctx, lx + laser.w - 2, ly - 4, 12, laser.h + 8, 3);
      ctx.fill();
    } else {
      roundRect(ctx, lx - 4, ly - 10, laser.w + 8, 12, 3);
      ctx.fill();
      roundRect(ctx, lx - 4, ly + laser.h - 2, laser.w + 8, 12, 3);
      ctx.fill();
    }

    if (!isOff) {
      ctx.save();
      const pulse = Math.sin(laserAnim) * 4;
      const laserColor = laser.color || '#ff0033';
      ctx.shadowColor = laserColor;
      ctx.shadowBlur  = 20 + pulse;

      // Glow beam
      ctx.fillStyle = laser.color ? `${laser.color}cc` : 'rgba(255, 0, 51, 0.75)';
      ctx.fillRect(lx, ly, lw, lh);

      // Core putih
      ctx.fillStyle = '#ffffff';
      if (isHorizontal) {
        ctx.fillRect(lx, ly + laser.h / 2 - 2, lw, 4);
      } else {
        ctx.fillRect(lx + laser.w / 2 - 2, ly, 4, lh);
      }
      ctx.restore();

      // Percikan perisai jika sedang menahan laser (Deflection Spark)
      if (isShielded) {
        ctx.save();
        ctx.shadowColor = '#38bdf8';
        ctx.shadowBlur  = 25;
        ctx.fillStyle   = '#ffffff';
        const sparkX = isHorizontal ? lx + lw : lx + laser.w / 2;
        const sparkY = isHorizontal ? ly + laser.h / 2 : ly + lh;
        ctx.beginPath();
        ctx.arc(sparkX, sparkY, 8 + Math.sin(laserAnim * 2) * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle   = '#38bdf8';
        ctx.font        = 'bold 10px Segoe UI';
        ctx.textAlign   = 'center';
        ctx.fillText('⚡ SHIELDED!', sparkX, sparkY - 14);
        ctx.restore();
      } else {
        ctx.fillStyle = laserColor;
        ctx.font      = 'bold 9px Segoe UI';
        ctx.textAlign = 'center';
        const labelX = lx + laser.w / 2;
        const labelY = isHorizontal ? ly - 8 : ly - 14;
        const text = laser.color ? `⚡ LASER WARNA` : `⚡ LASER BAHAYA`;
        ctx.fillText(text, labelX, labelY);
      }
    } else {
      // Laser mati setelah kunci diambil
      ctx.save();
      ctx.setLineDash([4, 6]);
      ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (isHorizontal) {
        ctx.moveTo(lx, ly + laser.h / 2);
        ctx.lineTo(lx + laser.w, ly + laser.h / 2);
      } else {
        ctx.moveTo(lx + laser.w / 2, ly);
        ctx.lineTo(lx + laser.w / 2, ly + laser.h);
      }
      ctx.stroke();

      ctx.fillStyle = '#10b981';
      ctx.font      = 'bold 9px Segoe UI';
      ctx.textAlign = 'center';
      ctx.fillText('✓ AMAN', lx + laser.w / 2, ly - 10);
      ctx.restore();
    }
  });
}

// ── Springboards (Level 4 & 5 Bantalan Lompat) ────────────────────────────────
function drawSpringboards() {
  currentSpringboards.forEach(sb => {
    const squashOffset = (sb.squash || 0) * 6;

    // Plat besi bawah
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, sb.x - 4, sb.y + sb.h - 4, sb.w + 8, 8, 3);
    ctx.fill();

    // Pegas per di tengah
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth   = 2.5;
    ctx.beginPath();
    ctx.moveTo(sb.x + 12, sb.y + sb.h - 4);
    ctx.lineTo(sb.x + sb.w - 12, sb.y + 4 + squashOffset);
    ctx.stroke();

    // Pad lompat atas
    ctx.save();
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = '#f59e0b';
    roundRect(ctx, sb.x, sb.y + squashOffset, sb.w, sb.h - squashOffset, 4);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#d97706';
    ctx.font      = 'bold 9px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('▲ TRAMPOLIN ▲', sb.x + sb.w / 2, sb.y - 8);
  });
}

// ── Slingshot (Ketapel Manusia Co-op - Level 11) ─────────────────────────────
function drawSlingshot() {
  const sling = currentSlingshot;
  if (!sling) return;

  const { x, y, w, h, pouchX, pouchY, maxTension, tension, ammoId } = sling;
  const isDark = document.body.classList.contains('dark-theme');

  // Sudut & daya tarikan aktif (prioritaskan interaksi mouse lokal drag)
  const isDragging = isDraggingSlingshot;
  const tensionRatio = isDragging
    ? dragTensionRatio
    : (sling.isPulling ? Math.min(1, Math.max(0, (tension || 0) / (maxTension || 3.0))) : 0);
  const angle = isDragging
    ? dragAimAngle
    : (sling.angle || 0.785);
  const angleDeg = Math.round(angle * 180 / Math.PI);

  const stretchDist = tensionRatio * 52;
  const stretchX = Math.cos(angle) * stretchDist;
  const stretchY = Math.sin(angle) * (stretchDist * 0.6);

  const forkLeftX  = x + 10;
  const forkRightX = x + w - 10;
  const forkTopY   = y + 8;
  const pouchCurX  = pouchX - stretchX;
  const pouchCurY  = pouchY - 14 + stretchY;

  ctx.save();

  // 1. Dotted Parabolic Trajectory Preview & Landing Target Indicator
  if (tensionRatio > 0.05 || (isDragging && ammoId)) {
    ctx.save();

    // Hitung kecepatan berdasarkan daya tarikan Angry Birds (900 s/d 2300 px/s)
    const effTension = Math.max(0.12, tensionRatio);
    const speed = 900 + effTension * 1400;
    const previewVx = speed * Math.cos(angle);
    const previewVy = -speed * Math.sin(angle);
    const g = 1800;

    // Lacak lintasan parabola dan cari titik pendaratan (Landing Surface Collision)
    const points = [];
    let landing = null;

    for (let t = 0; t <= 2.2; t += 0.02) {
      const px = pouchCurX + previewVx * t;
      const py = pouchCurY + previewVy * t + 0.5 * g * t * t;
      points.push({ x: px, y: py });

      // Cek tabrakan dengan Ledge / Lantai
      // Peak: x [2520, 2760], y ~200
      if (px >= 2520 && px <= 2760 && py >= 195 && py <= 235) {
        landing = { x: px, y: 200, name: 'PUNCAK (KEY)', color: '#f59e0b', ok: true };
        break;
      }
      // Ledge 3: x [2360, 2520], y ~280
      if (px >= 2360 && px <= 2520 && py >= 275 && py <= 315) {
        landing = { x: px, y: 280, name: 'LEDGE #3', color: '#a855f7', ok: true };
        break;
      }
      // Ledge 2: x [2160, 2320], y ~360
      if (px >= 2160 && px <= 2320 && py >= 355 && py <= 395) {
        landing = { x: px, y: 360, name: 'LEDGE #2', color: '#06b6d4', ok: true };
        break;
      }
      // Ledge 1: x [1920, 2120], y ~440
      if (px >= 1920 && px <= 2120 && py >= 435 && py <= 475) {
        landing = { x: px, y: 440, name: 'LEDGE #1', color: '#10b981', ok: true };
        break;
      }
      // Step: x [1840, 1920], y ~520
      if (px >= 1840 && px <= 1920 && py >= 515 && py <= 545) {
        landing = { x: px, y: 520, name: 'TANGGA DASAR', color: '#38bdf8', ok: true };
        break;
      }
      // Lantai dasar tebing kanan (x >= 1840, y >= 555)
      if (px >= 1840 && py >= 555) {
        landing = { x: px, y: 560, name: 'DASAR TEBING', color: '#38bdf8', ok: true };
        break;
      }
      // Jatuh ke jurang maut (x < 1840, y >= 560)
      if (py >= 565) {
        landing = { x: px, y: 565, name: 'JURANG (GAGAL)', color: '#ef4444', ok: false };
        break;
      }
    }

    const trajectoryColor = landing ? landing.color : '#f97316';

    // Gambar garis lengkung parabola bertitik-titik
    ctx.lineWidth = 2.8;
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = trajectoryColor;
    ctx.shadowColor = trajectoryColor;
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.moveTo(pouchCurX, pouchCurY);
    for (const pt of points) {
      ctx.lineTo(pt.x, pt.y);
    }
    ctx.stroke();

    // Gambar Target Landing Reticle di titik benturan
    if (landing) {
      const pulse = Math.sin(Date.now() / 150) * 4;
      const zoomBoost = renderCamZoom < 0.7 ? 1.7 : 1.0;
      ctx.setLineDash([]);
      ctx.fillStyle = landing.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * zoomBoost;

      // Lingkaran luar target
      ctx.beginPath();
      ctx.arc(landing.x, landing.y, (14 + pulse) * zoomBoost, 0, Math.PI * 2);
      ctx.stroke();

      // Titik pusat target
      ctx.beginPath();
      ctx.arc(landing.x, landing.y, 4 * zoomBoost, 0, Math.PI * 2);
      ctx.fill();

      // Label pendaratan interaktif
      const fontSize = Math.round(10 * zoomBoost);
      ctx.font = `bold ${fontSize}px Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      const labelText = landing.ok ? `[✓ PAS DI ${landing.name}]` : `[⚠ ${landing.name}!]`;
      const txtW = ctx.measureText(labelText).width + 12 * zoomBoost;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      roundRect(ctx, landing.x - txtW / 2, landing.y - 30 * zoomBoost, txtW, 17 * zoomBoost, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = landing.color;
      ctx.fillText(labelText, landing.x, landing.y - 18 * zoomBoost);
    }

    ctx.restore();
  }

  // 2. Karet Ketapel Belakang (Rubber Band)
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = tensionRatio > 0.7 ? '#ef4444' : '#f97316';
  ctx.shadowColor = tensionRatio > 0.7 ? '#ef4444' : '#f97316';
  ctx.shadowBlur  = tensionRatio > 0 ? 8 : 0;
  ctx.beginPath();
  ctx.moveTo(forkLeftX, forkTopY);
  ctx.lineTo(pouchCurX, pouchCurY);
  ctx.stroke();
  ctx.restore();

  // 3. Tiang Garpu Kayu Y-Post Ketapel
  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(x + w / 2, y + h + 2, 24, 7, 0, 0, Math.PI * 2);
  ctx.fill();

  const woodGrad = ctx.createLinearGradient(x, y, x + w, y);
  woodGrad.addColorStop(0, '#854d0e');
  woodGrad.addColorStop(0.5, '#a16207');
  woodGrad.addColorStop(1, '#713f12');

  ctx.fillStyle = woodGrad;
  ctx.strokeStyle = '#451a03';
  ctx.lineWidth = 2.5;

  roundRect(ctx, x + w / 2 - 8, y + 28, 16, h - 28, 4);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w / 2 - 6, y + 34);
  ctx.lineTo(forkLeftX, forkTopY);
  ctx.lineTo(forkLeftX - 6, forkTopY);
  ctx.lineTo(x + w / 2 - 12, y + 36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x + w / 2 + 6, y + 34);
  ctx.lineTo(forkRightX, forkTopY);
  ctx.lineTo(forkRightX + 6, forkTopY);
  ctx.lineTo(x + w / 2 + 12, y + 36);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#b45309';
  ctx.beginPath();
  ctx.arc(forkLeftX, forkTopY, 5, 0, Math.PI * 2);
  ctx.arc(forkRightX, forkTopY, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 4. Karet Ketapel Depan & Kantong Kulit (Pouch)
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = tensionRatio > 0.7 ? '#ef4444' : '#f97316';
  ctx.shadowColor = tensionRatio > 0.7 ? '#ef4444' : '#f97316';
  ctx.shadowBlur  = tensionRatio > 0 ? 8 : 0;
  ctx.beginPath();
  ctx.moveTo(forkRightX, forkTopY);
  ctx.lineTo(pouchCurX, pouchCurY);
  ctx.stroke();

  ctx.fillStyle = '#451a03';
  ctx.strokeStyle = '#78350f';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(pouchCurX, pouchCurY, 8, 14, -angle * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  // 5. Visual Hints, Aim Angle Compass, & Segmented Tension Gauge UI
  if (!ammoId) {
    const bob = Math.sin(Date.now() / 250) * 4;
    ctx.save();
    ctx.fillStyle = isDark ? '#38bdf8' : '#0284c7';
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.fillText('🏹 KANTONG KETAPEL', pouchX, y - 16 + bob);
    ctx.fillText('▼ MASUK SINI ▼', pouchX, y - 4 + bob);
    ctx.restore();
  } else if (tensionRatio <= 0.02) {
    const bob = Math.sin(Date.now() / 200) * 3;
    ctx.save();
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText('⚡ PELURU SIAP!', pouchCurX, y - 36 + bob);
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.fillText('🎯 KLIK & TARIK KETAPEL (GAYA ANGRY BIRDS)', pouchCurX, y - 20 + bob);
    ctx.fillStyle = '#cbd5e1';
    ctx.font = 'bold 9px Segoe UI, sans-serif';
    ctx.fillText('Tarik mouse ke kiri/bawah, lalu lepas untuk tembak!', pouchCurX, y - 7 + bob);
    ctx.restore();
  } else {
    // TENSION GAUGE BAR DENGAN NOTCH MARKER & INDIKATOR SUDUT
    const zoomBoost = renderCamZoom < 0.7 ? 1.6 : 1.0;
    const barW = 150 * zoomBoost;
    const barH = 14 * zoomBoost;
    const barX = pouchCurX - barW / 2;
    const barY = y - 52 * zoomBoost;
    const pct  = Math.round(tensionRatio * 100);

    ctx.save();

    // 1. Indikator Sudut Lontar di atas gauge
    ctx.fillStyle = '#38bdf8';
    const topFontSize = Math.round(10 * zoomBoost);
    ctx.font = `bold ${topFontSize}px Segoe UI, sans-serif`;
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(`🏹 SUDUT: ${angleDeg}° | DAYA: ${pct}%`, pouchCurX, barY - 6 * zoomBoost);

    // 2. Background bar
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5 * zoomBoost;
    roundRect(ctx, barX, barY, barW, barH, 4 * zoomBoost);
    ctx.fill();
    ctx.stroke();

    // 3. Notch Markers (Ledge 1: 65%, Ledge 2: 76%, Ledge 3: 86%, Peak: 95%)
    const notches = [
      { pct: 0.65, label: 'L1' },
      { pct: 0.76, label: 'L2' },
      { pct: 0.86, label: 'L3' },
      { pct: 0.95, label: 'PEAK' },
    ];
    notches.forEach(n => {
      const nx = barX + (barW - 4 * zoomBoost) * n.pct;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      ctx.lineWidth = 1 * zoomBoost;
      ctx.beginPath();
      ctx.moveTo(nx, barY + 2 * zoomBoost);
      ctx.lineTo(nx, barY + barH - 2 * zoomBoost);
      ctx.stroke();
    });

    // 4. Isi Pengisian Bar
    const fillW = Math.max(0, (barW - 4 * zoomBoost) * tensionRatio);
    const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    barGrad.addColorStop(0, '#10b981');
    barGrad.addColorStop(0.5, '#facc15');
    barGrad.addColorStop(0.8, '#f97316');
    barGrad.addColorStop(1, '#ef4444');

    ctx.fillStyle = barGrad;
    roundRect(ctx, barX + 2 * zoomBoost, barY + 2 * zoomBoost, fillW, barH - 4 * zoomBoost, 2 * zoomBoost);
    ctx.fill();

    // 5. Label Persen & Status
    ctx.fillStyle = '#ffffff';
    const subFontSize = Math.round(9 * zoomBoost);
    ctx.font = `bold ${subFontSize}px Segoe UI, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(`LEPAS MOUSE UNTUK TEMBAK! 🚀`, pouchCurX, barY + 10 * zoomBoost);

    ctx.restore();
  }

  ctx.restore();
}

// ── Dynamic Heavy Boxes (DDS) ────────────────────────────────────────────────
function drawBoxes() {
  currentBoxes.forEach(box => {
    const { x, y, w, h, minPushers, currentPushers } = box;
    const isMoving = currentPushers >= minPushers;

    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 3, w / 2.2, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    const bg = ctx.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, isMoving ? '#10b981' : '#d97706');
    bg.addColorStop(1, isMoving ? '#047857' : '#92400e');
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();

    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + w - 3, y + h - 3);
    ctx.moveTo(x + w - 3, y + 3);
    ctx.lineTo(x + 3, y + h - 3);
    ctx.stroke();

    ctx.fillStyle = '#fff';
    [[x + 7, y + 7], [x + w - 7, y + 7], [x + 7, y + h - 7], [x + w - 7, y + h - 7]].forEach(([bx, by]) => {
      ctx.beginPath();
      ctx.arc(bx, by, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    const badgeW = 100;
    const badgeH = 20;
    const badgeX = x + w / 2 - badgeW / 2;
    const badgeY = y - 26;

    ctx.save();
    ctx.fillStyle = isMoving ? 'rgba(16, 185, 129, 0.95)' : 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = isMoving ? '#10b981' : '#f59e0b';
    ctx.lineWidth = 1.5;
    roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font      = 'bold 10px Segoe UI';
    ctx.textAlign = 'center';
    const text = isMoving
      ? `BERGERAK! (${currentPushers}/${minPushers})`
      : `🏋️ DORONG: ${currentPushers}/${minPushers}`;
    ctx.fillText(text, x + w / 2, badgeY + 14);
    ctx.restore();
  });
}

// ── Key ──────────────────────────────────────────────────────────────────────
function drawKey() {
  if (keyCollected) return;
  const kPos = currentLevel.key;
  keyAnim += 0.04;
  const kx = kPos.x;
  const ky = kPos.y + Math.sin(keyAnim) * 5;

  ctx.save();
  ctx.shadowColor = '#f59e0b';
  ctx.shadowBlur  = 24;
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.arc(kx + 10, ky + 10, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
  ctx.fill();
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(kx + 15, ky + 7, 14, 6);
  ctx.fillRect(kx + 24, ky + 13, 4, 5);
  ctx.fillRect(kx + 19, ky + 13, 4, 4);
  ctx.restore();

  ctx.fillStyle   = '#d97706';
  ctx.font        = 'bold 11px Segoe UI';
  ctx.textAlign   = 'center';
  ctx.fillText('KUNCI', kx + 12, ky - 6);
}

// ── Door ─────────────────────────────────────────────────────────────────────
function drawDoor() {
  const { door, doorW: dw, doorH: dh } = currentLevel;
  const dx = door.x, dy = door.y;
  const isOpen = keyCollected;

  ctx.fillStyle = isOpen ? '#059669' : '#64748b';
  ctx.beginPath();
  roundRect(ctx, dx - 5, dy - 5, dw + 10, dh + 5, 7);
  ctx.fill();

  if (isOpen) {
    ctx.save();
    ctx.shadowColor = '#10b981';
    ctx.shadowBlur  = 35;
    const dg = ctx.createLinearGradient(dx, dy, dx, dy + dh);
    dg.addColorStop(0, '#34d399');
    dg.addColorStop(1, '#059669');
    ctx.fillStyle = dg;
    ctx.beginPath();
    roundRect(ctx, dx, dy, dw, dh, 5);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font      = 'bold 22px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('▶', dx + dw / 2, dy + dh / 2 + 8);
  } else {
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    roundRect(ctx, dx, dy, dw, dh, 5);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.font      = 'bold 20px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('🔒', dx + dw / 2, dy + dh / 2 + 8);
  }

  ctx.fillStyle = isOpen ? '#10b981' : '#64748b';
  ctx.font      = 'bold 11px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText('KELUAR', dx + dw / 2, dy - 10);
}

// ── Players ──────────────────────────────────────────────────────────────────
function drawPlayers() {
  if (!lastSnapshot) return;
  lastSnapshot.forEach(p => drawPlayer(p));
}

function drawPlayer(p) {
  let { x, y, color, name, facing, hasKey, atDoor } = p;
  const W = 36, H = 36;

  // Jika pemain sedang menjadi peluru di kantong ketapel dan ditarik mouse
  if (currentSlingshot && currentSlingshot.ammoId === p.id && isDraggingSlingshot) {
    const stretchDist = dragTensionRatio * 52;
    const stretchX = Math.cos(dragAimAngle) * stretchDist;
    const stretchY = Math.sin(dragAimAngle) * (stretchDist * 0.6);
    x = currentSlingshot.pouchX - stretchX - W / 2;
    y = currentSlingshot.pouchY - 14 + stretchY - H / 2;
  }

  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + W / 2, y + H + 3, W / 2.3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur  = 18;
  ctx.fillStyle   = color;
  ctx.beginPath();
  roundRect(ctx, x, y, W, H, 10);
  ctx.fill();
  ctx.restore();

  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  roundRect(ctx, x + 4, y + 3, W - 8, 10, 6);
  ctx.fill();

  const eyeY  = y + 13;
  const eyeLX = x + (facing === -1 ? 9  : 10);
  const eyeRX = x + (facing === -1 ? 20 : 21);
  ctx.fillStyle = '#0f172a';
  ctx.beginPath(); ctx.arc(eyeLX, eyeY, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(eyeRX, eyeY, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(eyeLX + 1, eyeY - 1.5, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(eyeRX + 1, eyeY - 1.5, 1.2, 0, Math.PI * 2); ctx.fill();

  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth   = 1.8;
  ctx.beginPath();
  ctx.arc(x + W / 2, y + 23, 7, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  if (hasKey) {
    ctx.font      = '14px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔑', x + W / 2, y - 4);
  }

  ctx.font = 'bold 10px Segoe UI';
  const nameW = ctx.measureText(name).width + 12;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.beginPath();
  roundRect(ctx, x + W / 2 - nameW / 2, y - 26, nameW, 17, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(name, x + W / 2, y - 13);

  if (atDoor) {
    ctx.fillStyle = '#10b981';
    ctx.font      = 'bold 11px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('✓ SIAP', x + W / 2, y - 32);
  }

  if (p.isAmmo) {
    ctx.save();
    ctx.fillStyle = '#f97316';
    ctx.font      = 'bold 9px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('🏹 PELURU', x + W / 2, y - (atDoor ? 42 : 32));
    ctx.restore();
  }

  // 🛡️ DUAL-SHIELD CO-OP RENDERING (Level 5)
  if (p.shieldType === 'top') {
    // Top Shield: Energy canopy hovering above head
    ctx.save();
    ctx.shadowColor = '#06b6d4';
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = 'rgba(6, 182, 212, 0.5)';
    roundRect(ctx, x - 10, y - 14, W + 20, 8, 4);
    ctx.fill();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#06b6d4';
    ctx.font      = 'bold 9px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('🛡️ TOP SHIELD', x + W / 2, y - 18);
    ctx.restore();
  } else if (p.shieldType === 'front') {
    // Front Shield: Tall energy barrier in front of body
    ctx.save();
    const face = facing || 1;
    const sX = (face === 1) ? x + W + 2 : x - 14;
    ctx.shadowColor = '#f59e0b';
    ctx.shadowBlur  = 18;
    ctx.fillStyle   = 'rgba(245, 158, 11, 0.5)';
    roundRect(ctx, sX, y - 6, 12, H + 12, 4);
    ctx.fill();

    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    ctx.fillStyle = '#f59e0b';
    ctx.font      = 'bold 9px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('🛡️ FRONT', sX + 6, y - 10);
    ctx.restore();
  }
}

// ── Door Progress Overlay ────────────────────────────────────────────────────
function drawDoorProgress() {
  if (!lastSnapshot || !keyCollected) return;
  const total  = lastSnapshot.length;
  const atDoor = lastSnapshot.filter(p => p.atDoor).length;
  if (atDoor === 0) return;
  const { door, doorW: dw } = currentLevel;
  ctx.fillStyle = atDoor === total ? '#10b981' : '#f59e0b';
  ctx.font      = 'bold 12px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText(`${atDoor}/${total}`, door.x + dw / 2, door.y - 24);
}

// ── Screen Constraints Indicator (Pico Park Shared Screen Boundary) ──────────
function drawScreenConstraintsIndicator() {
  if (!currentLevel || currentLevel.worldW <= VIEW_W) return;

  // Garis batas halus di tepi kiri & kanan layar agar pemain tahu batas layar
  ctx.save();
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.2)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1, 1, VIEW_W - 2, VIEW_H - 2);
  ctx.restore();
}

// ─── Utility: RoundRect Polyfill ─────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y,     x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x,     y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x,     y,     x + r, y);
  ctx.closePath();
}
