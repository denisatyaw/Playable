'use strict';

const express = require('express');
const http    = require('http');
const { Server } = require('socket.io');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, {
  cors: { origin: '*' },
  pingInterval: 2000,
  pingTimeout : 5000,
});

app.use(express.static(path.join(__dirname, 'public')));

// ─── Constants ──────────────────────────────────────────────────────────────
const MAX_PLAYERS   = 5;
const TICK_RATE     = 60;          // server physics ticks per second
const GRAVITY       = 1800;        // px / s²
const PLAYER_SPEED  = 220;         // px / s
const JUMP_VELOCITY = -600;        // px / s  (negative = upward)
const PLAYER_W      = 36;
const PLAYER_H      = 36;

const COLORS = ['#FF4D6D', '#4CC9F0', '#52B788', '#FFD60A', '#FF9FF3'];
const COLOR_NAMES = ['Red', 'Blue', 'Green', 'Yellow', 'Pink'];

// ─── Level Data ─────────────────────────────────────────────────────────────
// Each tile = 40×40 px.  W = world width, H = world height (px)
// Tile types: 0=empty, 1=solid ground

const LEVELS = [
  {
    id      : 1,
    name    : 'Level 1 – First Steps',
    worldW  : 1200,
    worldH  : 600,
    tileSize: 40,
    // 30 cols × 15 rows  (1200 × 600 px)
    // Desain: semua section bisa dilewati tanpa butuh tumpuk pemain.
    // Kunci di tengah-atas, Pintu EXIT di kanan bawah.
    tiles: [
      '000000000000000000000000000000', // row 0
      '000000000000000000000000000000', // row 1
      '000000000000000000000000000000', // row 2
      '000000000000000000000000000000', // row 3
      '000111100000000000000001111000', // row 4  – platform kiri & kanan atas
      '000000000000000000000000000000', // row 5
      '000000000001111100000000000000', // row 6  – platform tengah (kunci ada di sini)
      '000000000000000000000000000000', // row 7
      '011110000000000000000000011110', // row 8  – platform kiri & kanan bawah
      '000000000000000000000000000000', // row 9
      '000000001111000000001111000000', // row 10 – stepping stones bawah
      '000000000000000000000000000000', // row 11
      '000000000000000000000000000000', // row 12
      '000000000000000000000000000000', // row 13
      '111111111111111111111111111111', // row 14 – lantai
    ],
    spawns: [
      { x:  52, y: 500 },
      { x:  96, y: 500 },
      { x: 140, y: 500 },
      { x: 184, y: 500 },
      { x: 228, y: 500 },
    ],
    key : { x: 556, y: 212 },  // di atas platform tengah row 6
    door: { x: 1108, y: 480 }, // kanan bawah dekat lantai
    doorW: 48,
    doorH: 72,
  },
];

// ─── Server State ────────────────────────────────────────────────────────────
let gameState = 'lobby';   // 'lobby' | 'playing' | 'win'
let currentLevelIdx = 0;

const players = {};   // socketId → player object
let   keyCollected = false;

function getLevel() { return LEVELS[currentLevelIdx]; }

function buildPlayerPhysics(spawnIdx) {
  const lvl  = getLevel();
  const spawn = lvl.spawns[spawnIdx] || { x: 60, y: 500 };
  return {
    x     : spawn.x,
    y     : spawn.y,
    vx    : 0,
    vy    : 0,
    onGround: false,
    w     : PLAYER_W,
    h     : PLAYER_H,
    keys  : { left: false, right: false, up: false },
  };
}

function createPlayer(socketId, name) {
  const colorIdx = getNextColorIndex();
  const spawnIdx = Object.keys(players).length;
  return {
    id      : socketId,
    name    : name || `Player ${spawnIdx + 1}`,
    colorIdx,
    color   : COLORS[colorIdx],
    colorName: COLOR_NAMES[colorIdx],
    isHost  : Object.keys(players).length === 0,
    atDoor  : false,
    hasKey  : false,
    ...buildPlayerPhysics(spawnIdx),
  };
}

function getNextColorIndex() {
  const usedColors = Object.values(players).map(p => p.colorIdx);
  for (let i = 0; i < COLORS.length; i++) {
    if (!usedColors.includes(i)) return i;
  }
  return 0;
}

// ─── Tilemap Collision Helpers ───────────────────────────────────────────────
function getTile(lvl, col, row) {
  if (row < 0 || row >= lvl.tiles.length) return 0;
  const rowStr = lvl.tiles[row];
  if (col < 0 || col >= rowStr.length) return 0;
  return parseInt(rowStr[col], 10);
}

function isSolid(lvl, col, row) {
  return getTile(lvl, col, row) === 1;
}

// AABB sweep – returns corrected position and velocities
function resolveAABBVsTiles(lvl, px, py, pvx, pvy, pw, ph, dt) {
  const ts = lvl.tileSize;
  let x  = px + pvx * dt;
  let y  = py + pvy * dt;
  let vx = pvx;
  let vy = pvy;
  let onGround = false;

  // Horizontal
  const colL = Math.floor(x          / ts);
  const colR = Math.floor((x + pw - 1) / ts);
  const rowT = Math.floor(py          / ts);
  const rowB = Math.floor((py + ph - 1) / ts);
  for (let r = rowT; r <= rowB; r++) {
    if (vx > 0 && isSolid(lvl, colR, r)) { x = colR * ts - pw; vx = 0; break; }
    if (vx < 0 && isSolid(lvl, colL, r)) { x = (colL + 1) * ts;    vx = 0; break; }
  }

  // Vertical
  const colL2 = Math.floor(x          / ts);
  const colR2 = Math.floor((x + pw - 1) / ts);
  const rowT2 = Math.floor(y          / ts);
  const rowB2 = Math.floor((y + ph - 1) / ts);
  for (let c = colL2; c <= colR2; c++) {
    if (vy > 0 && isSolid(lvl, c, rowB2)) { y = rowB2 * ts - ph; vy = 0; onGround = true; break; }
    if (vy < 0 && isSolid(lvl, c, rowT2)) { y = (rowT2 + 1) * ts; vy = 0; break; }
  }

  // World bounds
  if (x < 0)                    { x = 0;               vx = 0; }
  if (x + pw > lvl.worldW)      { x = lvl.worldW - pw; vx = 0; }
  if (y + ph > lvl.worldH)      { y = lvl.worldH - ph; vy = 0; onGround = true; }
  if (y < 0)                    { y = 0;               vy = 0; }

  return { x, y, vx, vy, onGround };
}

// Player–player push (simple AABB overlap separation)
function resolvePlayerCollisions() {
  const pArr = Object.values(players);
  for (let i = 0; i < pArr.length; i++) {
    for (let j = i + 1; j < pArr.length; j++) {
      const a = pArr[i];
      const b = pArr[j];
      const overlapX = (a.x + PLAYER_W) - b.x;
      const overlapY = (a.y + PLAYER_H) - b.y;
      if (overlapX > 0 && (b.x - a.x) < PLAYER_W &&
          overlapY > 0 && (b.y - a.y) < PLAYER_H) {
        // Determine min penetration axis
        const dxAB = (a.x + PLAYER_W / 2) - (b.x + PLAYER_W / 2);
        const dyAB = (a.y + PLAYER_H / 2) - (b.y + PLAYER_H / 2);
        const overlapXabs = PLAYER_W  - Math.abs(dxAB);
        const overlapYabs = PLAYER_H  - Math.abs(dyAB);
        if (overlapXabs < overlapYabs) {
          const push = overlapXabs / 2;
          a.x += dxAB > 0 ?  push : -push;
          b.x += dxAB > 0 ? -push :  push;
        } else {
          // vertical – standing on top
          if (dyAB < 0) {
            // a is above b
            a.y -= overlapYabs;
            a.onGround = true;
            a.vy = 0;
          } else {
            b.y -= overlapYabs;
            b.onGround = true;
            b.vy = 0;
          }
        }
      }
    }
  }
}

// ─── Physics Tick ────────────────────────────────────────────────────────────
let lastTick = Date.now();

function physicsTick() {
  if (gameState !== 'playing') return;
  const now = Date.now();
  const dt  = Math.min((now - lastTick) / 1000, 0.05); // cap at 50ms
  lastTick  = now;
  const lvl = getLevel();

  Object.values(players).forEach(p => {
    // Apply input
    if (p.keys.left)  p.vx = -PLAYER_SPEED;
    else if (p.keys.right) p.vx =  PLAYER_SPEED;
    else p.vx = 0;

    if (p.keys.up && p.onGround) {
      p.vy = JUMP_VELOCITY;
      p.onGround = false;
    }

    // Gravity
    p.vy += GRAVITY * dt;

    // Tile collision
    const res = resolveAABBVsTiles(lvl, p.x, p.y, p.vx, p.vy, p.w, p.h, dt);
    p.x = res.x; p.y = res.y; p.vx = res.vx; p.vy = res.vy; p.onGround = res.onGround;
  });

  // Player vs player
  resolvePlayerCollisions();

  // Key pickup
  if (!keyCollected) {
    const kx = lvl.key.x, ky = lvl.key.y;
    Object.values(players).forEach(p => {
      if (!keyCollected &&
          p.x < kx + 24 && p.x + p.w > kx &&
          p.y < ky + 24 && p.y + p.h > ky) {
        keyCollected = true;
        p.hasKey = true;
        io.emit('keyCollected', { by: p.id });
      }
    });
  }

  // Door check – all players must be at door
  if (keyCollected) {
    const door = lvl.door;
    const allIds = Object.keys(players);
    allIds.forEach(id => {
      const p = players[id];
      p.atDoor = p.x + p.w > door.x &&
                 p.x       < door.x + lvl.doorW &&
                 p.y + p.h > door.y &&
                 p.y       < door.y + lvl.doorH;
    });
    if (allIds.length > 0 && allIds.every(id => players[id].atDoor)) {
      gameState = 'win';
      io.emit('levelComplete', { level: lvl.id });
    }
  }

  // Broadcast snapshot
  const snapshot = Object.values(players).map(p => ({
    id      : p.id,
    name    : p.name,
    color   : p.color,
    colorName: p.colorName,
    x       : Math.round(p.x),
    y       : Math.round(p.y),
    onGround: p.onGround,
    hasKey  : p.hasKey,
    atDoor  : p.atDoor,
    facing  : p.vx < 0 ? -1 : 1,
  }));

  io.emit('gameState', {
    players      : snapshot,
    keyCollected,
    gameState,
    level        : lvl,
  });
}

// ─── Socket.io Events ────────────────────────────────────────────────────────
io.on('connection', socket => {
  console.log(`[+] Connected: ${socket.id}`);

  if (gameState !== 'lobby' || Object.keys(players).length >= MAX_PLAYERS) {
    socket.emit('rejected', { reason: 'Game in progress or full.' });
    socket.disconnect(true);
    return;
  }

  socket.on('joinLobby', ({ name }) => {
    if (players[socket.id]) return;
    const player = createPlayer(socket.id, name);
    players[socket.id] = player;
    console.log(`  > ${player.name} (${player.colorName}) joined. Host: ${player.isHost}`);

    socket.emit('joined', {
      id    : player.id,
      color : player.color,
      colorName: player.colorName,
      isHost: player.isHost,
    });

    broadcastLobby();
  });

  socket.on('startGame', () => {
    const p = players[socket.id];
    if (!p || !p.isHost || gameState !== 'lobby') return;
    // Minimal 2 pemain untuk mulai
    if (Object.keys(players).length < 2) return;

    gameState    = 'playing';
    keyCollected = false;
    lastTick     = Date.now();

    // Reset positions
    const lvl = getLevel();
    Object.values(players).forEach((pl, i) => {
      const sp = lvl.spawns[i] || { x: 60, y: 500 };
      pl.x  = sp.x; pl.y  = sp.y;
      pl.vx = 0;    pl.vy = 0;
      pl.onGround = false;
      pl.atDoor   = false;
      pl.hasKey   = false;
    });

    io.emit('gameStarted', { level: lvl });
    console.log('Game started!');
  });

  socket.on('input', ({ left, right, up }) => {
    const p = players[socket.id];
    if (!p) return;
    p.keys.left  = !!left;
    p.keys.right = !!right;
    p.keys.up    = !!up;
  });

  // ── Pemain minta keluar dari sesi game (kembali ke lobby sendiri) ──────────
  socket.on('leaveGame', () => {
    const p = players[socket.id];
    if (!p) return;
    console.log(`  > ${p.name} left the game.`);

    const wasHost = p.isHost;
    delete players[socket.id];

    // Pindah host ke pemain berikutnya
    if (wasHost) {
      const remaining = Object.values(players);
      if (remaining.length > 0) {
        remaining[0].isHost = true;
        console.log(`  > Host transferred to ${remaining[0].name}`);
      }
    }

    // Konfirmasi ke pemain yang keluar
    socket.emit('leftGame');

    // Kasih tahu pemain lain
    io.emit('playerLeft', { id: socket.id, name: p.name });

    // Jika game sedang main dan tersisa < 1 pemain, kembali ke lobby semua
    if (gameState === 'playing') {
      const remaining = Object.values(players);
      if (remaining.length < 1) {
        gameState    = 'lobby';
        keyCollected = false;
        io.emit('backToLobby');
      } else {
        // Update host badge untuk pemain yang tersisa
        broadcastPlayerLeftInGame();
      }
    } else if (gameState === 'lobby') {
      broadcastLobby();
    }
  });

  // ── Host mengakhiri game untuk semua ────────────────────────────────────────
  socket.on('endGame', () => {
    const p = players[socket.id];
    if (!p || !p.isHost) return;
    gameState    = 'lobby';
    keyCollected = false;
    Object.values(players).forEach(pl => {
      pl.atDoor = false;
      pl.hasKey = false;
    });
    io.emit('backToLobby');
    broadcastLobby();
    console.log('  > Host ended the game. Back to lobby.');
  });

  socket.on('restartGame', () => {
    const p = players[socket.id];
    if (!p || !p.isHost) return;
    gameState    = 'lobby';
    keyCollected = false;
    Object.values(players).forEach(pl => {
      pl.atDoor = false;
      pl.hasKey = false;
    });
    io.emit('backToLobby');
    broadcastLobby();
  });

  socket.on('disconnect', () => {
    console.log(`[-] Disconnected: ${socket.id}`);
    const wasHost = players[socket.id]?.isHost;
    delete players[socket.id];

    // Reassign host if needed
    if (wasHost) {
      const remaining = Object.values(players);
      if (remaining.length > 0) remaining[0].isHost = true;
    }

    if (gameState === 'lobby') broadcastLobby();
    else io.emit('playerLeft', { id: socket.id });
  });
});

function broadcastLobby() {
  const list = Object.values(players).map(p => ({
    id      : p.id,
    name    : p.name,
    color   : p.color,
    colorName: p.colorName,
    isHost  : p.isHost,
  }));
  io.emit('lobbyUpdate', { players: list, maxPlayers: MAX_PLAYERS });
}

// Kirim info pemain yang masih ada (saat di tengah game, ada yang keluar)
function broadcastPlayerLeftInGame() {
  const snapshot = Object.values(players).map(p => ({
    id      : p.id,
    name    : p.name,
    color   : p.color,
    colorName: p.colorName,
    isHost  : p.isHost,
  }));
  io.emit('playerRoster', { players: snapshot });
}

// ─── Start ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎮 BoxBuds Co-op – Server running`);
  console.log(`   Local  : http://localhost:${PORT}`);
  console.log(`   Network: http://<YOUR_LOCAL_IP>:${PORT}`);
  console.log(`   Waiting for players...\n`);
});

setInterval(physicsTick, 1000 / TICK_RATE);
