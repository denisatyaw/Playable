'use strict';

// ─── Socket ──────────────────────────────────────────────────────────────────
const socket = io();

// ─── DOM References ──────────────────────────────────────────────────────────
const screens = {
  lobby   : document.getElementById('screen-lobby'),
  game    : document.getElementById('screen-game'),
  win     : document.getElementById('screen-win'),
  rejected: document.getElementById('screen-rejected'),
};

const $ = id => document.getElementById(id);

const elName      = $('player-name');
const btnJoin     = $('btn-join');
const btnStart    = $('btn-start');
const btnRestart  = $('btn-restart');
const btnLeave    = $('btn-leave');
const btnEndGame  = $('btn-end-game');
const btnLobbyWin = $('btn-lobby-from-win');
const waitingArea = $('waiting-area');
const playerList  = $('player-list');
const playerCount = $('player-count');
const waitingMsg  = $('waiting-msg');
const startHint   = $('start-hint');
const hudLevel    = $('hud-level');
const hudKeyStatus= $('hud-key-status');
const hudPlayers  = $('hud-players');

const canvas = $('game-canvas');
const ctx    = canvas.getContext('2d');

// ─── State ───────────────────────────────────────────────────────────────────
let myId         = null;
let isHost       = false;
let myColor      = '#fff';
let currentLevel = null;
let lastSnapshot = null;
let keyCollected = false;
let animRunning  = false;

// Input tracking
const keys     = { left: false, right: false, up: false };
let   lastSent = { left: false, right: false, up: false };

// Animation
let keyAnim = 0;

// ─── Screen Helper ───────────────────────────────────────────────────────────
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

// Reset semua state ke kondisi lobby awal
function resetToLobby() {
  currentLevel = null;
  lastSnapshot = null;
  keyCollected = false;
  animRunning  = false;
  btnJoin.disabled = false;
  elName.disabled  = false;
  elName.value     = '';
  playerList.innerHTML = '';
  waitingArea.classList.add('hidden');
  btnStart.classList.add('hidden');
  btnStart.disabled = true;
  btnStart.textContent = '▶ Start Game';
  if (startHint) startHint.classList.add('hidden');
  waitingMsg.classList.remove('hidden');
  btnLeave.classList.add('hidden');
  btnEndGame.classList.add('hidden');
  myId   = null;
  isHost = false;
}

// Tampilkan notifikasi ringan di game (overlay singkat)
let notifTimeout = null;
function showGameNotif(msg) {
  let el = document.getElementById('game-notif');
  if (!el) {
    el = document.createElement('div');
    el.id = 'game-notif';
    el.style.cssText = [
      'position:fixed', 'top:80px', 'left:50%', 'transform:translateX(-50%)',
      'background:rgba(0,0,0,0.75)', 'color:#fff', 'padding:8px 20px',
      'border-radius:20px', 'font:bold 13px Segoe UI', 'z-index:999',
      'pointer-events:none', 'transition:opacity .3s',
    ].join(';');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  clearTimeout(notifTimeout);
  notifTimeout = setTimeout(() => { el.style.opacity = '0'; }, 2500);
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
});
document.addEventListener('keyup', e => {
  if (['ArrowLeft',  'a', 'A'].includes(e.key))  keys.left  = false;
  if (['ArrowRight', 'd', 'D'].includes(e.key))  keys.right = false;
  if (['ArrowUp', 'w', 'W', ' '].includes(e.key)) keys.up   = false;
});

// Send input at ~60 fps, only when changed
setInterval(() => {
  if (!myId) return;
  if (keys.left !== lastSent.left || keys.right !== lastSent.right || keys.up !== lastSent.up) {
    socket.emit('input', { left: keys.left, right: keys.right, up: keys.up });
    lastSent = { ...keys };
  }
}, 1000 / 60);

// ─── Lobby UI ────────────────────────────────────────────────────────────────
btnJoin.addEventListener('click', () => {
  const name = elName.value.trim() || 'Player';
  socket.emit('joinLobby', { name });
  btnJoin.disabled = true;
  elName.disabled  = true;
});

btnStart.addEventListener('click', () => socket.emit('startGame'));
btnRestart.addEventListener('click', () => socket.emit('restartGame'));
elName.addEventListener('keydown', e => { if (e.key === 'Enter') btnJoin.click(); });

// ── Leave & End Game ─────────────────────────────────────────────────────────
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
  waitingArea.classList.remove('hidden');
  if (host) {
    // Host perlu 2 pemain, jadi tombol start muncul tapi disabled dulu
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
    dot.className  = 'player-dot';
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
    btnStart.classList.remove('hidden');
    waitingMsg.classList.add('hidden');

    // Aktifkan tombol start hanya jika ada >= 2 pemain
    if (players.length >= 2) {
      btnStart.disabled = false;
      btnStart.textContent = `▶ Start Game (${players.length} players)`;
      if (startHint) startHint.classList.add('hidden');
    } else {
      btnStart.disabled = true;
      btnStart.textContent = '▶ Start Game';
      if (startHint) startHint.classList.remove('hidden');
    }
  }
});

socket.on('gameStarted', ({ level }) => {
  currentLevel = level;
  keyCollected = false;
  resizeCanvas();
  hudLevel.textContent     = level.name;
  hudKeyStatus.textContent = '🔑 Key: Not Collected';
  hudKeyStatus.classList.remove('collected');
  // Tampilkan tombol Leave untuk semua; End Game hanya untuk host
  btnLeave.classList.remove('hidden');
  if (isHost) btnEndGame.classList.remove('hidden');
  showScreen('game');
  if (!animRunning) {
    animRunning = true;
    requestAnimationFrame(renderLoop);
  }
});

socket.on('gameState', ({ players, keyCollected: kc }) => {
  lastSnapshot = players;
  keyCollected = kc;
  hudPlayers.textContent = `👥 ${players.length} Player${players.length !== 1 ? 's' : ''}`;
  if (kc && !hudKeyStatus.classList.contains('collected')) {
    hudKeyStatus.textContent = '🔑 Key: Collected!';
    hudKeyStatus.classList.add('collected');
  }
});

socket.on('keyCollected', () => {
  keyCollected = true;
  hudKeyStatus.textContent = '🔑 Key: Collected!';
  hudKeyStatus.classList.add('collected');
  canvas.style.boxShadow = '0 0 50px #FFD60A';
  setTimeout(() => { canvas.style.boxShadow = ''; }, 700);
});

socket.on('levelComplete', () => showScreen('win'));

// Pemain ini sendiri yang keluar (konfirmasi dari server)
socket.on('leftGame', () => {
  resetToLobby();
  showScreen('lobby');
});

socket.on('backToLobby', () => {
  resetToLobby();
  showScreen('lobby');
});

// Info pemain lain yang keluar di tengah game
socket.on('playerLeft', ({ id, name }) => {
  if (lastSnapshot) lastSnapshot = lastSnapshot.filter(p => p.id !== id);
  // Tampilkan notif singkat
  showGameNotif(`${name || 'A player'} left the game`);
});

// Update roster (saat ada yang keluar mid-game, host bisa berubah)
socket.on('playerRoster', ({ players }) => {
  const me = players.find(p => p.id === myId);
  if (me?.isHost && !isHost) {
    isHost = true;
    btnEndGame.classList.remove('hidden');
    showGameNotif('You are now the Host!');
  }
});

// ─── Rendering ───────────────────────────────────────────────────────────────
function renderLoop() {
  if (!animRunning) return;
  requestAnimationFrame(renderLoop);
  if (!currentLevel || !lastSnapshot) return;

  const scale = parseFloat(canvas.dataset.scale) || 1;
  ctx.save();
  ctx.scale(scale, scale);
  drawBackground();
  drawTiles();
  drawKey();
  drawDoor();
  drawPlayers();
  drawDoorProgress();
  ctx.restore();
}

// ── Background ───────────────────────────────────────────────────────────────
function drawBackground() {
  const { worldW, worldH } = currentLevel;
  const grad = ctx.createLinearGradient(0, 0, 0, worldH);
  grad.addColorStop(0, '#0d0f1a');
  grad.addColorStop(1, '#1a1f35');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, worldW, worldH);

  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  [[80,40],[200,25],[350,60],[500,20],[700,45],[900,30],[1100,55],
   [150,80],[600,70],[1000,90],[430,110],[760,15],[50,120]].forEach(([sx, sy]) => {
    ctx.beginPath();
    ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });
}

// ── Tilemap ──────────────────────────────────────────────────────────────────
function drawTiles() {
  const { tiles, tileSize: ts } = currentLevel;
  for (let r = 0; r < tiles.length; r++) {
    const row = tiles[r];
    for (let c = 0; c < row.length; c++) {
      if (row[c] !== '1') continue;
      const tx = c * ts, ty = r * ts;
      const tg = ctx.createLinearGradient(tx, ty, tx, ty + ts);
      tg.addColorStop(0, '#3a4068');
      tg.addColorStop(1, '#252840');
      ctx.fillStyle = tg;
      ctx.fillRect(tx, ty, ts, ts);
      ctx.fillStyle = 'rgba(255,255,255,0.13)';
      ctx.fillRect(tx, ty, ts, 4);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth   = 0.5;
      ctx.strokeRect(tx + 0.25, ty + 0.25, ts - 0.5, ts - 0.5);
    }
  }
}

// ── Key ──────────────────────────────────────────────────────────────────────
function drawKey() {
  if (keyCollected) return;
  const kPos = currentLevel.key;
  keyAnim += 0.04;
  const kx = kPos.x;
  const ky = kPos.y + Math.sin(keyAnim) * 5;

  ctx.save();
  ctx.shadowColor = '#FFD60A';
  ctx.shadowBlur  = 24;
  ctx.strokeStyle = '#FFD60A';
  ctx.lineWidth   = 3;
  ctx.beginPath();
  ctx.arc(kx + 10, ky + 10, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,214,10,0.3)';
  ctx.fill();
  ctx.fillStyle = '#FFD60A';
  ctx.fillRect(kx + 15, ky + 7, 14, 6);
  ctx.fillRect(kx + 24, ky + 13, 4, 5);
  ctx.fillRect(kx + 19, ky + 13, 4, 4);
  ctx.restore();

  ctx.fillStyle   = 'rgba(255,214,10,0.9)';
  ctx.font        = 'bold 11px Segoe UI';
  ctx.textAlign   = 'center';
  ctx.fillText('KEY', kx + 12, ky - 6);
}

// ── Door ─────────────────────────────────────────────────────────────────────
function drawDoor() {
  const { door, doorW: dw, doorH: dh } = currentLevel;
  const dx = door.x, dy = door.y;
  const isOpen = keyCollected;

  ctx.fillStyle = isOpen ? '#3d7a5e' : '#5a3f6e';
  ctx.beginPath();
  roundRect(ctx, dx - 5, dy - 5, dw + 10, dh + 5, 7);
  ctx.fill();

  if (isOpen) {
    ctx.save();
    ctx.shadowColor = '#52B788';
    ctx.shadowBlur  = 35;
    const dg = ctx.createLinearGradient(dx, dy, dx, dy + dh);
    dg.addColorStop(0, 'rgba(82,183,136,0.95)');
    dg.addColorStop(1, 'rgba(45,122,86,0.8)');
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
    ctx.fillStyle = '#3d2f4f';
    ctx.beginPath();
    roundRect(ctx, dx, dy, dw, dh, 5);
    ctx.fill();
    ctx.fillStyle = '#8060a0';
    ctx.font      = 'bold 20px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('🔒', dx + dw / 2, dy + dh / 2 + 8);
  }

  ctx.fillStyle = isOpen ? '#52B788' : '#9070b0';
  ctx.font      = 'bold 11px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', dx + dw / 2, dy - 10);
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
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(x + W / 2, y + H + 3, W / 2.3, 4, 0, 0, Math.PI * 2);
  ctx.fill();

  // Glow + body
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur  = 20;
  ctx.fillStyle   = color;
  ctx.beginPath();
  roundRect(ctx, x, y, W, H, 10);
  ctx.fill();
  ctx.restore();

  // Shine
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  roundRect(ctx, x + 4, y + 3, W - 8, 10, 6);
  ctx.fill();

  // Eyes
  const eyeY  = y + 13;
  const eyeLX = x + (facing === -1 ? 9  : 10);
  const eyeRX = x + (facing === -1 ? 20 : 21);
  ctx.fillStyle = 'rgba(0,0,0,0.78)';
  ctx.beginPath(); ctx.arc(eyeLX, eyeY, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(eyeRX, eyeY, 3.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath(); ctx.arc(eyeLX + 1, eyeY - 1.5, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(eyeRX + 1, eyeY - 1.5, 1.2, 0, Math.PI * 2); ctx.fill();

  // Smile
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
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
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath();
  roundRect(ctx, x + W / 2 - nameW / 2, y - 26, nameW, 17, 4);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText(name, x + W / 2, y - 13);

  // Door check indicator
  if (atDoor) {
    ctx.fillStyle = '#52B788';
    ctx.font      = 'bold 11px Segoe UI';
    ctx.textAlign = 'center';
    ctx.fillText('✓ IN', x + W / 2, y - 32);
  }
}

// ── Door progress overlay ─────────────────────────────────────────────────────
function drawDoorProgress() {
  if (!lastSnapshot || !keyCollected) return;
  const total  = lastSnapshot.length;
  const atDoor = lastSnapshot.filter(p => p.atDoor).length;
  if (atDoor === 0) return;
  const { door, doorW: dw } = currentLevel;
  ctx.fillStyle = atDoor === total ? '#52B788' : '#FFD60A';
  ctx.font      = 'bold 12px Segoe UI';
  ctx.textAlign = 'center';
  ctx.fillText(`${atDoor}/${total}`, door.x + dw / 2, door.y - 24);
}

// ─── Utility: RoundRect polyfill ─────────────────────────────────────────────
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
