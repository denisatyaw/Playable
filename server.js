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

// ─── Level Data (Modular dari folder /levels) ───────────────────────────────
const LEVELS = require('./levels');

// ─── Server State ────────────────────────────────────────────────────────────
let gameState = 'lobby';   // 'lobby' | 'playing' | 'win'
let currentLevelIdx = 0;

const players = {};   // socketId → player object
let   keyCollected = false;
const VIEW_W = 1200;  // Lebar Viewport Kamera Bersama

function getLevel() { return LEVELS[currentLevelIdx]; }

function buildPlayerPhysics(spawnIdx) {
  const lvl  = getLevel();
  const spawn = lvl.spawns[spawnIdx] || { x: 60, y: 500 };
  return {
    x       : spawn.x,
    y       : spawn.y,
    prevX   : spawn.x,
    prevY   : spawn.y,
    deltaX  : 0,
    standingOnId: null,
    vx      : 0,
    vy      : 0,
    onGround: false,
    isAmmo  : false,
    isLaunched: false,
    w       : PLAYER_W,
    h       : PLAYER_H,
    keys    : { left: false, right: false, up: false, down: false },
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
    hasEntered: false,
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
function resolveAABBVsTiles(lvl, px, py, pvx, pvy, pw, ph, dt, gravityDir = 1) {
  const ts = lvl.tileSize;
  let x  = px + pvx * dt;
  let y  = py + pvy * dt;
  let vx = pvx;
  let vy = pvy;
  let onGround = false;

  // 1. Horizontal vs Tiles
  const colL = Math.floor(x          / ts);
  const colR = Math.floor((x + pw - 1) / ts);
  const rowT = Math.floor(py          / ts);
  const rowB = Math.floor((py + ph - 1) / ts);
  for (let r = rowT; r <= rowB; r++) {
    if (vx > 0 && isSolid(lvl, colR, r)) { x = colR * ts - pw; vx = 0; break; }
    if (vx < 0 && isSolid(lvl, colL, r)) { x = (colL + 1) * ts;    vx = 0; break; }
  }

  // Horizontal vs Closed Gates
  if (lvl.activeGates) {
    for (const g of lvl.activeGates) {
      if (!g.open) {
        if (py + ph > g.y + 4 && py < g.y + g.h - 4) {
          if (vx > 0 && px + pw <= g.x + 4 && x + pw > g.x) {
            x = g.x - pw;
            vx = 0;
          } else if (vx < 0 && px >= g.x + g.w - 4 && x < g.x + g.w) {
            x = g.x + g.w;
            vx = 0;
          }
        }
      }
    }
  }

  // 2. Vertical vs Tiles (Adaptif terhadap Gravitasi Normal vs Gravitasi Terbalik)
  const colL2 = Math.floor(x          / ts);
  const colR2 = Math.floor((x + pw - 1) / ts);
  const rowT2 = Math.floor(y          / ts);
  const rowB2 = Math.floor((y + ph - 1) / ts);
  for (let c = colL2; c <= colR2; c++) {
    if (gravityDir === -1) {
      // Gravitasi Terbalik: Langit-langit bertindak sebagai lantai pijakan (onGround = true)
      if (vy < 0 && isSolid(lvl, c, rowT2)) { y = (rowT2 + 1) * ts; vy = 0; onGround = true; break; }
      if (vy > 0 && isSolid(lvl, c, rowB2)) { y = rowB2 * ts - ph; vy = 0; break; }
    } else {
      // Gravitasi Normal: Lantai bertindak sebagai lantai pijakan
      if (vy > 0 && isSolid(lvl, c, rowB2)) { y = rowB2 * ts - ph; vy = 0; onGround = true; break; }
      if (vy < 0 && isSolid(lvl, c, rowT2)) { y = (rowT2 + 1) * ts; vy = 0; break; }
    }
  }

  // Vertical vs Active Bridges (solid surface for players and boxes)
  if (lvl.activeBridges) {
    for (const brg of lvl.activeBridges) {
      if (brg.active) {
        if (x + pw > brg.x + 2 && x < brg.x + brg.w - 2) {
          if (vy >= 0 && py + ph <= brg.y + 12 && y + ph >= brg.y) {
            y = brg.y - ph;
            vy = 0;
            onGround = true;
          }
        }
      }
    }
  }

  // Vertical vs Closed Gates (landing on top of a closed gate)
  if (lvl.activeGates) {
    for (const g of lvl.activeGates) {
      if (!g.open) {
        if (x + pw > g.x + 2 && x < g.x + g.w - 2) {
          if (vy >= 0 && py + ph <= g.y + 12 && y + ph >= g.y) {
            y = g.y - ph;
            vy = 0;
            onGround = true;
          }
        }
      }
    }
  }

  // Vertical vs Moving Platforms (landing on top)
  if (lvl.activeMovingPlatforms) {
    for (const mp of lvl.activeMovingPlatforms) {
      if (x + pw > mp.x + 2 && x < mp.x + mp.w - 2) {
        if (vy >= 0 && py + ph <= mp.y + 12 && y + ph >= mp.y) {
          y = mp.y - ph;
          vy = 0;
          onGround = true;
        }
      }
    }
  }

  // Vertical vs Invisible Platforms (solid hitbox)
  if (lvl.activeInvisiblePlatforms) {
    for (const ip of lvl.activeInvisiblePlatforms) {
      if (x + pw > ip.x + 2 && x < ip.x + ip.w - 2) {
        if (vy >= 0 && py + ph <= ip.y + 12 && y + ph >= ip.y) {
          y = ip.y - ph;
          vy = 0;
          onGround = true;
        }
      }
    }
  }

  // World bounds (Horizontal & Plafon)
  if (x < 0)                    { x = 0;               vx = 0; }
  if (x + pw > lvl.worldW)      { x = lvl.worldW - pw; vx = 0; }
  if (y < 0)                    { y = 0;               vy = 0; }
  // JANGAN kancing y di worldH agar pemain yang jatuh ke jurang maut
  // benar-benar jatuh ke bawah dan memicu reset level dari awal!

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
  lvl.activeButtons = (lvl.buttons || []).map((btn, idx) => {
    let active = false;
    if (btn.isLatch || btn.gateId || btn.laserIndex !== undefined) {
      active = true;
    } else if (btn.minPlayers) {
      active = pCount >= btn.minPlayers;
    } else {
      active = idx < reqButtons;
    }
    return {
      id        : btn.id,
      x         : btn.x,
      y         : btn.y,
      w         : btn.w,
      h         : btn.h,
      index     : btn.index !== undefined ? btn.index : idx,
      group     : btn.group,
      minPlayers: btn.minPlayers,
      isLatch   : !!btn.isLatch,
      isCeiling : !!btn.isCeiling,
      gateId    : btn.gateId,
      label     : btn.label,
      laserIndex: btn.laserIndex,
      active    : active,
      pressed   : false,
      latched   : false,
    };
  });

  // 3. Dynamic Bridges (Bridge DDS)
  lvl.activeBridges = (lvl.bridges || []).map(brg => {
    let initiallyLatched = false;
    if (brg.minPlayers && pCount < brg.minPlayers) {
      initiallyLatched = true; // Auto-terbuka jika jumlah pemain lebih sedikit dari syarat rintangan
    }
    return {
      id                : brg.id,
      x                 : brg.x,
      y                 : brg.y,
      w                 : brg.w,
      h                 : brg.h,
      group             : brg.group,
      minPlayers        : brg.minPlayers,
      isGeneratorPowered: !!brg.isGeneratorPowered,
      label             : brg.label || '',
      active            : initiallyLatched,
      latched           : initiallyLatched,
    };
  });

  // 4. Dynamic Lasers & Color Lasers (Laser Grid DDS)
  const reqLasers = Math.max(1, pCount - 1);
  const activeColors = Object.values(players).map(p => (p.color || '').toLowerCase());

  const stdLasers = (lvl.lasers || []).map((l, idx) => ({
    id         : l.id,
    x          : l.x,
    y          : l.y,
    w          : l.w,
    h          : l.h,
    orientation: l.orientation || 'vertical',
    index      : l.index !== undefined ? l.index : idx,
    active     : l.active !== undefined ? l.active : (idx < reqLasers),
    color      : l.color || null,
  }));

  const colLasers = (lvl.colorLasers || []).map((cl, idx) => ({
    id         : cl.id,
    x          : cl.x,
    y          : cl.y,
    w          : cl.w,
    h          : cl.h,
    orientation: cl.orientation || 'vertical',
    index      : cl.laserIndex !== undefined ? cl.laserIndex : (cl.index !== undefined ? cl.index : (100 + idx)),
    // DDS: Laser warna HANYA aktif jika warnanya sesuai karakter yang ada di room!
    active     : activeColors.length > 0 ? activeColors.includes((cl.color || '').toLowerCase()) : true,
    color      : cl.color,
  }));

  lvl.activeLasers = [...stdLasers, ...colLasers];

  // 5. Dynamic Springboards (Bantalan Lompat)
  lvl.activeSpringboards = (lvl.springboards || []).map(sb => ({
    id         : sb.id,
    x          : sb.x,
    y          : sb.y,
    w          : sb.w,
    h          : sb.h,
    bounceForce: sb.bounceForce || sb.forceY || -880,
    squash     : 0,
  }));

  // 6. Dynamic Gates (Gerbang Terbuka Otomatis via Tombol/Kunci/DDS)
  lvl.activeGates = (lvl.gates || []).map(g => {
    const autoOpen = g.minPlayers && pCount < g.minPlayers;
    return {
      id          : g.id,
      x           : g.x,
      y           : g.y,
      w           : g.w,
      h           : g.h,
      label       : g.label || 'GERBANG',
      open        : !!autoOpen,
      latched     : !!autoOpen,
      minPlayers  : g.minPlayers,
      holdDuration: g.holdDuration !== undefined ? g.holdDuration : 4.5,
      timer       : 0,
    };
  });

  // 7. Dynamic Key Placement (ketinggian tumpuk dinamis)
  if (lvl.keyFormula) {
    const kPos = lvl.keyFormula(pCount);
    lvl.key = { ...lvl.key, ...kPos };
  }

  // 8. Reset Kamera Bersama
  lvl.camX = 0;

  // 9. Slingshot (Ketapel Manusia)
  if (lvl.slingshot) {
    lvl.activeSlingshot = {
      ...lvl.slingshot,
      ammoId    : null,
      launcherId: null,
      tension   : 0,
      angle     : 0.785, // Default 45 derajat (0.785 rad)
      isPulling : false,
      cooldown  : 0,
    };
  } else {
    lvl.activeSlingshot = null;
  }

  // 10. Dynamic Moving Platforms (Level 8 Ferry)
  lvl.activeMovingPlatforms = (lvl.movingPlatforms || []).map(mp => {
    const w = mp.wFormula ? mp.wFormula(pCount) : mp.w;
    return {
      id    : mp.id,
      x     : mp.x,
      y     : mp.y,
      w     : w,
      h     : mp.h || 18,
      minX  : mp.minX,
      maxX  : mp.maxX,
      minY  : mp.minY,
      maxY  : mp.maxY,
      speed : mp.speed || 80,
      dir   : mp.dir || 1,
      deltaX: 0,
      label : mp.label || 'FERI PENGANGKUT',
    };
  });

  // 11. Seesaws (Timbangan)
  lvl.activeSeesaws = (lvl.seesaws || []).map(s => ({
    ...s,
    angle     : 0,
    angularVel: 0,
  }));

  // 12. Color Lasers (DDS: aktif sesuai warna pemain aktif)
  lvl.activeColorLasers = (lvl.colorLasers || []).map((cl, idx) => ({
    ...cl,
    index : idx,
    active: activeColors.length > 0 ? activeColors.includes((cl.color || '').toLowerCase()) : true,
  }));

  // 13. Torches (Darkness & Obor)
  lvl.activeTorches = (lvl.torches || []).map(t => ({
    id      : t.id,
    x       : t.x,
    y       : t.y,
    holderId: null,
  }));

  // 14. Generator Wheels (Roda Hamster)
  lvl.activeGeneratorWheels = (lvl.generatorWheels || []).map(gw => {
    const req = gw.reqRunnersFormula ? gw.reqRunnersFormula(pCount) : (gw.reqRunners || 1);
    return {
      ...gw,
      reqRunners    : req,
      power         : 0,
      rotation      : 0,
      currentRunners: 0,
    };
  });

  // 15. Invisible Platforms (Lantai Ilusi Solid)
  lvl.activeInvisiblePlatforms = (lvl.invisiblePlatforms || []).map(ip => ({
    ...ip,
    isRevealed: false,
  }));

  // 16. Compactor Wall (Dinding Bergeser)
  lvl.activeCompactorWall = lvl.compactorWall ? {
    ...lvl.compactorWall,
    currentX: lvl.compactorWall.x || 0,
    active  : true,
  } : null;

  // 17. Gravity Zones (Medan Gravitasi Terbalik Level 21)
  lvl.activeGravityZones = (lvl.gravityZones || []).map(gz => ({
    id : gz.id,
    x  : gz.x,
    y  : gz.y,
    w  : gz.w,
    h  : gz.h,
    dir: gz.dir !== undefined ? gz.dir : -1,
  }));
}

// ─── Player–Player Collisions & Tower Stacking (Pico Park Style) ──────────────
function resolvePlayerCollisions(lvl) {
  const pArr = Object.values(players);
  if (pArr.length < 2) return;

  // 1. Reset relasi pijakan antar pemain
  pArr.forEach(p => { p.standingOnId = null; });

  // 2. Deteksi Stacking (Siapa mendarat/berdiri di atas kepala siapa)
  for (let i = 0; i < pArr.length; i++) {
    for (let j = 0; j < pArr.length; j++) {
      if (i === j) continue;
      const upper = pArr[i];
      const lower = pArr[j];

      if (upper.isAmmo || lower.isAmmo || upper.hasEntered || lower.hasEntered) continue;
      if (upper.isInverted || lower.isInverted) continue; // Jangan tumpuk jika salah satu dalam gravitasi terbalik

      // Overlap horizontal minimal 8px agar kokoh berpijak
      const ox = Math.min(upper.x + upper.w, lower.x + lower.w) - Math.max(upper.x, lower.x);
      // Ketinggian kaki Upper terhadap kepala Lower
      const feetToHead = (upper.y + upper.h) - lower.y;

      // Upper berada di atas Lower jika kaki Upper pas di sekitar kepala Lower (-6px s/d 16px)
      if (ox >= 8 && feetToHead >= -6 && feetToHead <= 16 && upper.vy >= lower.vy && upper.y < lower.y) {
        upper.y = lower.y - upper.h;
        upper.vy = 0;
        upper.onGround = true;
        upper.standingOnId = lower.id;
      }
    }
  }

  // 3. PROPAGASI GERAKAN MENARA (Tower Carrying: Mengikuti gerakan pemain bawah)
  // Urutkan dari Y terbesar (lantai paling bawah) ke Y terkecil (puncak menara)
  // Sehingga jika menumpuk banyak (stack 2, 3, 4, 5 orang), seluruh menara
  // secara otomatis mengikuti perpindahan (deltaX) pemain yang berada di bawahnya!
  const sortedByY = [...pArr].sort((a, b) => b.y - a.y);

  sortedByY.forEach(rider => {
    if (rider.hasEntered) return;
    if (rider.standingOnId && players[rider.standingOnId]) {
      const base = players[rider.standingOnId];
      if (base.deltaX) {
        rider.x += base.deltaX;
        rider.deltaX = (rider.deltaX || 0) + base.deltaX;

        // Ikuti arah hadap pemain bawah jika pemain atas tidak menekan tombol jalan sendiri
        if (!rider.keys.left && !rider.keys.right && base.facing) {
          rider.facing = base.facing;
        }

        // Pastikan tidak tembus batas dunia
        rider.x = Math.max(0, Math.min(lvl.worldW - rider.w, rider.x));
      }
    }
  });

  // 4. Tabrakan Solid Horizontal untuk pemain yang TIDAK sedang bertumpukan
  for (let i = 0; i < pArr.length; i++) {
    for (let j = i + 1; j < pArr.length; j++) {
      const a = pArr[i];
      const b = pArr[j];

      if (a.isAmmo || b.isAmmo || a.hasEntered || b.hasEntered) continue;

      // Jangan pisahkan secara horizontal jika salah satu sedang menjadi pijakan bagi yang lain
      if (a.standingOnId === b.id || b.standingOnId === a.id) continue;

      const dx = (a.x + a.w / 2) - (b.x + b.w / 2);
      const dy = (a.y + a.h / 2) - (b.y + b.h / 2);

      const overlapX = (a.w / 2 + b.w / 2) - Math.abs(dx);
      const overlapY = (a.h / 2 + b.h / 2) - Math.abs(dy);

      if (overlapX <= 0 || overlapY <= 0) continue;

      if (overlapX < overlapY) {
        const push = overlapX / 2;
        if (dx > 0) {
          a.x += push;
          b.x -= push;
        } else {
          a.x -= push;
          b.x += push;
        }
      } else {
        const push = overlapY / 2;
        if (dy > 0) {
          a.y += push;
          b.y -= push;
        } else {
          a.y -= push;
          b.y += push;
        }
      }

      a.x = Math.max(0, Math.min(lvl.worldW - a.w, a.x));
      b.x = Math.max(0, Math.min(lvl.worldW - b.w, b.x));
    }
  }
}

// ─── Dynamic Heavy Boxes Physics (DDS, Queue Pushing & Stacking) ────────────
function updateBoxes(lvl, dt) {
  if (!lvl.activeBoxes || lvl.activeBoxes.length === 0) return;
  const pArr = Object.values(players);

  // 1. Deteksi interaksi pemain terhadap setiap kotak (berdiri di atas & barisan pendorong sejajar)
  lvl.activeBoxes.forEach(box => {
    // Tangani pemain berdiri di atas kotak
    pArr.forEach(p => {
      if (p.hasEntered || p.isAmmo) return;
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
    });

    // ── DORONG SEJAJAR KE KANAN ──────────────────────────────────────────
    // Pemain berada di sisi kiri kotak (atau di atas) dan menekan tombol RIGHT
    const rightPushersList = [];
    pArr.forEach(p => {
      if (p.hasEntered || p.isAmmo) return;

      const onTop = p.x + p.w > box.x - 4 && p.x < box.x + box.w + 4 &&
                    p.y + p.h >= box.y - 8 && p.y + p.h <= box.y + 16;

      // Jalur dorong vertikal: selevel dengan kotak atau tumpuk di atas pendorong
      const inPushLaneY = (p.y + p.h >= box.y - 48) && (p.y <= box.y + box.h + 20);

      // Sisi kiri kotak: berada di belakang kotak hingga 360px (menampung 6-8 pemain berbaris sejajar)
      const onLeftSide = (p.x + p.w <= box.x + 18) && (p.x + p.w >= box.x - 360);

      if (p.keys.right && (onTop || (inPushLaneY && onLeftSide))) {
        rightPushersList.push(p);
      }
    });

    // Syarat aktif: harus ada minimal 1 pemain terdepan yang berada tepat di dekat kotak (<= 28px)
    let rightPushers = 0;
    if (rightPushersList.some(p => (p.x + p.w >= box.x - 28) && (p.x <= box.x + box.w))) {
      rightPushers = rightPushersList.length;
    }

    // ── DORONG SEJAJAR KE KIRI ───────────────────────────────────────────
    // Pemain berada di sisi kanan kotak (atau di atas) dan menekan tombol LEFT
    const leftPushersList = [];
    pArr.forEach(p => {
      if (p.hasEntered || p.isAmmo) return;

      const onTop = p.x + p.w > box.x - 4 && p.x < box.x + box.w + 4 &&
                    p.y + p.h >= box.y - 8 && p.y + p.h <= box.y + 16;

      const inPushLaneY = (p.y + p.h >= box.y - 48) && (p.y <= box.y + box.h + 20);

      // Sisi kanan kotak: berada di depan kotak hingga 360px ke kanan
      const onRightSide = (p.x >= box.x + box.w - 18) && (p.x <= box.x + box.w + 360);

      if (p.keys.left && (onTop || (inPushLaneY && onRightSide))) {
        leftPushersList.push(p);
      }
    });

    // Syarat aktif: harus ada minimal 1 pemain terdepan di dekat kotak
    let leftPushers = 0;
    if (leftPushersList.some(p => (p.x <= box.x + box.w + 28) && (p.x + p.w >= box.x))) {
      leftPushers = leftPushersList.length;
    }

    box.currentPushers = Math.max(rightPushers, leftPushers);

    // Dynamic Heavy Box Logic:
    // Hanya bergerak jika jumlah pendorong >= minPushers
    if (rightPushers >= box.minPushers && rightPushers > leftPushers) {
      box.vx = PLAYER_SPEED * 0.6;
    } else if (leftPushers >= box.minPushers && leftPushers > rightPushers) {
      box.vx = -PLAYER_SPEED * 0.6;
    } else {
      box.vx = 0;
    }

    // Gravitasi kotak (menyesuaikan gravitasi level, e.g. Gravitasi Bulan)
    box.vy += (lvl.gravity !== undefined ? lvl.gravity : GRAVITY) * dt;

    // Geser kotak & selesaikan tabrakan dengan ubin (tiles)
    const prevX = box.x;
    const res = resolveAABBVsTiles(lvl, box.x, box.y, box.vx, box.vy, box.w, box.h, dt);
    box.x = res.x;
    box.y = res.y;
    box.vx = res.vx;
    box.vy = res.vy;
    box.onGround = res.onGround;

    box.deltaX = box.x - prevX;
  });

  // 2. Tabrakan Antar Kotak (Box vs Box: Solid & Stacking)
  for (let i = 0; i < lvl.activeBoxes.length; i++) {
    for (let j = 0; j < lvl.activeBoxes.length; j++) {
      if (i === j) continue;
      const b1 = lvl.activeBoxes[i];
      const b2 = lvl.activeBoxes[j];

      const dx = (b1.x + b1.w / 2) - (b2.x + b2.w / 2);
      const dy = (b1.y + b1.h / 2) - (b2.y + b2.h / 2);
      const ox = (b1.w / 2 + b2.w / 2) - Math.abs(dx);
      const oy = (b1.h / 2 + b2.h / 2) - Math.abs(dy);

      if (ox > 0 && oy > 0) {
        // b1 mendarat di atas b2 (Stacking Kotak di Atas Kotak)
        if (dy < 0 && (b1.y + b1.h - b2.y) <= 18 && b1.vy >= b2.vy) {
          b1.y = b2.y - b1.h;
          b1.vy = 0;
          b1.onGround = true;
          // Ikuti gerakan kotak di bawahnya
          if (b2.deltaX) {
            b1.x += b2.deltaX;
          }
        }
        // Pemisahan horizontal jika berdampingan
        else if (ox < oy) {
          if (dx > 0) {
            b1.x = b2.x + b2.w;
          } else {
            b1.x = b2.x - b1.w;
          }
          b1.vx = 0;
        }
      }
    }
  }

  // 3. Solid collision kotak terhadap pemain & pembawaan gerak pemain
  lvl.activeBoxes.forEach(box => {
    pArr.forEach(p => {
      if (p.hasEntered || p.isAmmo) return;

      // 1. Pemain berdiri di atas kotak: terbawa pergerakan kotak
      const onTop = p.x + p.w > box.x + 2 &&
                    p.x < box.x + box.w - 2 &&
                    p.y + p.h >= box.y - 4 &&
                    p.y + p.h <= box.y + 14 &&
                    p.vy >= 0;
      if (onTop) {
        p.y = box.y - p.h;
        p.vy = 0;
        p.onGround = true;
        if (box.deltaX) {
          p.x += box.deltaX;
          p.deltaX = (p.deltaX || 0) + box.deltaX;
        }
      } else {
        // 2. Pemain di samping kotak: TIDAK BISA MENEMBUS KOTAK
        const dx = (p.x + p.w / 2) - (box.x + box.w / 2);
        const dy = (p.y + p.h / 2) - (box.y + box.h / 2);
        const ox = (p.w / 2 + box.w / 2) - Math.abs(dx);
        const oy = (p.h / 2 + box.h / 2) - Math.abs(dy);

        if (ox > 0 && oy > 0) {
          if (p.y + p.h > box.y + 6) {
            if (dx > 0) {
              p.x = box.x + box.w;
              if (p.vx < 0) p.vx = 0;
            } else {
              p.x = box.x - p.w;
              if (p.vx > 0) p.vx = 0;
            }
          }
        }
      }
    });
  });
}

// ─── Dynamic Buttons & Bridges Physics (DDS, Multi-Group & Gates) ────────────
function updateButtonsAndBridges(lvl, dt) {
  if (!lvl.activeButtons || lvl.activeButtons.length === 0) return;
  const pArr = Object.values(players);
  const bArr = lvl.activeBoxes || [];

  // Reset status tombol (kecuali jika sudah latched)
  lvl.activeButtons.forEach(btn => {
    btn.pressed = false;
    if (!btn.active) return;

    // Cek apakah ada pemain menginjak/menyentuh tombol (Lantai atau Langit-Langit)
    for (const p of pArr) {
      if (p.hasEntered) continue;
      const touchesX = p.x + p.w > btn.x && p.x < btn.x + btn.w;
      const pressedFromFloor = p.y + p.h >= btn.y && p.y + p.h <= btn.y + btn.h + 8;
      const pressedFromCeil  = p.y <= btn.y + btn.h + 4 && p.y >= btn.y - 8;
      const touchesY = btn.isCeiling ? pressedFromCeil : pressedFromFloor;
      if (touchesX && touchesY) {
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

    // Jika ini adalah tombol Latch dan terinjak:
    if (btn.isLatch && btn.pressed) {
      btn.latched = true;
      // Kunci jembatan group terkait
      if (lvl.activeBridges && btn.group) {
        lvl.activeBridges.forEach(brg => {
          if (brg.group === btn.group) {
            brg.latched = true;
            brg.active  = true;
          }
        });
      }
      // Jika ada generator wheel terkait, kunci juga
      if (lvl.activeGeneratorWheels) {
        lvl.activeGeneratorWheels.forEach(gw => {
          if (gw.group === btn.group) {
            gw.latched = true;
            gw.power   = 100;
          }
        });
      }
      // Buka gerbang terkait secara permanen jika di-latch
      if (lvl.activeGates && btn.gateId) {
        lvl.activeGates.forEach(g => {
          if (g.id === btn.gateId) {
            g.latched = true;
            g.open    = true;
            g.timer   = 0;
          }
        });
      }
    }
  });

  // Update status Gerbang (Dynamic Gates & Multi-Buttons Co-op dengan Durasi Waktu)
  if (lvl.activeGates) {
    lvl.activeGates.forEach(g => {
      if (keyCollected || g.latched) {
        g.open  = true;
        g.timer = 0;
        return;
      }

      const controllingBtns = (lvl.activeButtons || []).filter(b => b.gateId === g.id && b.active);
      if (controllingBtns.length > 0) {
        if (controllingBtns.some(b => b.isLatch && b.latched)) {
          g.latched = true;
          g.open    = true;
          g.timer   = 0;
          return;
        }

        const normalBtns = controllingBtns.filter(b => !b.isLatch);
        if (normalBtns.length > 0) {
          const allPressed = normalBtns.every(b => b.pressed);
          if (allPressed) {
            // Semua tombol ditekan bersama: buka gerbang & reset timer ke durasi penuh
            g.open  = true;
            g.timer = g.holdDuration !== undefined ? g.holdDuration : 4.5;
          } else if (g.timer > 0) {
            // Saat pemain melangkah pergi: gerbang TETAP TERBUKA selama durasi waktu (tidak menutup instant!)
            g.timer = Math.max(0, g.timer - (dt || 0.016));
            g.open  = true;
          } else {
            g.open  = false;
            g.timer = 0;
          }
        } else {
          g.open  = false;
          g.timer = 0;
        }
      }
    });
  }

  // Jika kunci diambil, buka semua gerbang & jembatan selamanya!
  if (keyCollected) {
    if (lvl.activeGates) {
      lvl.activeGates.forEach(g => { g.open = true; g.timer = 0; });
    }
    if (lvl.activeBridges) {
      lvl.activeBridges.forEach(brg => { brg.latched = true; brg.active = true; });
    }
  }

  // Update status Jembatan
  if (lvl.activeBridges) {
    lvl.activeBridges.forEach(brg => {
      // Jika jembatan dikontrol oleh generator wheel dan bukan tombol murni,
      // generator wheel yang menentukan status aktifnya
      if (brg.isGeneratorPowered) {
        if (brg.latched || keyCollected) {
          brg.active = true;
        }
      } else {
        let isPowered = false;

        if (brg.group) {
          // Tombol yang se-grup dengan jembatan ini
          const grpBtns = lvl.activeButtons.filter(b => b.group === brg.group && b.active && !b.isLatch);
          const grpAllPressed = grpBtns.length > 0 && grpBtns.every(b => b.pressed);
          if (grpAllPressed) {
            brg.latched = true; // Jembatan mengunci aktif setelah seluruh kawan menginjak tombol
          }
          isPowered = grpAllPressed || brg.latched || keyCollected;
        } else {
          const activeBtns = lvl.activeButtons.filter(b => b.active && !b.isLatch);
          const allPressed = activeBtns.length > 0 && activeBtns.every(b => b.pressed);
          isPowered = allPressed || brg.latched || keyCollected;
        }

        brg.active = isPowered;
      }

      // Jika jembatan aktif, jadikan platform solid untuk pemain
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

// ─── Dynamic Gates Physics (Anti-Strand Gate Barrier) ────────────────────────
function updateGates(lvl) {
  if (!lvl.activeGates || lvl.activeGates.length === 0) return;
  const pArr = Object.values(players);
  const bArr = lvl.activeBoxes || [];

  lvl.activeGates.forEach(gate => {
    // Jika kunci sudah diambil, gerbang selalu terbuka
    if (keyCollected) {
      gate.open = true;
    }

    // Jika gerbang masih tertutup, bertindak sebagai dinding solid
    if (!gate.open) {
      // Halangi pemain menembus
      pArr.forEach(p => {
        const dx = (p.x + p.w / 2) - (gate.x + gate.w / 2);
        const dy = (p.y + p.h / 2) - (gate.y + gate.h / 2);
        const ox = (p.w / 2 + gate.w / 2) - Math.abs(dx);
        const oy = (p.h / 2 + gate.h / 2) - Math.abs(dy);

        if (ox > 0 && oy > 0) {
          if (ox < oy) {
            if (dx > 0) { p.x = gate.x + gate.w; if (p.vx < 0) p.vx = 0; }
            else        { p.x = gate.x - p.w;    if (p.vx > 0) p.vx = 0; }
          } else {
            if (dy > 0) { p.y = gate.y + gate.h; if (p.vy < 0) p.vy = 0; }
            else        { p.y = gate.y - p.h;    if (p.vy > 0) p.vy = 0; p.onGround = true; }
          }
        }
      });

      // Halangi kotak menembus
      bArr.forEach(b => {
        const dx = (b.x + b.w / 2) - (gate.x + gate.w / 2);
        const dy = (b.y + b.h / 2) - (gate.y + gate.h / 2);
        const ox = (b.w / 2 + gate.w / 2) - Math.abs(dx);
        const oy = (b.h / 2 + gate.h / 2) - Math.abs(dy);

        if (ox > 0 && oy > 0) {
          if (ox < oy) {
            if (dx > 0) { b.x = gate.x + gate.w; if (b.vx < 0) b.vx = 0; }
            else        { b.x = gate.x - b.w;    if (b.vx > 0) b.vx = 0; }
          }
        }
      });
    }
  });
}

// ─── Dynamic Lasers Physics (Level 5 Hazard & Dual-Shield Co-op) ────────────
function updateLasers(lvl) {
  if (!lvl.activeLasers || lvl.activeLasers.length === 0) return false;
  const pArr = Object.values(players);

  for (const laser of lvl.activeLasers) {
    // 1. Jika Kunci sudah diambil, seluruh laser otomatis mati!
    if (keyCollected) {
      laser.isBlocked = true;
      laser.blockedByShield = false;
      continue;
    }

    // 2. Tombol kontrol (jika level menggunakan tombol deaktifasi laser)
    const matchingBtn = (lvl.activeButtons || []).find(b => b.laserIndex === laser.index);
    const isBtnPressed = matchingBtn ? (matchingBtn.pressed || matchingBtn.latched) : false;

    // 3. Deteksi Perisai Pemain (Dual-Shield Co-op):
    //    Player 1: Top Shield (di atas kepala) -> Menahan laser vertikal langit-langit
    //    Player 2: Front Shield (di depan badan) -> Menahan laser horizontal
    let blockedByShield = false;
    let cutRight  = laser.x + laser.w;
    let cutBottom = laser.y + laser.h;

    const isHorizontal = laser.orientation === 'horizontal';
    const isVertical   = laser.orientation === 'vertical' || !laser.orientation;

    pArr.forEach(p => {
      // 🛡️ FRONT SHIELD: Menahan Laser Horizontal!
      if (p.shieldType === 'front' && isHorizontal) {
        const facing = p.facing || 1;
        const sX = (facing === 1) ? p.x + p.w - 4 : p.x - 14;
        const sY = p.y - 8;
        const sW = 18;
        const sH = p.h + 16;

        if (sX + sW > laser.x && sX < laser.x + laser.w &&
            sY + sH > laser.y && sY < laser.y + laser.h) {
          blockedByShield = true;
          cutRight = Math.min(cutRight, sX + (facing === 1 ? 6 : sW));
        }
      }

      // 🛡️ TOP SHIELD: Menahan Laser Vertikal!
      if (p.shieldType === 'top' && isVertical) {
        const sX = p.x - 12;
        const sY = p.y - 14;
        const sW = p.w + 24;
        const sH = 16;

        if (sX + sW > laser.x && sX < laser.x + laser.w &&
            sY + sH > laser.y && sY < laser.y + laser.h) {
          blockedByShield = true;
          cutBottom = Math.min(cutBottom, sY + 4);
        }
      }
    });

    laser.blockedByShield = blockedByShield;
    laser.isBlocked = isBtnPressed || (isHorizontal && blockedByShield);
    laser.cutRight  = cutRight;
    laser.cutBottom = cutBottom;

    // 4. Tabrakan mematikan terhadap pemain yang tidak terlindungi perisai
    if (laser.active && !isBtnPressed && !laser.isBlocked && !keyCollected) {
      let hitPlayer = null;
      for (let idx = 0; idx < pArr.length; idx++) {
        const p = pArr[idx];
        if (p.isAmmo || p.hasEntered) continue;

        // Color Lasers: Collision diabaikan (tembus aman) jika warna pemain SAMA dengan warna laser!
        if (laser.color && p.color && p.color.toLowerCase() === laser.color.toLowerCase()) {
          continue;
        }

        // Pemain pembawa perisai depan kebal terhadap laser horizontal
        if (p.shieldType === 'front' && isHorizontal) continue;
        // Pemain pembawa perisai atas kebal terhadap laser vertikal
        if (p.shieldType === 'top' && isVertical) continue;

        // Escort Co-op: Teammates terlindungi saat berjalan bersama rekan pembawa perisai
        if (isHorizontal) {
          const frontBearer = pArr.find(pl => pl.shieldType === 'front');
          if (frontBearer && Math.abs(p.x - frontBearer.x) < 80 && Math.abs(p.y - frontBearer.y) < 60) continue;
        }
        if (isVertical && blockedByShield) {
          const topBearer = pArr.find(pl => pl.shieldType === 'top');
          if (topBearer && Math.abs(p.x - topBearer.x) < 60 && p.y >= topBearer.y - 12) continue;
        }

        // Cek tabrakan dengan bagian laser yang aktif
        let hit = false;
        if (isHorizontal) {
          // Jika laser horizontal tidak sedang diblokir perisai depan
          hit = p.x + p.w > laser.x && p.x < laser.x + laser.w &&
                p.y + p.h > laser.y + 2 && p.y < laser.y + laser.h - 2;
        } else {
          // Laser vertikal: hanya mematikan jika berada di atas pelindung atas
          hit = p.x + p.w > laser.x + 2 && p.x < laser.x + laser.w - 2 &&
                p.y + p.h > laser.y && p.y < cutBottom;
        }

        if (hit) {
          hitPlayer = p;
          break;
        }
      }

      if (hitPlayer) {
        console.log(`[!] Laser hit: ${hitPlayer.name} terkena laser! Mengulang level dari awal.`);
        io.emit('playerVaporized', { 
          id: hitPlayer.id, 
          name: hitPlayer.name,
          reason: `⚡ ${hitPlayer.name} terkena laser! Mengulang level dari awal...` 
        });
        io.emit('levelRetryNotification', { 
          by: hitPlayer.name,
          reason: `⚡ ${hitPlayer.name} terkena laser! Mengulang level dari awal...` 
        });
        startLevel();
        return true;
      }
    }
  }
  return false;
}

// ─── Springboards Physics (Level 4 & 5 Trampolin) ────────────────────────────
function updateSpringboards(lvl) {
  if (!lvl.activeSpringboards || lvl.activeSpringboards.length === 0) return;
  const pArr = Object.values(players);

  lvl.activeSpringboards.forEach(sb => {
    if (sb.squash > 0) sb.squash = Math.max(0, sb.squash - 0.1);

    pArr.forEach(p => {
      const onPad = p.x + p.w > sb.x &&
                    p.x       < sb.x + sb.w &&
                    p.y + p.h >= sb.y &&
                    p.y + p.h <= sb.y + sb.h + 10 &&
                    p.vy >= 0;
      if (onPad) {
        p.vy = sb.bounceForce || -880;
        p.onGround = false;
        sb.squash = 1;
      }
    });
  });
}

// ─── Slingshot Physics (Ketapel Manusia Co-op - Level 11) ────────────────────
function updateSlingshot(lvl, dt) {
  const sling = lvl.activeSlingshot;
  if (!sling) return;
  const pArr = Object.values(players);

  if (sling.cooldown > 0) {
    sling.cooldown = Math.max(0, sling.cooldown - dt);
  }

  // 1. Cek keberadaan ammo player (jika diskonek, lepas status)
  if (sling.ammoId && !players[sling.ammoId]) {
    sling.ammoId = null;
    sling.tension = 0;
    sling.isPulling = false;
    sling.launcherId = null;
  }

  // 2. Deteksi pemain masuk ke dalam kantong ketapel (State 'Ammo')
  if (!sling.ammoId && sling.cooldown <= 0) {
    for (const p of pArr) {
      const inPouch = Math.abs((p.x + p.w / 2) - sling.pouchX) < 28 &&
                      Math.abs((p.y + p.h) - sling.pouchY) < 32;
      if (inPouch && !p.isAmmo) {
        sling.ammoId = p.id;
        sling.tension = 0;
        sling.isPulling = false;
        sling.launcherId = null;
        p.isAmmo = true;
        p.isLaunched = false;
        break;
      }
    }
  }

  const ammoPlayer = sling.ammoId ? players[sling.ammoId] : null;

  // 3. Jika ada Ammo player di kantong:
  if (ammoPlayer) {
    ammoPlayer.isAmmo = true;
    ammoPlayer.onGround = false;

    // Jika ammo menekan tombol lompat (W / Space / Up) saat ketapel belum ditarik, izinkan keluar
    if (ammoPlayer.keys.up && (sling.tension === 0 || !sling.isPulling)) {
      ammoPlayer.vy = -450;
      ammoPlayer.isAmmo = false;
      ammoPlayer.isLaunched = false;
      sling.ammoId = null;
      sling.cooldown = 0.5;
    }

    // Kunci posisi ammo di kantong ketapel (mengikuti peregangan karet)
    if (sling.ammoId === ammoPlayer.id) {
      const tensionRatio = Math.min(1.0, (sling.tension || 0) / (sling.maxTension || 3.0));
      const stretchOffset = tensionRatio * 52;
      const angle = sling.angle || 0.785;
      ammoPlayer.x = sling.pouchX - ammoPlayer.w / 2 - Math.cos(angle) * stretchOffset;
      ammoPlayer.y = sling.pouchY - ammoPlayer.h + Math.sin(angle) * (stretchOffset * 0.6);
      ammoPlayer.vx = 0;
      ammoPlayer.vy = 0;
    }
  } else {
    sling.tension = 0;
    sling.isPulling = false;
    sling.launcherId = null;
  }
}

// ─── Moving Platforms Physics (Level 8 Moving Ferry) ─────────────────────────
function updateMovingPlatforms(lvl, dt) {
  if (!lvl.activeMovingPlatforms || lvl.activeMovingPlatforms.length === 0) return;
  const pArr = Object.values(players);

  lvl.activeMovingPlatforms.forEach(mp => {
    const prevX = mp.x;
    mp.x += mp.speed * mp.dir * dt;
    if (mp.x >= mp.maxX) {
      mp.x = mp.maxX;
      mp.dir = -1;
    } else if (mp.x <= mp.minX) {
      mp.x = mp.minX;
      mp.dir = 1;
    }
    mp.deltaX = mp.x - prevX;

    // Solid platform & carries standing players
    pArr.forEach(p => {
      if (p.isAmmo || p.hasEntered) return;
      const onPlatform = (
        p.x + p.w > mp.x + 2 &&
        p.x < mp.x + mp.w - 2 &&
        p.y + p.h >= mp.y - 6 &&
        p.y + p.h <= mp.y + 14 &&
        p.vy >= 0
      );
      if (onPlatform) {
        p.y = mp.y - p.h;
        p.vy = 0;
        p.onGround = true;
        p.x += mp.deltaX;
        p.deltaX = (p.deltaX || 0) + mp.deltaX;
        p.x = Math.max(0, Math.min(lvl.worldW - p.w, p.x));
      }
    });
  });
}

// ─── Seesaw Physics (Level 12 The Balance - Responsif & Presisi) ─────────────
function updateSeesaws(lvl, dt) {
  if (!lvl.activeSeesaws || lvl.activeSeesaws.length === 0) return;
  const pArr = Object.values(players);
  const bArr = lvl.activeBoxes || [];

  lvl.activeSeesaws.forEach(sw => {
    let torque = 0;
    const maxA = sw.maxAngle || 0.38; // ~22 derajat
    const curA = sw.angle || 0;
    const halfL = sw.length / 2;
    const h = sw.thickness || 16;
    const halfH = h / 2;

    // 1. Interaksi Pemain di atas Papan Timbangan
    pArr.forEach(p => {
      if (p.isAmmo || p.hasEntered) return;
      const px = p.x + p.w / 2;
      const py = p.y + p.h;
      const dx = px - sw.pivotX;

      // Cek apakah pemain berada dalam bentang papan timbangan
      if (Math.abs(dx) <= halfL + 6) {
        // Ketinggian permukaan atas papan timbangan
        const plankY = sw.pivotY + Math.sin(curA) * dx - halfH;

        const wasOnSeesaw = (p.onSeesawId === sw.id);
        const toleranceTop = wasOnSeesaw ? 26 : 18;
        const toleranceBottom = wasOnSeesaw ? 32 : 22;

        if (py >= plankY - toleranceTop && py <= plankY + toleranceBottom) {
          p.y = plankY - p.h;
          p.vy = 0;
          p.onGround = true;
          p.onSeesawId = sw.id;

          // Torsi responsif: berbanding lurus dengan jarak dari poros
          torque += dx * 4.5;

          // Efek Merosot (Slide) jika kemiringan curam (> 9.5 derajat = 0.165 rad)
          if (Math.abs(curA) > 0.165) {
            const slideForce = Math.sin(curA) * 450;
            p.vx += slideForce * dt;
          }
        } else if (wasOnSeesaw && (py > plankY + toleranceBottom || py < plankY - 36)) {
          p.onSeesawId = null;
        }
      } else if (p.onSeesawId === sw.id) {
        p.onSeesawId = null;
      }
    });

    // 2. Interaksi Kotak Beban (Boxes) di atas Papan Timbangan
    bArr.forEach(box => {
      const bx = box.x + box.w / 2;
      const by = box.y + box.h;
      const dx = bx - sw.pivotX;

      if (Math.abs(dx) <= halfL + 6) {
        const plankY = sw.pivotY + Math.sin(curA) * dx - halfH;
        if (by >= plankY - 20 && by <= plankY + 28) {
          box.y = plankY - box.h;
          box.vy = 0;
          box.onGround = true;

          // Kotak memberi beban torsi stabil
          torque += dx * 6.5;

          // Kotak ikut merosot perlahan jika kemiringan sangat curam
          if (Math.abs(curA) > 0.22) {
            box.x += Math.sin(curA) * 160 * dt;
          }
        }
      }
    });

    // 3. Auto-Leveling / Torsi Pemulihan saat Kosong
    const restoringTorque = -curA * 1.6;

    // 4. Percepatan Sudut yang Responsif & Halus (~0.4 - 0.6 detik menuju kemiringan penuh)
    const angularAcc = (torque * 0.009) + restoringTorque - (sw.angularVel || 0) * 4.2;
    sw.angularVel = (sw.angularVel || 0) + angularAcc * dt;
    sw.angle = curA + sw.angularVel * dt;

    // Batasi sudut maksimal
    if (sw.angle > maxA) {
      sw.angle = maxA;
      sw.angularVel = 0;
    } else if (sw.angle < -maxA) {
      sw.angle = -maxA;
      sw.angularVel = 0;
    }
  });
}

// ─── Generator Wheels (Level 16 & 20 Hamster Power) ──────────────────────────
function updateGeneratorWheels(lvl, dt) {
  if (!lvl.activeGeneratorWheels || lvl.activeGeneratorWheels.length === 0) return;
  const pArr = Object.values(players);

  lvl.activeGeneratorWheels.forEach(gw => {
    let runners = 0;
    const r = gw.radius || 48;

    pArr.forEach(p => {
      if (p.isAmmo || p.hasEntered) return;
      const px = p.x + p.w / 2;
      const py = p.y + p.h / 2;
      if (Math.hypot(px - gw.x, py - gw.y) <= r + 4) {
        if (p.keys.right || p.keys.left) {
          runners++;
        }
      }
    });

    gw.currentRunners = runners;
    const req = gw.reqRunners || 1;

    if (gw.latched) {
      gw.power = 100;
      gw.rotation = ((gw.rotation || 0) + 1.2 * dt) % (Math.PI * 2);
    } else if (runners >= req) {
      // Kecepatan putaran dan pengisian stabil & tidak ngebut (~4 detik menuju 100%)
      gw.power = Math.min(100, (gw.power || 0) + (25 * (runners / req)) * dt);
      gw.rotation = ((gw.rotation || 0) + 2.0 * dt) % (Math.PI * 2);
      if (gw.power >= 100) {
        gw.latched = true;
        gw.power   = 100;
      }
    } else if (runners > 0) {
      gw.power = Math.min(100, (gw.power || 0) + (15 * (runners / req)) * dt);
      gw.rotation = ((gw.rotation || 0) + 1.2 * dt) % (Math.PI * 2);
    } else {
      // Pengurangan daya berjalan santai (~16.6 detik) agar pemain tidak terburu-buru
      gw.power = Math.max(0, (gw.power || 0) - 6.0 * dt);
    }

    // Aktifkan jembatan listrik yang terhubung
    if (gw.targetType === 'bridge' && lvl.activeBridges) {
      lvl.activeBridges.forEach(brg => {
        const isTarget = brg.id === gw.targetId || (gw.targetBridgeIds && gw.targetBridgeIds.includes(brg.id));
        if (isTarget) {
          if (gw.latched) brg.latched = true;
          brg.active = brg.latched || (gw.power >= 10) || keyCollected;
        }
      });
    }
    if (gw.targetType === 'elevator' && lvl.activeMovingPlatforms) {
      const elev = lvl.activeMovingPlatforms.find(m => m.id === gw.targetId);
      if (elev && elev.minY !== undefined && elev.maxY !== undefined) {
        const ratio = (gw.power || 0) / 100;
        elev.y = elev.maxY - (elev.maxY - elev.minY) * ratio;

        // Bawa pemain yang berdiri di atas elevator naik/turun bersama elevator
        pArr.forEach(p => {
          if (p.isAmmo || p.hasEntered) return;
          const onElev = (
            p.x + p.w > elev.x + 2 &&
            p.x < elev.x + elev.w - 2 &&
            p.y + p.h >= elev.y - 10 &&
            p.y + p.h <= elev.y + 20
          );
          if (onElev) {
            p.y = elev.y - p.h;
            p.vy = 0;
            p.onGround = true;
          }
        });
      }
    }
  });
}

// ─── Invisible Platforms (Level 17 & 20 Lantai Ilusi) ─────────────────────────
function updateInvisiblePlatforms(lvl) {
  if (!lvl.activeInvisiblePlatforms || lvl.activeInvisiblePlatforms.length === 0) return;
  lvl.activeInvisiblePlatforms.forEach(ip => {
    let revealed = false;
    if (ip.revealButtonId && lvl.activeButtons) {
      const btn = lvl.activeButtons.find(b => b.id === ip.revealButtonId);
      if (btn && (btn.pressed || btn.latched)) {
        revealed = true;
      }
    }
    if (ip.revealButtonIds && lvl.activeButtons) {
      const anyPressed = lvl.activeButtons.some(b => ip.revealButtonIds.includes(b.id) && (b.pressed || b.latched));
      if (anyPressed) {
        revealed = true;
      }
    }
    if (ip.revealWithPower && lvl.activeGeneratorWheels) {
      const gen = lvl.activeGeneratorWheels.find(g => g.id === ip.powerGenId);
      if (gen && (gen.power > 10 || gen.latched)) {
        revealed = true;
      }
    }
    if (keyCollected) revealed = true;
    ip.isRevealed = revealed;
  });
}

// ─── Compactor Wall (Level 18 Panic Room) ─────────────────────────────────────
function updateCompactorWall(lvl, dt) {
  if (!lvl.activeCompactorWall) return false;
  const cw = lvl.activeCompactorWall;
  if (!cw.active) return false;
  const pArr = Object.values(players);

  // Batas maksimum pergerakan dinding (misal tebing aman di x: 880)
  const maxX = cw.maxX !== undefined ? (cw.maxX - cw.w) : lvl.worldW;
  if (cw.currentX < maxX) {
    cw.currentX = Math.min(maxX, cw.currentX + (cw.speed || 25) * dt);
  }

  // Ujung runcing gerigi compactor wall (duri gerigi menonjol +12px di depan badan dinding)
  const spikeEdge = cw.currentX + cw.w + 12;

  let crushedPlayer = null;
  for (const p of pArr) {
    if (p.isAmmo || p.hasEntered) continue;

    // Deteksi jika pemain tertabrak atau tersentuh dinding gerigi
    const touchesWallX = p.x < spikeEdge && (p.x + p.w) > cw.currentX;
    if (touchesWallX) {
      crushedPlayer = p;
      break;
    }
  }

  if (crushedPlayer) {
    console.log(`[!] Level 18: ${crushedPlayer.name} tertabrak dinding gerigi! Reset & ulang level.`);
    io.emit('playerVaporized', { 
      id: crushedPlayer.id, 
      name: crushedPlayer.name,
      reason: `💥 ${crushedPlayer.name} tergilas dinding gerigi! Mengulang level...` 
    });
    io.emit('levelRetryNotification', { 
      by: crushedPlayer.name,
      reason: `💥 ${crushedPlayer.name} tergilas dinding gerigi! Mengulang level...` 
    });
    startLevel();
    return true;
  }
  return false;
}

// ─── Torches (Level 15 & 19 Darkness & Obor) ──────────────────────────────────
function updateTorches(lvl) {
  if (!lvl.activeTorches || lvl.activeTorches.length === 0) return;
  const pArr = Object.values(players);

  lvl.activeTorches.forEach(t => {
    if (t.holderId && players[t.holderId]) {
      const holder = players[t.holderId];
      t.x = holder.x + holder.w / 2;
      t.y = holder.y + holder.h / 2 - 8;
    } else {
      t.holderId = null;
      for (const p of pArr) {
        if (Math.hypot((p.x + p.w / 2) - t.x, (p.y + p.h / 2) - t.y) < 32) {
          t.holderId = p.id;
          break;
        }
      }
    }
  });
}

// ─── Tethers (Level 14 & 19 Tali Kematian) ────────────────────────────────────
function updateTethers(lvl, dt) {
  if (!lvl.hasTether) return;
  const pArr = Object.values(players);
  if (pArr.length < 2) return;

  const maxDist = (lvl.tether && lvl.tether.maxDistance) || 110;
  const stiffness = (lvl.tether && lvl.tether.stiffness) || 350;

  for (let i = 0; i < pArr.length - 1; i++) {
    const p1 = pArr[i];
    const p2 = pArr[i + 1];

    if (p1.hasEntered || p2.hasEntered) continue;

    const dx = (p2.x + p2.w / 2) - (p1.x + p1.w / 2);
    const dy = (p2.y + p2.h / 2) - (p1.y + p1.h / 2);
    const dist = Math.hypot(dx, dy);

    if (dist > maxDist && dist > 0.001) {
      const excess = dist - maxDist;
      const nx = dx / dist;
      const ny = dy / dist;

      // 1. Enforce Position Constraint (Tali tidak boleh melar melebihi batas)
      let w1 = 0.5, w2 = 0.5;
      if (p1.onGround && !p2.onGround) {
        w1 = 0.08;
        w2 = 0.92;
      } else if (!p1.onGround && p2.onGround) {
        w1 = 0.92;
        w2 = 0.08;
      }

      // Koreksi posisi langsung (Position-Based Dynamics)
      p1.x += nx * excess * w1;
      p1.y += ny * excess * w1;
      p2.x -= nx * excess * w2;
      p2.y -= ny * excess * w2;

      p1.x = Math.max(0, Math.min(lvl.worldW - p1.w, p1.x));
      p2.x = Math.max(0, Math.min(lvl.worldW - p2.w, p2.x));

      // 2. Koreksi Kecepatan: Hentikan gerak yang saling menjauh saat tali tegang
      const relVx = p2.vx - p1.vx;
      const relVy = p2.vy - p1.vy;
      const separatingSpeed = relVx * nx + relVy * ny;
      if (separatingSpeed > 0) {
        p1.vx += nx * separatingSpeed * w1;
        p1.vy += ny * separatingSpeed * w1;
        p2.vx -= nx * separatingSpeed * w2;
        p2.vy -= ny * separatingSpeed * w2;
      }

      // 3. Tarikan jurang maut: jika rekan jatuh, seret pemain pasangannya ke bawah!
      if (p1.vy > 200 || p1.y > lvl.worldH - 70) {
        p2.vy += Math.max(180, p1.vy * 0.8) * dt * 4;
        p2.vx += nx * 220 * dt;
        p2.onGround = false;
      } else if (p2.vy > 200 || p2.y > lvl.worldH - 70) {
        p1.vy += Math.max(180, p2.vy * 0.8) * dt * 4;
        p1.vx -= nx * 220 * dt;
        p1.onGround = false;
      }
    }
  }
}

// ─── Shared Viewport Camera & Screen Constraint (Pico Park Style) ────────────
function updateCameraAndConstraints(lvl) {
  const pArr = Object.values(players);
  if (pArr.length === 0) return;

  // Hanya pemain aktif yang belum masuk ke dalam pintu
  const activeP = pArr.filter(p => !p.hasEntered);
  const targetP = activeP.length > 0 ? activeP : pArr;

  // Di Level 11 (The Great Divide) atau level tanpa batas layar
  if (lvl.id === 11 || lvl.noScreenClamp) {
    const launched = targetP.find(p => p.isLaunched || p.vx > 300);
    let targetX = 0;
    if (launched) {
      targetX = launched.x - VIEW_W / 2;
    } else if (lvl.activeSlingshot && (lvl.activeSlingshot.ammoId || lvl.activeSlingshot.isPulling)) {
      targetX = 0;
    } else {
      const minX = Math.min(...targetP.map(p => p.x));
      const maxX = Math.max(...targetP.map(p => p.x + p.w));
      targetX = ((minX + maxX) / 2) - VIEW_W / 2;
    }
    targetX = Math.max(0, Math.min(lvl.worldW - VIEW_W, targetX));
    if (lvl.camX === undefined) lvl.camX = targetX;
    else lvl.camX += (targetX - lvl.camX) * 0.14;
    return;
  }

  const minX = Math.min(...targetP.map(p => p.x));
  const maxX = Math.max(...targetP.map(p => p.x + p.w));

  // Pusatkan kamera pada rata-rata posisi seluruh pemain aktif
  const teamCenter = (minX + maxX) / 2;
  let targetCamX = teamCenter - VIEW_W / 2;
  targetCamX = Math.max(0, Math.min(lvl.worldW - VIEW_W, targetCamX));

  if (lvl.camX === undefined) {
    lvl.camX = targetCamX;
  } else {
    // Interpolasi kamera halus
    lvl.camX += (targetCamX - lvl.camX) * 0.12;
  }

  // ⚠️ SCREEN CONSTRAINT: Tidak ada pemain aktif yang boleh keluar dari batas layar!
  const leftEdge  = lvl.camX;
  const rightEdge = lvl.camX + VIEW_W;

  activeP.forEach(p => {
    if (p.x < leftEdge) {
      p.x = leftEdge;
      if (p.vx < 0) p.vx = 0;
    }
    if (p.x + p.w > rightEdge) {
      p.x = rightEdge - p.w;
      if (p.vx > 0) p.vx = 0;
    }
  });
}

// ─── Physics Tick ────────────────────────────────────────────────────────────
let lastTick = Date.now();

function physicsTick() {
  if (gameState !== 'playing') return;
  const now = Date.now();
  const dt  = Math.min((now - lastTick) / 1000, 0.05); // cap at 50ms
  lastTick  = now;
  const lvl = getLevel();

  // 1. Simpan posisi sebelumnya & update gerak pemain (Input + Gravitasi + Ubin)
  Object.values(players).forEach(p => {
    p.prevX = p.x;
    p.prevY = p.y;
    p.deltaX = 0;

    if (p.hasEntered) {
      // Pemain sudah masuk ke dalam pintu keluar!
      p.vx = 0;
      p.vy = 0;
      return;
    }

    if (p.isAmmo) {
      // Pemain terkunci di kantong ketapel manusia
      return;
    }

    if (p.isLaunched) {
      // 🚀 SEDANG TERBANG DARI LONTARAN KETAPEL (BALLISTIC PARABOLA)
      // Pertahankan kecepatan horizontal (vx) di udara!
      if (p.keys.left)       { p.vx = Math.max(-2200, p.vx - dt * 300); p.facing = -1; }
      else if (p.keys.right) { p.vx = Math.min(2200, p.vx + dt * 300); p.facing = 1; }

      // Jika mendarat di tanah/platform, selesaikan status terbang
      if (p.onGround) {
        p.isLaunched = false;
      }
    } else {
      // Gerakan berjalan normal
      if (p.keys.left)       { p.vx = -PLAYER_SPEED; p.facing = -1; }
      else if (p.keys.right) { p.vx =  PLAYER_SPEED; p.facing =  1; }
      else                   { p.vx = 0; }
    }

    // Gravitasi level dinamis (e.g. Gravitasi Bulan)
    const baseGrav = lvl.gravity !== undefined ? lvl.gravity : GRAVITY;
    const baseJump = lvl.jumpVelocity !== undefined ? lvl.jumpVelocity : JUMP_VELOCITY;

    // Deteksi apakah pemain berada di dalam Medan Gravitasi Terbalik
    const inInvZone = (lvl.activeGravityZones || []).some(z =>
      p.x + p.w > z.x && p.x < z.x + z.w &&
      p.y + p.h > z.y && p.y < z.y + z.h
    );
    p.gravityDir = inInvZone ? -1 : 1;
    p.isInverted = p.gravityDir === -1;

    if (p.keys.up && p.onGround) {
      // Lompat: jika gravitasi normal loncat ke atas (-), jika gravitasi terbalik loncat ke bawah (+)
      p.vy = p.gravityDir === -1 ? Math.abs(baseJump) : -Math.abs(baseJump);
      p.onGround = false;
      p.standingOnId = null;
    }

    p.vy += baseGrav * p.gravityDir * dt;

    const res = resolveAABBVsTiles(lvl, p.x, p.y, p.vx, p.vy, p.w, p.h, dt, p.gravityDir);
    p.x = res.x; p.y = res.y; p.vx = res.vx; p.vy = res.vy; p.onGround = res.onGround;

    // Jika mendarat di tanah atau menabrak dinding
    if (p.isLaunched && res.onGround) {
      p.isLaunched = false;
    }

    p.deltaX = p.x - p.prevX;
  });

  // 2. Update Dynamic Heavy Boxes (DDS)
  updateBoxes(lvl, dt);

  // 3. Update Dynamic Buttons & Bridges (DDS)
  updateButtonsAndBridges(lvl, dt);

  // 4. Update Dynamic Gates (Anti-Strand Gate Barriers)
  updateGates(lvl);

  // 5. Update Lasers (Hazard Level 5)
  if (updateLasers(lvl)) {
    return;
  }

  // 6. Update Springboards (Bantalan Lompat Level 4 & 5)
  updateSpringboards(lvl);

  // 6b. Update Slingshot (Ketapel Manusia Co-op - Level 11)
  updateSlingshot(lvl, dt);

  // 6c. Update Moving Platforms (Feri Bergerak - Level 8)
  updateMovingPlatforms(lvl, dt);

  // 6d. Update Seesaws (Timbangan - Level 12)
  updateSeesaws(lvl, dt);

  // 6e. Update Generator Wheels (Roda Hamster - Level 16 & 20)
  updateGeneratorWheels(lvl, dt);

  // 6f. Update Invisible Platforms (Lantai Ilusi - Level 17 & 20)
  updateInvisiblePlatforms(lvl);

  // 6g. Update Compactor Wall (Dinding Bergeser - Level 18)
  if (updateCompactorWall(lvl, dt)) {
    return;
  }

  // 6h. Update Torches (Darkness & Obor - Level 15 & 19)
  updateTorches(lvl);

  // 6i. Update Tethers (Tali Kematian - Level 14 & 19)
  updateTethers(lvl, dt);

  // 7. Tabrakan antar pemain (Bebas Lengket & Tumpuk Solid)
  resolvePlayerCollisions(lvl);

  // 8. Update Kamera Bersama & Batas Layar Tetap (Shared Viewport Constraint)
  updateCameraAndConstraints(lvl);

  // 9. Jurang / Pit Fall (Pico Park Style: 1 pemain jatuh = reset ulang level dari awal!)
  let fallenPlayer = null;
  for (const p of Object.values(players)) {
    if (p.hasEntered) continue;
    if (p.y > lvl.worldH - 24 || p.y + p.h >= lvl.worldH + 8) {
      fallenPlayer = p;
      break;
    }
  }

  if (fallenPlayer) {
    console.log(`[!] Pit fall: ${fallenPlayer.name} jatuh ke jurang! Reset level dari awal.`);
    io.emit('playerVaporized', { 
      id: fallenPlayer.id, 
      name: fallenPlayer.name,
      reason: `☠️ ${fallenPlayer.name} jatuh ke jurang! Mengulang level dari awal...` 
    });
    io.emit('levelRetryNotification', { 
      by: fallenPlayer.name,
      reason: `☠️ ${fallenPlayer.name} jatuh ke jurang! Mengulang level dari awal...` 
    });
    startLevel();
    return;
  }

  // 9. Ambil Kunci
  if (!keyCollected) {
    const kx = lvl.key.x, ky = lvl.key.y;
    Object.values(players).forEach(p => {
      if (p.hasEntered) return;
      if (!keyCollected &&
          p.x < kx + 28 && p.x + p.w > kx &&
          p.y < ky + 28 && p.y + p.h > ky) {
        keyCollected = true;
        p.hasKey = true;
        io.emit('keyCollected', { by: p.id });
      }
    });
  }

  // 10. Cek Pintu Keluar – Pemain masuk ke pintu satu per satu tanpa harus menumpuk di depan pintu!
  if (keyCollected) {
    const door = lvl.door;
    const allIds = Object.keys(players);

    allIds.forEach(id => {
      const p = players[id];
      if (!p.hasEntered) {
        const touchesDoor = p.x + p.w > door.x &&
                            p.x       < door.x + lvl.doorW &&
                            p.y + p.h > door.y &&
                            p.y       < door.y + lvl.doorH;
        if (touchesDoor) {
          p.hasEntered = true;
          p.atDoor = true;
          p.vx = 0;
          p.vy = 0;
          p.standingOnId = null;
          p.x = door.x + (lvl.doorW - p.w) / 2;
          p.y = door.y + lvl.doorH - p.h;

          const enteredCount = allIds.filter(pid => players[pid].hasEntered).length;
          io.emit('playerEnteredDoor', {
            id: p.id,
            name: p.name,
            color: p.color,
            colorName: p.colorName,
            enteredCount: enteredCount,
            totalCount: allIds.length
          });
          console.log(`  > [Door] ${p.name} masuk ke pintu (${enteredCount}/${allIds.length})`);
        }
      }
    });

    if (allIds.length > 0 && allIds.every(id => players[id].hasEntered)) {
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

  // 11. Broadcast snapshot ke semua client (termasuk camX, lasers, springboards, shields, hasEntered)
  const snapshot = Object.values(players).map(p => ({
    id        : p.id,
    name      : p.name,
    color     : p.color,
    colorName : p.colorName,
    x         : Math.round(p.x),
    y         : Math.round(p.y),
    onGround  : p.onGround,
    hasKey    : p.hasKey,
    atDoor    : !!p.atDoor,
    hasEntered: !!p.hasEntered,
    facing    : p.facing || (p.vx < 0 ? -1 : 1),
    shieldType: p.shieldType || null,
    isAmmo    : !!p.isAmmo,
    isInverted: !!p.isInverted,
  }));

  io.emit('gameState', {
    players     : snapshot,
    keyCollected,
    gameState,
    level       : lvl,
    camX        : Math.round(lvl.camX || 0),
    boxes       : lvl.activeBoxes || [],
    buttons     : lvl.activeButtons || [],
    bridges     : lvl.activeBridges || [],
    gates       : lvl.activeGates || [],
    lasers      : lvl.activeLasers || [],
    springboards: lvl.activeSpringboards || [],
    slingshot   : lvl.activeSlingshot ? { ...lvl.activeSlingshot } : null,
    movingPlatforms   : lvl.activeMovingPlatforms || [],
    seesaws           : lvl.activeSeesaws || [],
    torches           : lvl.activeTorches || [],
    generatorWheels   : lvl.activeGeneratorWheels || [],
    invisiblePlatforms: lvl.activeInvisiblePlatforms || [],
    compactorWall     : lvl.activeCompactorWall ? { ...lvl.activeCompactorWall } : null,
    gravityZones      : lvl.activeGravityZones || [],
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

  // Reset posisi pemain ke titik spawn & set Shield Co-op jika Level 5
  Object.values(players).forEach((pl, i) => {
    const sp = lvl.spawns[i] || { x: 60, y: 500 };
    pl.x        = sp.x;
    pl.y        = sp.y;
    pl.prevX    = sp.x;
    pl.prevY    = sp.y;
    pl.deltaX   = 0;
    pl.standingOnId = null;
    pl.vx       = 0;
    pl.vy       = 0;
    pl.facing   = 1;
    pl.onGround = false;
    pl.isAmmo   = false;
    pl.isLaunched = false;
    pl.atDoor   = false;
    pl.hasEntered = false;
    pl.hasKey   = false;
    pl.isInverted = false;
    pl.gravityDir = 1;

    // 🛡️ Level 5 Dual-Shield Co-op:
    // Pemain 1: Pelindung Atas Kepala (Top Shield)
    // Pemain 2: Pelindung Depan Badan (Front Shield)
    // Pemain 3-5: Escort (berlindung di payung perlindungan P1 & P2)
    if (lvl.id === 5) {
      if (i === 0)      pl.shieldType = 'top';
      else if (i === 1) pl.shieldType = 'front';
      else              pl.shieldType = null;
    } else {
      pl.shieldType = null;
    }
  });

  io.emit('gameStarted', {
    level      : lvl,
    playerCount: pCount,
    levelIdx   : currentLevelIdx,
    totalLevels: LEVELS.length,
    slingshot  : lvl.activeSlingshot ? { ...lvl.activeSlingshot } : null,
    gravityZones: lvl.activeGravityZones || [],
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

  socket.on('selectLevel', ({ levelIdx, levelId }) => {
    const p = players[socket.id];
    if (!p || !p.isHost) return;
    if (levelId !== undefined) {
      const foundIdx = LEVELS.findIndex(l => l && l.id === levelId);
      if (foundIdx !== -1) currentLevelIdx = foundIdx;
    } else if (typeof levelIdx === 'number' && levelIdx >= 0 && levelIdx < LEVELS.length) {
      currentLevelIdx = levelIdx;
    }
    if (gameState === 'playing' || gameState === 'win') {
      startLevel();
    } else {
      io.emit('levelSelected', {
        levelIdx : currentLevelIdx,
        levelId  : LEVELS[currentLevelIdx].id,
        levelName: LEVELS[currentLevelIdx].name,
      });
    }
  });

  // ── Retry Level saat permainan sedang berlangsung ──────────────────────────
  socket.on('retryLevel', () => {
    const p = players[socket.id];
    if (!p || gameState !== 'playing') return;
    console.log(`  > Level ${currentLevelIdx + 1} retried by ${p.name}`);
    startLevel();
    io.emit('levelRetryNotification', { by: p.name });
  });

  socket.on('input', ({ left, right, up, down }) => {
    const p = players[socket.id];
    if (!p) return;
    p.keys.left  = !!left;
    p.keys.right = !!right;
    p.keys.up    = !!up;
    p.keys.down  = !!down;
  });

  // ── Ketapel Manusia (Angry Birds Mouse Drag & Launch) ──────────────────────
  socket.on('slingshotAim', ({ tension, angle, isPulling }) => {
    const lvl = getLevel();
    if (!lvl || !lvl.activeSlingshot) return;
    const sling = lvl.activeSlingshot;
    if (!sling.ammoId) return;

    sling.isPulling = !!isPulling;
    if (typeof tension === 'number' && !isNaN(tension)) {
      sling.tension = Math.max(0, Math.min(sling.maxTension, tension * sling.maxTension));
    }
    if (typeof angle === 'number' && !isNaN(angle)) {
      sling.angle = Math.max(0.20, Math.min(1.40, angle));
    }
    sling.launcherId = socket.id;
  });

  socket.on('slingshotLaunch', ({ tension, angle }) => {
    const lvl = getLevel();
    if (!lvl || !lvl.activeSlingshot) return;
    const sling = lvl.activeSlingshot;
    const ammoId = sling.ammoId;
    if (!ammoId || !players[ammoId]) return;

    const ammoPlayer = players[ammoId];
    const finalTension = Math.max(0.12, Math.min(1.0, tension || (sling.tension / sling.maxTension)));
    const finalAngle = typeof angle === 'number' ? Math.max(0.20, Math.min(1.40, angle)) : (sling.angle || 0.785);

    // Kecepatan peluru terkalibrasi menyeberang jurang (1320 - 2400 px)
    const speed = 900 + finalTension * 1400;
    const launchVx = speed * Math.cos(finalAngle);
    const launchVy = -speed * Math.sin(finalAngle);

    ammoPlayer.x = sling.pouchX - ammoPlayer.w / 2;
    ammoPlayer.y = sling.pouchY - ammoPlayer.h;
    ammoPlayer.vx = launchVx;
    ammoPlayer.vy = launchVy;
    ammoPlayer.isAmmo = false;
    ammoPlayer.isLaunched = true;
    ammoPlayer.facing = 1;
    ammoPlayer.onGround = false;

    sling.ammoId = null;
    sling.launcherId = null;
    sling.tension = 0;
    sling.isPulling = false;
    sling.cooldown = 0.6;

    io.emit('slingshotFired', { tension: finalTension, angle: finalAngle, vx: launchVx, vy: launchVy });
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
      pl.hasEntered = false;
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
