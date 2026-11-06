'use strict';

// ─── Socket ──────────────────────────────────────────────────────────────────
const socket = io();

// ─── Metadata 10 Level Permainan ─────────────────────────────────────────────
const ALL_LEVELS = [
  { id: 1, idx: 0, name: 'First Steps',       icon: '🔑', tag: 'Tutorial Co-op',    desc: 'Lompat bersama & raih kunci pertama.',          unlocked: true },
  { id: 2, idx: 1, name: 'The Step',          icon: '📦', tag: 'Heavy Box DDS',     desc: 'Dorong peti berat bersama untuk lewati tembok.', unlocked: true },
  { id: 3, idx: 2, name: 'Hold the Door',     icon: '⚡', tag: 'Multi-Buttons DDS', desc: 'Injak tombol jurang untuk nyalakan jembatan.',  unlocked: true },
  { id: 4, idx: 3, name: 'Bouncer',           icon: '🦘', tag: 'Springboard Co-op', desc: 'Tumpuk badan di udara setelah terpental.',      unlocked: false },
  { id: 5, idx: 4, name: 'Sacrifice & Trust', icon: '🚨', tag: 'Laser Corridor',    desc: 'Tahan tombol laser agar kawan bisa lewat.',     unlocked: false },
  { id: 6, idx: 5, name: 'The Tower',         icon: '🗼', tag: 'Tower Stacking',    desc: 'Tumpuk seluruh badan setinggi menara.',         unlocked: false },
  { id: 7, idx: 6, name: 'Team Push',         icon: '🪨', tag: 'All Players Push',  desc: 'Dorong batu raksasa bersama seluruh tim.',      unlocked: false },
  { id: 8, idx: 7, name: 'Moving Ferry',      icon: '🚢', tag: 'Electric Ferry',    desc: 'Menyeberang di atas platform gerak sempit.',    unlocked: false },
  { id: 9, idx: 8, name: 'Trap Switch',       icon: '🔀', tag: 'Dual Paths',        desc: 'Koordinasi jalur atas & tombol bawah.',         unlocked: false },
  { id: 10, idx: 9, name: 'Final Exam',       icon: '🏆', tag: 'The Grand Finale',  desc: 'Ujian puncak seluruh puzzle kerja sama.',       unlocked: false },
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
let currentBoxes   = [];
let currentButtons = [];
let currentBridges = [];

// Input tracking
const keys     = { left: false, right: false, up: false };
let   lastSent = { left: false, right: false, up: false };

// Animation
let keyAnim    = 0;
let energyAnim = 0;
let cloudOffset = 0;

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
  currentLevel   = null;
  lastSnapshot   = null;
  keyCollected   = false;
  animRunning    = false;
  currentBoxes   = [];
  currentButtons = [];
  currentBridges = [];

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
      socket.emit('selectLevel', { levelIdx: lvl.idx });
    });

    levelGrid.appendChild(card);
  });
}

// ─── Canvas Sizing ───────────────────────────────────────────────────────────
function resizeCanvas() {
  if (!currentLevel) return;
  const maxW   = Math.min(window.innerWidth  - 32, 1200);
  const maxH   = Math.min(window.innerHeight - 130, 600);
  const scaleX = maxW / currentLevel.worldW;
  const scaleY = maxH / currentLevel.worldH;
  const scale  = Math.min(scaleX, scaleY, 1);
  canvas.width  = Math.floor(currentLevel.worldW * scale);
  canvas.height = Math.floor(currentLevel.worldH * scale);
  canvas.dataset.scale = scale;
}

window.addEventListener('resize', resizeCanvas);

// ─── Input Handling ──────────────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (['ArrowLeft',  'a', 'A'].includes(e.key))                      keys.left  = true;
  if (['ArrowRight', 'd', 'D'].includes(e.key))                      keys.right = true;
  if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) { e.preventDefault(); keys.up = true; }

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
});

// Kirim input pada 60 FPS saat terjadi perubahan
setInterval(() => {
  if (!myId) return;
  if (keys.left !== lastSent.left || keys.right !== lastSent.right || keys.up !== lastSent.up) {
    socket.emit('input', { left: keys.left, right: keys.right, up: keys.up });
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

socket.on('levelSelected', ({ levelIdx, levelName }) => {
  selectedLevelIdx = levelIdx;
  renderLevelGrid();
  showGameNotif(`Host memilih: ${levelName}`);
});

socket.on('gameStarted', ({ level, playerCount: pCount }) => {
  currentLevel = level;
  keyCollected = false;
  resizeCanvas();

  hudLevel.textContent     = level.name;
  hudKeyStatus.textContent = '🔑 Kunci: Belum Diambil';
  hudKeyStatus.classList.remove('collected');

  if (hudDDS) {
    hudDDS.textContent = `⚙ DDS: ${pCount} Pemain (Skala ${pCount - 1}x)`;
  }

  btnLeave.classList.remove('hidden');
  if (isHost) btnEndGame.classList.remove('hidden');

  showScreen('game');
  if (!animRunning) {
    animRunning = true;
    requestAnimationFrame(renderLoop);
  }
});

socket.on('gameState', ({ players, keyCollected: kc, boxes, buttons, bridges }) => {
  lastSnapshot   = players;
  keyCollected   = kc;
  currentBoxes   = boxes || [];
  currentButtons = buttons || [];
  currentBridges = bridges || [];

  hudPlayers.textContent = `👥 ${players.length} Pemain`;
  if (kc && !hudKeyStatus.classList.contains('collected')) {
    hudKeyStatus.textContent = '🔑 Kunci: Berhasil Diambil!';
    hudKeyStatus.classList.add('collected');
  }
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
  // Flash halus canvas
  canvas.style.outline = '3px solid #f59e0b';
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

// ─── Rendering Loop ──────────────────────────────────────────────────────────
function renderLoop() {
  if (!animRunning) return;
  requestAnimationFrame(renderLoop);
  if (!currentLevel || !lastSnapshot) return;

  const scale = parseFloat(canvas.dataset.scale) || 1;
  ctx.save();
  ctx.scale(scale, scale);

  drawBackground();
  drawTiles();
  drawBridges();
  drawButtons();
  drawBoxes();
  drawKey();
  drawDoor();
  drawPlayers();
  drawDoorProgress();

  ctx.restore();
}

// ── Background (Terang / Gelap Adaptif) ───────────────────────────────────────
function drawBackground() {
  const { worldW, worldH } = currentLevel;
  const isDark = document.body.classList.contains('dark-theme');

  if (isDark) {
    // Mode Gelap: Ruang Angkasa dengan Bintang
    const grad = ctx.createLinearGradient(0, 0, 0, worldH);
    grad.addColorStop(0, '#0a0d17');
    grad.addColorStop(1, '#131b2e');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, worldW, worldH);

    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    [[80,40],[200,25],[350,60],[500,20],[700,45],[900,30],[1100,55],
     [150,80],[600,70],[1000,90],[430,110],[760,15],[50,120]].forEach(([sx, sy]) => {
      ctx.beginPath();
      ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
      ctx.fill();
    });
  } else {
    // Mode Terang: Langit Biru Cerah Segar dengan Awan Mengapung
    const grad = ctx.createLinearGradient(0, 0, 0, worldH);
    grad.addColorStop(0, '#bae6fd');
    grad.addColorStop(0.7, '#e0f2fe');
    grad.addColorStop(1, '#f0f9ff');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, worldW, worldH);

    // Animasi Awan Kartun
    cloudOffset += 0.2;
    drawCuteClouds(worldW, cloudOffset);
  }
}

function drawCuteClouds(worldW, offset) {
  ctx.save();
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';

  const clouds = [
    { x: 120, y: 70, s: 40 },
    { x: 440, y: 50, s: 50 },
    { x: 780, y: 90, s: 45 },
    { x: 1050, y: 60, s: 55 }
  ];

  clouds.forEach(c => {
    const cx = (c.x + offset) % (worldW + 200) - 100;
    ctx.beginPath();
    ctx.arc(cx, c.y, c.s * 0.45, 0, Math.PI * 2);
    ctx.arc(cx + c.s * 0.35, c.y - c.s * 0.15, c.s * 0.4, 0, Math.PI * 2);
    ctx.arc(cx + c.s * 0.7, c.y, c.s * 0.35, 0, Math.PI * 2);
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
        // Style Mode Gelap
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
        // Style Mode Terang: Balok Slate Modern dengan Lis Aksen Biru Cerah
        const tg = ctx.createLinearGradient(tx, ty, tx, ty + ts);
        tg.addColorStop(0, '#475569');
        tg.addColorStop(1, '#334155');
        ctx.fillStyle = tg;
        ctx.fillRect(tx, ty, ts, ts);

        // Lis Aksen Cerah di bagian atas platform
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

      // Pola aliran listrik
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

// ── Dynamic Buttons (DDS) ────────────────────────────────────────────────────
function drawButtons() {
  currentButtons.forEach(btn => {
    if (!btn.active) return;

    const isPressed = btn.pressed;
    const pressOffset = isPressed ? 4 : 0;
    const h = btn.h - pressOffset;
    const y = btn.y + pressOffset;

    // Base alas tombol
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, btn.x - 2, btn.y + 6, btn.w + 4, btn.h, 3);
    ctx.fill();

    // Plate tombol
    ctx.save();
    if (isPressed) {
      ctx.shadowColor = '#10b981';
      ctx.shadowBlur  = 16;
      ctx.fillStyle   = '#10b981';
    } else {
      ctx.shadowColor = '#f59e0b';
      ctx.shadowBlur  = 12;
      ctx.fillStyle   = '#f59e0b';
    }
    roundRect(ctx, btn.x, y, btn.w, h, 3);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = isPressed ? '#10b981' : '#f59e0b';
    ctx.font      = 'bold 10px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText(`BTN #${btn.index + 1}`, btn.x + btn.w / 2, btn.y - 8);
  });
}

// ── Dynamic Heavy Boxes (DDS) ────────────────────────────────────────────────
function drawBoxes() {
  currentBoxes.forEach(box => {
    const { x, y, w, h, minPushers, currentPushers } = box;
    const isMoving = currentPushers >= minPushers;

    // Drop shadow
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h + 3, w / 2.2, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Box body
    ctx.save();
    const bg = ctx.createLinearGradient(x, y, x, y + h);
    bg.addColorStop(0, isMoving ? '#10b981' : '#d97706');
    bg.addColorStop(1, isMoving ? '#047857' : '#92400e');
    ctx.fillStyle = bg;
    roundRect(ctx, x, y, w, h, 6);
    ctx.fill();

    // Cross braces
    ctx.strokeStyle = '#fff';
    ctx.lineWidth   = 2;
    ctx.strokeRect(x + 3, y + 3, w - 6, h - 6);
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + w - 3, y + h - 3);
    ctx.moveTo(x + w - 3, y + 3);
    ctx.lineTo(x + 3, y + h - 3);
    ctx.stroke();

    // Bolts
    ctx.fillStyle = '#fff';
    [[x + 7, y + 7], [x + w - 7, y + 7], [x + 7, y + h - 7], [x + w - 7, y + h - 7]].forEach(([bx, by]) => {
      ctx.beginPath();
      ctx.arc(bx, by, 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();

    // DDS Status Badge
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

  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.ellipse(x + W / 2, y + H + 3, W / 2.3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Glow + body
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur  = 18;
  ctx.fillStyle   = color;
  ctx.beginPath();
  roundRect(ctx, x, y, W, H, 10);
  ctx.fill();
  ctx.restore();

  // Face shine
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  ctx.beginPath();
  roundRect(ctx, x + 4, y + 3, W - 8, 10, 6);
  ctx.fill();

  // Eyes
  const eyeY  = y + 13;
  const eyeLX = x + (facing === -1 ? 9  : 10);
  const eyeRX = x + (facing === -1 ? 20 : 21);
  ctx.fillStyle = '#0f172a';
  ctx.beginPath(); ctx.arc(eyeLX, eyeY, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(eyeRX, eyeY, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(eyeLX + 1, eyeY - 1.5, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(eyeRX + 1, eyeY - 1.5, 1.2, 0, Math.PI * 2); ctx.fill();

  // Smile
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth   = 1.8;
  ctx.beginPath();
  ctx.arc(x + W / 2, y + 23, 7, 0.1 * Math.PI, 0.9 * Math.PI);
  ctx.stroke();

  // Key badge
  if (hasKey) {
    ctx.font      = '14px serif';
    ctx.textAlign = 'center';
    ctx.fillText('🔑', x + W / 2, y - 4);
  }

  // Name tag
  ctx.font = 'bold 10px Segoe UI';
  const nameW = ctx.measureText(name).width + 12;
  ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
  ctx.beginPath();
  roundRect(ctx, x + W / 2 - nameW / 2, y - 26, nameW, 17, 4);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(name, x + W / 2, y - 13);

  // Door check indicator
  if (atDoor) {
    ctx.fillStyle = '#10b981';
    ctx.font      = 'bold 11px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('✓ SIAP', x + W / 2, y - 32);
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
