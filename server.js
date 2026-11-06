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

// ─── Level Data ─────────────────────────────────────────────────────────────
// Each tile = 40×40 px. W = 1200 px, H = 600 px (30 cols × 15 rows)
// Tile types: 0 = air, 1 = solid ground

const LEVELS = [
  // ── LEVEL 1: First Steps (Warm-up & Platforming) ───────────────────────────
  {
    id      : 1,
    name    : 'Level 1 – First Steps',
    worldW  : 1200,
    worldH  : 600,
    tileSize: 40,
    tiles: [
      '000000000000000000000000000000', // row 0
      '000000000000000000000000000000', // row 1
      '000000000000000000000000000000', // row 2
      '000000000000000000000000000000', // row 3
      '000111100000000000000001111000', // row 4  – platform kiri & kanan atas
      '000000000000000000000000000000', // row 5
      '000000000001111100000000000000', // row 6  – platform tengah
      '000000000000000000000000000000', // row 7
      '011110000000000000000000011110', // row 8  – platform kiri & kanan bawah
      '000000000000000000000000000000', // row 9
      '000000001111000000001111000000', // row 10 – stepping stones bawah
      '000000000000000000000000000000', // row 11
      '000000000000000000000000000000', // row 12
      '000000000000000000000000000000', // row 13
      '111111111111111111111111111111', // row 14 – lantai solid
    ],
    spawns: [
      { x:  52, y: 500 },
      { x:  96, y: 500 },
      { x: 140, y: 500 },
      { x: 184, y: 500 },
      { x: 228, y: 500 },
    ],
    key : { x: 556, y: 212 },
    door: { x: 1108, y: 480 },
    doorW: 48,
    doorH: 72,
    boxes  : [],
    buttons: [],
    bridges: [],
  },

  // ── LEVEL 2: The Step (Dynamic Heavy Box DDS) ──────────────────────────────
  // Tembok tinggi 120px di tengah (kolom 16-17). Pemain hanya bisa loncat 100px.
  // Ada Dynamic Heavy Box (56x56) yang harus didorong bersama ke dinding.
  // minPushers adaptif: playerCount - 1 (main ber-2 butuh 1, ber-5 butuh 4).
  {
    id      : 2,
    name    : 'Level 2 – The Step',
    worldW  : 1200,
    worldH  : 600,
    tileSize: 40,
    tiles: [
      '000000000000000000000000000000', // row 0
      '000000000000000000000000000000', // row 1
      '000000000000000000000000000000', // row 2
      '000000000000000000000000000000', // row 3
      '000000000000000000000000000000', // row 4
      '000000000000000000000000000000', // row 5
      '000000000000000000000000000000', // row 6
      '000000000000000000000000000000', // row 7
      '000000000000000000001111000000', // row 8  – platform kunci di seberang dinding
      '000000000000000000000000000000', // row 9
      '000000000000000000000000000000', // row 10
      '000000000000000011000000000000', // row 11 – rintangan dinding (120px)
      '000000000000000011000000000000', // row 12
      '000000000000000011000000000000', // row 13
      '111111111111111111111111111111', // row 14 – lantai solid
    ],
    spawns: [
      { x:  52, y: 500 },
      { x:  96, y: 500 },
      { x: 140, y: 500 },
      { x: 184, y: 500 },
      { x: 228, y: 500 },
    ],
    key : { x: 860, y: 280 },  // Di atas platform seberang dinding
    door: { x: 1108, y: 480 },
    doorW: 48,
    doorH: 72,
    boxes: [
      {
        id: 'heavy_box_1',
        x: 340,
        y: 504,
        w: 56,
        h: 56,
        vx: 0,
        vy: 0,
        onGround: true,
        // Formula dinamis: butuh (playerCount - 1) orang mendorong bersamaan
        minPushersFormula: (pCount) => Math.max(1, pCount - 1),
      }
    ],
    buttons: [],
    bridges: [],
  },

  // ── LEVEL 3: Hold the Door (Dynamic Multi-Buttons & Bridge DDS) ────────────
  // Jurang maut di tengah (kolom 12-19). Di atasnya ada jembatan energi.
  // Jumlah tombol aktif = (playerCount - 1). Tombol harus diinjak bersamaan!
  // Setelah 1 pemain menyeberang dan mengambil kunci, jembatan terkunci ON permanen.
  {
    id      : 3,
    name    : 'Level 3 – Hold the Door',
    worldW  : 1200,
    worldH  : 600,
    tileSize: 40,
    tiles: [
      '000000000000000000000000000000', // row 0
      '000000000000000000000000000000', // row 1
      '000000000000000000000000000000', // row 2
      '000000000000000000000000000000', // row 3
      '000000000000000000000000000000', // row 4
      '000000000000000000000000000000', // row 5
      '000000000000000000000000000000', // row 6
      '000000000000000000000000000000', // row 7
      '000000000000000000000000000000', // row 8
      '000000000000000000000000000000', // row 9
      '000000000000000000000000000000', // row 10
      '000000000000000000000000000000', // row 11
      '000000000000000000000000000000', // row 12
      '000000000000000000000000000000', // row 13
      '111111111111000000001111111111', // row 14 – jurang di kolom 12 s/d 19!
    ],
    spawns: [
      { x:  52, y: 500 },
      { x:  88, y: 500 },
      { x: 124, y: 500 },
      { x: 160, y: 500 },
      { x: 196, y: 500 },
    ],
    key : { x: 960, y: 480 },  // Di seberang jurang
    door: { x: 1108, y: 480 }, // Di seberang jurang
    doorW: 48,
    doorH: 72,
    boxes: [],
    // 4 tombol di sisi kiri; hanya (playerCount - 1) tombol yang aktif
    buttons: [
      { id: 'btn_0', x: 240, y: 546, w: 38, h: 14, index: 0 },
      { id: 'btn_1', x: 300, y: 546, w: 38, h: 14, index: 1 },
      { id: 'btn_2', x: 360, y: 546, w: 38, h: 14, index: 2 },
      { id: 'btn_3', x: 420, y: 546, w: 38, h: 14, index: 3 },
    ],
    // Jembatan melintasi jurang di kolom 12-19 (x: 480 sampai 800, lebar 320)
    bridges: [
      { id: 'bridge_gap', x: 480, y: 546, w: 320, h: 14, active: false }
    ],
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

// ─── Dynamic Entities & DDS Initializer ──────────────────────────────────────
function initLevelEntities(lvl, pCount) {
  // 1. Dynamic Boxes (Heavy Box DDS)
  lvl.activeBoxes = (lvl.boxes || []).map(b => {
    const minPushers = b.minPushersFormula ? b.minPushersFormula(pCount) : (b.minPushers || 1);
    return {
      id            : b.id,
      x             : b.x,
      y             : b.y,
      w             : b.w,
      h             : b.h,
      vx            : 0,
      vy            : 0,
      onGround      : true,
      minPushers    : minPushers,
      currentPushers: 0,
    };
  });

  // 2. Dynamic Buttons (Multi-Buttons DDS: butuh playerCount - 1 tombol)
  const reqButtons = Math.max(1, pCount - 1);
  lvl.activeButtons = (lvl.buttons || []).map((btn, idx) => ({
    id     : btn.id,
    x      : btn.x,
    y      : btn.y,
    w      : btn.w,
    h      : btn.h,
    index  : btn.index !== undefined ? btn.index : idx,
    active : idx < reqButtons,
    pressed: false,
  }));

  // 3. Dynamic Bridges (Bridge DDS)
  lvl.activeBridges = (lvl.bridges || []).map(brg => ({
    id    : brg.id,
    x     : brg.x,
    y     : brg.y,
    w     : brg.w,
    h     : brg.h,
    active: false,
  }));

  // 4. Dynamic Key Placement (jika ada formula ketinggian tumpuk)
  if (lvl.keyFormula) {
    const kPos = lvl.keyFormula(pCount);
    lvl.key = { ...lvl.key, ...kPos };
  }
}

// ─── Player–Player Collisions (FIXED: Bebas Lengket & Magnet) ────────────────
function resolvePlayerCollisions(lvl) {
  const pArr = Object.values(players);
  for (let i = 0; i < pArr.length; i++) {
    for (let j = i + 1; j < pArr.length; j++) {
      const a = pArr[i];
      const b = pArr[j];

      const dx = (a.x + a.w / 2) - (b.x + b.w / 2);
      const dy = (a.y + a.h / 2) - (b.y + b.h / 2);

      const overlapX = (a.w / 2 + b.w / 2) - Math.abs(dx);
      const overlapY = (a.h / 2 + b.h / 2) - Math.abs(dy);

      // KUNCI: AABB strict positif! Jika tidak ada tumpang-tindih di kedua sumbu, TIDAK ADA TABRAKAN!
      if (overlapX <= 0 || overlapY <= 0) {
        continue;
      }

      // 1. Mekanik Tumpuk (Vertical Stacking di atas kepala)
      // Pemain A mendarat di atas Pemain B
      if (dy < 0 && (a.y + a.h - b.y) <= 16 && a.vy >= b.vy) {
        a.y = b.y - a.h;
        a.vy = 0;
        a.onGround = true;
      }
      // Pemain B mendarat di atas Pemain A
      else if (dy > 0 && (b.y + b.h - a.y) <= 16 && b.vy >= a.vy) {
        b.y = a.y - b.h;
        b.vy = 0;
        b.onGround = true;
      }
      // 2. Pemisahan Horizontal (Berdampingan tanpa gaya gesek lengket)
      else if (overlapX < overlapY) {
        const push = overlapX / 2;
        if (dx > 0) {
          // A di sebelah kanan B
          a.x += push;
          b.x -= push;
        } else {
          // A di sebelah kiri B
          a.x -= push;
          b.x += push;
        }
      }
      // 3. Pemisahan Vertikal jika saling berhimpit
      else {
        const push = overlapY / 2;
        if (dy > 0) {
          a.y += push;
          b.y -= push;
        } else {
          a.y -= push;
          b.y += push;
        }
      }

      // Pastikan pemain tidak keluar dari batas level
      a.x = Math.max(0, Math.min(lvl.worldW - a.w, a.x));
      b.x = Math.max(0, Math.min(lvl.worldW - b.w, b.x));
    }
  }
}

// ─── Dynamic Heavy Boxes Physics (DDS) ───────────────────────────────────────
function updateBoxes(lvl, dt) {
  if (!lvl.activeBoxes || lvl.activeBoxes.length === 0) return;
  const pArr = Object.values(players);

  lvl.activeBoxes.forEach(box => {
    let rightPushers = 0;
    let leftPushers  = 0;

    pArr.forEach(p => {
      // 1. Pemain berdiri di atas kotak
      const onTop = p.x + p.w > box.x + 2 &&
                    p.x < box.x + box.w - 2 &&
                    p.y + p.h >= box.y - 4 &&
                    p.y + p.h <= box.y + 12 &&
                    p.vy >= 0;
      if (onTop) {
        p.y = box.y - p.h;
        p.vy = 0;
        p.onGround = true;
      }

      // 2. Deteksi dorongan ke Kanan (pemain di kiri kotak, menekan kanan)
      const onLeft = p.x + p.w >= box.x - 4 &&
                     p.x + p.w <= box.x + 8 &&
                     p.y + p.h > box.y + 6 &&
                     p.y < box.y + box.h - 6;
      if (onLeft && p.keys.right) {
        rightPushers++;
      }

      // 3. Deteksi dorongan ke Kiri (pemain di kanan kotak, menekan kiri)
      const onRight = p.x >= box.x + box.w - 8 &&
                      p.x <= box.x + box.w + 4 &&
                      p.y + p.h > box.y + 6 &&
                      p.y < box.y + box.h - 6;
      if (onRight && p.keys.left) {
        leftPushers++;
      }
    });

    box.currentPushers = Math.max(rightPushers, leftPushers);

    // Dynamic Heavy Box Logic:
    // Hanya bergerak jika jumlah pendorong >= minPushers
    if (rightPushers >= box.minPushers) {
      box.vx = PLAYER_SPEED * 0.55;
    } else if (leftPushers >= box.minPushers) {
      box.vx = -PLAYER_SPEED * 0.55;
    } else {
      box.vx = 0;
    }

    // Gravitasi kotak
    box.vy += GRAVITY * dt;

    // Geser kotak & selesaikan tabrakan dengan ubin (tiles)
    const prevX = box.x;
    const res = resolveAABBVsTiles(lvl, box.x, box.y, box.vx, box.vy, box.w, box.h, dt);
    box.x = res.x;
    box.y = res.y;
    box.vx = res.vx;
    box.vy = res.vy;
    box.onGround = res.onGround;

    const deltaX = box.x - prevX;

    // Solid collision kotak terhadap pemain (mendorong pemain / pemain menaiki kotak)
    pArr.forEach(p => {
      // Jika menaiki kotak, bawa pemain ikut bergeser bersama kotak
      const onTop = p.x + p.w > box.x &&
                    p.x < box.x + box.w &&
                    Math.abs((p.y + p.h) - box.y) <= 6;
      if (onTop) {
        p.x += deltaX;
      }

      // Halangi pemain menembus sisi kotak
      const dx = (p.x + p.w / 2) - (box.x + box.w / 2);
      const dy = (p.y + p.h / 2) - (box.y + box.h / 2);
      const ox = (p.w / 2 + box.w / 2) - Math.abs(dx);
      const oy = (p.h / 2 + box.h / 2) - Math.abs(dy);

      if (ox > 0 && oy > 0) {
        if (p.y + p.h > box.y + 12) {
          if (dx > 0) p.x = box.x + box.w;
          else        p.x = box.x - p.w;
        }
      }
    });
  });
}

// ─── Dynamic Buttons & Bridges Physics (DDS) ─────────────────────────────────
function updateButtonsAndBridges(lvl) {
  if (!lvl.activeButtons || lvl.activeButtons.length === 0) return;
  const pArr = Object.values(players);
  const bArr = lvl.activeBoxes || [];

  // Reset status tombol
  lvl.activeButtons.forEach(btn => {
    btn.pressed = false;
    if (!btn.active) return; // Tombol non-aktif diabaikan

    // Cek apakah ada pemain menginjak tombol
    for (const p of pArr) {
      if (p.x + p.w > btn.x && p.x < btn.x + btn.w &&
          p.y + p.h >= btn.y && p.y + p.h <= btn.y + btn.h + 8) {
        btn.pressed = true;
        break;
      }
    }

    // Cek apakah ada kotak di atas tombol
    if (!btn.pressed) {
      for (const box of bArr) {
        if (box.x + box.w > btn.x && box.x < btn.x + btn.w &&
            box.y + box.h >= btn.y && box.y + box.h <= btn.y + btn.h + 8) {
          btn.pressed = true;
          break;
        }
      }
    }
  });

  // Jembatan aktif jika SEMUA tombol yang aktif sedang diinjak, ATAU kunci sudah diambil
  const activeBtns = lvl.activeButtons.filter(b => b.active);
  const allPressed = activeBtns.length > 0 && activeBtns.every(b => b.pressed);
  const bridgeActive = allPressed || keyCollected;

  if (lvl.activeBridges) {
    lvl.activeBridges.forEach(brg => {
      brg.active = bridgeActive;

      // Jika jembatan aktif, jadikan platform pijakan solid
      if (brg.active) {
        pArr.forEach(p => {
          if (p.x + p.w > brg.x && p.x < brg.x + brg.w &&
              p.y + p.h >= brg.y && p.y + p.h <= brg.y + brg.h + 8 &&
              p.vy >= 0) {
            p.y = brg.y - p.h;
            p.vy = 0;
            p.onGround = true;
          }
        });
      }
    });
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

  // 1. Update pergerakan pemain (Input + Gravitasi + Ubin)
  Object.values(players).forEach(p => {
    if (p.keys.left)       p.vx = -PLAYER_SPEED;
    else if (p.keys.right) p.vx =  PLAYER_SPEED;
    else                   p.vx = 0;

    if (p.keys.up && p.onGround) {
      p.vy = JUMP_VELOCITY;
      p.onGround = false;
    }

    p.vy += GRAVITY * dt;

    const res = resolveAABBVsTiles(lvl, p.x, p.y, p.vx, p.vy, p.w, p.h, dt);
    p.x = res.x; p.y = res.y; p.vx = res.vx; p.vy = res.vy; p.onGround = res.onGround;
  });

  // 2. Update Dynamic Heavy Boxes (DDS)
  updateBoxes(lvl, dt);

  // 3. Update Dynamic Buttons & Bridges (DDS)
  updateButtonsAndBridges(lvl);

  // 4. Tabrakan antar pemain (Bebas Lengket & Tumpuk Solid)
  resolvePlayerCollisions(lvl);

  // 5. Jurang / Pit Respawn (jika pemain jatuh ke luar arena)
  Object.values(players).forEach((p, idx) => {
    if (p.y > lvl.worldH + 15) {
      const sp = lvl.spawns[idx] || { x: 60, y: 500 };
      p.x = sp.x;
      p.y = sp.y;
      p.vx = 0;
      p.vy = 0;
      p.onGround = false;
    }
  });

  // 6. Ambil Kunci
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

  // 7. Cek Pintu Keluar – semua pemain yang terhubung harus berada di pintu bersamaan
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
      const hasNext = currentLevelIdx < LEVELS.length - 1;
      io.emit('levelComplete', {
        level        : lvl.id,
        hasNext      : hasNext,
        nextLevelId  : hasNext ? LEVELS[currentLevelIdx + 1].id : null,
        nextLevelName: hasNext ? LEVELS[currentLevelIdx + 1].name : null,
      });
    }
  }

  // 8. Broadcast snapshot ke semua client
  const snapshot = Object.values(players).map(p => ({
    id       : p.id,
    name     : p.name,
    color    : p.color,
    colorName: p.colorName,
    x        : Math.round(p.x),
    y        : Math.round(p.y),
    onGround : p.onGround,
    hasKey   : p.hasKey,
    atDoor   : p.atDoor,
    facing   : p.vx < 0 ? -1 : 1,
  }));

  io.emit('gameState', {
    players     : snapshot,
    keyCollected,
    gameState,
    level       : lvl,
    boxes       : lvl.activeBoxes || [],
    buttons     : lvl.activeButtons || [],
    bridges     : lvl.activeBridges || [],
  });
}

// ─── Level Starter Helper ───────────────────────────────────────────────────
function startLevel() {
  gameState    = 'playing';
  keyCollected = false;
  lastTick     = Date.now();

  const lvl = getLevel();
  const pCount = Object.keys(players).length;

  // Inisialisasi entitas dengan skala kesulitan dinamis berdasarkan playerCount
  initLevelEntities(lvl, pCount);

  // Reset posisi pemain ke titik spawn
  Object.values(players).forEach((pl, i) => {
    const sp = lvl.spawns[i] || { x: 60, y: 500 };
    pl.x        = sp.x;
    pl.y        = sp.y;
    pl.vx       = 0;
    pl.vy       = 0;
    pl.onGround = false;
    pl.atDoor   = false;
    pl.hasKey   = false;
  });

  io.emit('gameStarted', {
    level      : lvl,
    playerCount: pCount,
    levelIdx   : currentLevelIdx,
    totalLevels: LEVELS.length,
  });

  console.log(`[+] Started Level ${lvl.id}: "${lvl.name}" (Players: ${pCount})`);
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
    if (Object.keys(players).length < 2) return;
    startLevel();
  });

  socket.on('nextLevel', () => {
    const p = players[socket.id];
    if (!p || !p.isHost) return;
    if (currentLevelIdx < LEVELS.length - 1) {
      currentLevelIdx++;
      startLevel();
    }
  });

  socket.on('selectLevel', ({ levelIdx }) => {
    const p = players[socket.id];
    if (!p || !p.isHost) return;
    if (typeof levelIdx === 'number' && levelIdx >= 0 && levelIdx < LEVELS.length) {
      currentLevelIdx = levelIdx;
      if (gameState === 'playing') {
        startLevel();
      } else {
        io.emit('levelSelected', { levelIdx: currentLevelIdx, levelName: LEVELS[currentLevelIdx].name });
      }
    }
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

    socket.emit('leftGame');
    io.emit('playerLeft', { id: socket.id, name: p.name });

    // Jika game sedang main
    if (gameState === 'playing') {
      const remaining = Object.values(players);
      if (remaining.length < 1) {
        gameState    = 'lobby';
        keyCollected = false;
        io.emit('backToLobby');
      } else {
        // DDS Update: adaptasikan kembali rintangan level ke jumlah pemain baru
        const lvl = getLevel();
        initLevelEntities(lvl, remaining.length);
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
    currentLevelIdx = 0;
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
    // Restart level yang sama dengan DDS bersih
    startLevel();
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

    if (gameState === 'lobby') {
      broadcastLobby();
    } else {
      io.emit('playerLeft', { id: socket.id });
      const remaining = Object.values(players);
      if (remaining.length < 1) {
        gameState    = 'lobby';
        keyCollected = false;
        io.emit('backToLobby');
      } else {
        // DDS Adaptasi otomatis saat ada pemain terputus di tengah permainan
        const lvl = getLevel();
        initLevelEntities(lvl, remaining.length);
        broadcastPlayerLeftInGame();
      }
    }
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
