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
  { id: 6, idx: 5, name: 'The Tower',         icon: '🗼', tag: 'Tower Stacking',    desc: 'Tumpuk seluruh badan setinggi menara.',            unlocked: false },
  { id: 7, idx: 6, name: 'Team Push',         icon: '🪨', tag: 'All Players Push',  desc: 'Dorong batu raksasa bersama seluruh tim.',         unlocked: false },
  { id: 8, idx: 7, name: 'Moving Ferry',      icon: '🚢', tag: 'Electric Ferry',    desc: 'Menyeberang di atas platform gerak sempit.',       unlocked: false },
  { id: 9, idx: 8, name: 'Trap Switch',       icon: '🔀', tag: 'Dual Paths',        desc: 'Koordinasi jalur atas & tombol bawah.',            unlocked: false },
  { id: 10, idx: 9, name: 'Final Exam',       icon: '🏆', tag: 'The Grand Finale',  desc: 'Ujian puncak seluruh puzzle kerja sama.',          unlocked: false },
  { id: 11, idx: 10, name: 'The Great Divide', icon: '🏹', tag: 'Human Slingshot',   desc: 'Lontarkan kawan melintasi jurang maut dengan ketapel manusia!', unlocked: true },
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
let currentBoxes        = [];
let currentButtons      = [];
let currentBridges      = [];
let currentGates        = [];
let currentLasers       = [];
let currentSpringboards = [];
let currentSlingshot    = null;

// Shared Viewport Camera (Pico Park scrolling)
const VIEW_W        = 1200;
const VIEW_H        = 600;
let currentCamX     = 0;
let renderCamX      = 0;

// Input tracking
const keys          = { left: false, right: false, up: false, down: false };
let   lastSent      = { left: false, right: false, up: false, down: false, aimAngle: 0.785 };
let   localAimAngle = 0.785; // Default 45 derajat (0.785 rad)

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
        <span class="level-num">LVL 0${lvl.id}</span>
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

// ─── Input Handling ──────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (['ArrowLeft',  'a', 'A'].includes(e.key))                      keys.left  = true;
  if (['ArrowRight', 'd', 'D'].includes(e.key))                      keys.right = true;
  if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) { e.preventDefault(); keys.up = true; }
  if (['ArrowDown', 's', 'S'].includes(e.key))    { e.preventDefault(); keys.down = true; }

  // Keyboard shortcut R untuk Retry
  if (['r', 'R'].includes(e.key) && screens.game.classList.contains('active')) {
    e.preventDefault();
    socket.emit('retryLevel');
  }
});

document.addEventListener('keyup', e => {
  if (['ArrowLeft',  'a', 'A'].includes(e.key))  keys.left  = false;
  if (['ArrowRight', 'd', 'D'].includes(e.key))  keys.right = false;
  if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) keys.up   = false;
  if (['ArrowDown', 's', 'S'].includes(e.key))    keys.down = false;
});

// Arahkan sudut ketapel (Aim Angle) via mouse
canvas.addEventListener('mousemove', e => {
  if (!currentSlingshot || currentSlingshot.launcherId !== myId) return;
  const rect = canvas.getBoundingClientRect();
  const scale = parseFloat(canvas.dataset.scale) || 1;
  const mouseX = (e.clientX - rect.left) / scale + renderCamX;
  const mouseY = (e.clientY - rect.top) / scale;

  const dx = mouseX - currentSlingshot.pouchX;
  const dy = currentSlingshot.pouchY - mouseY;
  if (dx > 20) {
    const rawAngle = Math.atan2(dy, dx);
    localAimAngle = Math.max(0.26, Math.min(1.31, rawAngle)); // clamp 15° s/d 75°
  }
});

// Kirim input pada 60 FPS saat terjadi perubahan
setInterval(() => {
  if (!myId) return;

  // Jika sedang menarik ketapel dan menekan W/S / Up/Down, sesuaikan sudut
  if (currentSlingshot && currentSlingshot.launcherId === myId && currentSlingshot.isPulling) {
    if (keys.up)   localAimAngle = Math.min(1.31, (localAimAngle || 0.785) + 0.025);
    if (keys.down) localAimAngle = Math.max(0.26, (localAimAngle || 0.785) - 0.025);
  }

  const angleDiff = Math.abs((localAimAngle || 0.785) - (lastSent.aimAngle || 0.785));
  if (keys.left !== lastSent.left || keys.right !== lastSent.right ||
      keys.up !== lastSent.up || keys.down !== lastSent.down || angleDiff > 0.03) {
    socket.emit('input', {
      left    : keys.left,
      right   : keys.right,
      up      : keys.up,
      down    : keys.down,
      aimAngle: localAimAngle,
    });
    lastSent = { ...keys, aimAngle: localAimAngle };
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
  currentGates        = level.activeGates || [];
  currentSlingshot    = slingshot || null;
  resizeCanvas();

  hudLevel.textContent     = level.name;
  hudKeyStatus.textContent = '🔑 Kunci: Belum Diambil';
  hudKeyStatus.classList.remove('collected');

  if (hudDDS) {
    if (level.id === 5) {
      hudDDS.textContent = '🛡️ Dual-Shield Co-op: P1 (Top Shield) & P2 (Front Shield)';
    } else if (level.id === 11) {
      hudDDS.textContent = `🏹 Ketapel Manusia: Jurang 1320px | Skala ${pCount - 1} Tombol Ledge`;
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

socket.on('gameState', ({ players, keyCollected: kc, boxes, buttons, bridges, gates, lasers, springboards, slingshot, camX }) => {
  lastSnapshot        = players;
  keyCollected        = kc;
  currentBoxes        = boxes || [];
  currentButtons      = buttons || [];
  currentBridges      = bridges || [];
  currentGates        = gates || [];
  currentLasers       = lasers || [];
  currentSpringboards = springboards || [];
  currentSlingshot    = slingshot || null;
  currentCamX         = camX || 0;

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

  // Smooth camera interpolation
  renderCamX += (currentCamX - renderCamX) * 0.2;

  const scale = parseFloat(canvas.dataset.scale) || 1;
  ctx.save();
  ctx.scale(scale, scale);

  // Background statis/parallax di layar
  drawBackground(renderCamX);

  // Geser koordinat dunia berdasarkan posisi kamera!
  ctx.save();
  ctx.translate(-renderCamX, 0);

  drawTiles();
  drawBridges();
  drawGates();
  drawButtons();
  drawSpringboards();
  drawLasers();
  drawSlingshot();
  drawBoxes();
  drawKey();
  drawDoor();
  drawPlayers();
  drawDoorProgress();

  ctx.restore();

  // Indikator tepi layar (Pico Park Screen Constraint)
  drawScreenConstraintsIndicator();

  ctx.restore();
}

// ── Background (Adaptif & Parallax Awan) ──────────────────────────────────────
function drawBackground(camX) {
  const isDark = document.body.classList.contains('dark-theme');

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
    } else {
      ctx.save();
      ctx.setLineDash([8, 6]);
      ctx.strokeStyle = 'rgba(2, 132, 199, 0.45)';
      ctx.lineWidth   = 2;
      ctx.strokeRect(brg.x, brg.y, brg.w, brg.h);

      ctx.fillStyle   = 'rgba(2, 132, 199, 0.75)';
      ctx.font        = 'bold 11px Segoe UI';
      ctx.textAlign   = 'center';
      ctx.fillText('⚡ INJAK SEMUA TOMBOL UNTUK NYALAKAN JEMBATAN ⚡', brg.x + brg.w / 2, brg.y + brg.h + 20);
      ctx.restore();
    }
  });
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
      ctx.shadowColor = '#ff0033';
      ctx.shadowBlur  = 20 + pulse;

      // Glow beam
      ctx.fillStyle = 'rgba(255, 0, 51, 0.75)';
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
        ctx.fillStyle = '#ff0033';
        ctx.font      = 'bold 9px Segoe UI';
        ctx.textAlign = 'center';
        const labelX = lx + laser.w / 2;
        const labelY = isHorizontal ? ly - 8 : ly - 14;
        ctx.fillText('⚡ LASER BAHAYA', labelX, labelY);
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

  const { x, y, w, h, pouchX, pouchY, maxTension, tension, ammoId, launcherId } = sling;
  const isDark = document.body.classList.contains('dark-theme');

  // Sudut aim aktif (gunakan localAimAngle jika pemain lokal adalah launcher)
  const angle = (launcherId === myId && typeof localAimAngle === 'number')
    ? localAimAngle
    : (sling.angle || 0.785);
  const angleDeg = Math.round(angle * 180 / Math.PI);

  const tensionRatio = Math.min(1, Math.max(0, (tension || 0) / (maxTension || 3.0)));
  const stretchDist = tensionRatio * 44;

  const stretchX = Math.cos(angle) * stretchDist;
  const stretchY = -Math.sin(angle) * (stretchDist * 0.5);

  const forkLeftX  = x + 10;
  const forkRightX = x + w - 10;
  const forkTopY   = y + 8;
  const pouchCurX  = pouchX - stretchX;
  const pouchCurY  = pouchY - 14 + stretchY;

  ctx.save();

  // 1. Dotted Parabolic Trajectory Preview & Landing Target Indicator
  if (tensionRatio > 0.05 || (launcherId === myId && ammoId)) {
    ctx.save();

    // Hitung kecepatan berdasarkan power
    const effTension = Math.max(0.12, tensionRatio);
    const speed = 950 + effTension * 1150;
    const previewVx = speed * Math.cos(angle);
    const previewVy = -speed * Math.sin(angle);
    const g = 1800;

    // Lacak lintasan parabola dan cari titik pendaratan (Landing Surface Collision)
    const points = [];
    let landing = null;

    for (let t = 0; t <= 1.8; t += 0.02) {
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
      // Lantai dasar tebing kanan (x >= 1840, y >= 550)
      if (px >= 1840 && py >= 555) {
        landing = { x: px, y: 560, name: 'DASAR KANAN', color: '#38bdf8', ok: true };
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
      ctx.setLineDash([]);
      ctx.fillStyle = landing.color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;

      // Lingkaran luar target
      ctx.beginPath();
      ctx.arc(landing.x, landing.y, 14 + pulse, 0, Math.PI * 2);
      ctx.stroke();

      // Titik pusat target
      ctx.beginPath();
      ctx.arc(landing.x, landing.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Label pendaratan interaktif
      ctx.font = 'bold 10px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      const labelText = landing.ok ? `[✓ PAS DI ${landing.name}]` : `[⚠ ${landing.name}!]`;
      const txtW = ctx.measureText(labelText).width + 12;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      roundRect(ctx, landing.x - txtW / 2, landing.y - 28, txtW, 16, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = landing.color;
      ctx.fillText(labelText, landing.x, landing.y - 16);
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
  } else if (!launcherId || tensionRatio === 0) {
    const bob = Math.sin(Date.now() / 200) * 3;
    ctx.save();
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 11px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 4;
    ctx.fillText('⚡ PELURU SIAP!', pouchCurX, y - 36 + bob);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 10px Segoe UI, sans-serif';
    ctx.fillText('Tahan [A / ←] Tarik Daya', pouchCurX, y - 22 + bob);
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`Atur Sudut (${angleDeg}°): Tekan [W / S] atau Geser Mouse`, pouchCurX, y - 9 + bob);
    ctx.restore();
  } else {
    // TENSION GAUGE BAR DENGAN NOTCH MARKER & INDIKATOR SUDUT
    const barW = 140;
    const barH = 14;
    const barX = pouchCurX - barW / 2;
    const barY = y - 48;
    const pct  = Math.round(tensionRatio * 100);

    ctx.save();

    // 1. Indikator Sudut Lontar di atas gauge
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 10px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(`🏹 SUDUT: ${angleDeg}° (W / S / Mouse untuk atur)`, pouchCurX, barY - 8);

    // 2. Background bar
    ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.fill();
    ctx.stroke();

    // 3. Notch Markers (Ledge 1: 50%, Ledge 2: 68%, Ledge 3: 82%, Peak: 95%)
    const notches = [
      { pct: 0.50, label: 'L1' },
      { pct: 0.68, label: 'L2' },
      { pct: 0.82, label: 'L3' },
      { pct: 0.95, label: 'PEAK' },
    ];
    notches.forEach(n => {
      const nx = barX + (barW - 4) * n.pct;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(nx, barY + 2);
      ctx.lineTo(nx, barY + barH - 2);
      ctx.stroke();
    });

    // 4. Isi Pengisian Bar
    const fillW = Math.max(0, (barW - 4) * tensionRatio);
    const barGrad = ctx.createLinearGradient(barX, barY, barX + barW, barY);
    barGrad.addColorStop(0, '#10b981');
    barGrad.addColorStop(0.5, '#facc15');
    barGrad.addColorStop(0.8, '#f97316');
    barGrad.addColorStop(1, '#ef4444');

    ctx.fillStyle = barGrad;
    roundRect(ctx, barX + 2, barY + 2, fillW, barH - 4, 2);
    ctx.fill();

    // 5. Label Persen & Status
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`DAYA ${pct}% (LEPAS [A] UNTUK TEMBAK!)`, pouchCurX, barY + 10);

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
  const { x, y, color, name, facing, hasKey, atDoor } = p;
  const W = 36, H = 36;

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
