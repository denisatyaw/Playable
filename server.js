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

  // 2. Vertical vs Tiles
  const colL2 = Math.floor(x          / ts);
  const colR2 = Math.floor((x + pw - 1) / ts);
  const rowT2 = Math.floor(y          / ts);
  const rowB2 = Math.floor((y + ph - 1) / ts);
  for (let c = colL2; c <= colR2; c++) {
    if (vy > 0 && isSolid(lvl, c, rowB2)) { y = rowB2 * ts - ph; vy = 0; onGround = true; break; }
    if (vy < 0 && isSolid(lvl, c, rowT2)) { y = (rowT2 + 1) * ts; vy = 0; break; }
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
  // benar-benar jatuh ke bawah dan memicu respawn ke titik checkpoint aman!

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
      id        : brg.id,
      x         : brg.x,
      y         : brg.y,
      w         : brg.w,
      h         : brg.h,
      group     : brg.group,
      minPlayers: brg.minPlayers,
      active    : initiallyLatched,
      latched   : initiallyLatched,
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
    bounceForce: sb.bounceForce || -880,
    squash     : 0,
  }));

  // 6. Dynamic Gates (Gerbang Terbuka Otomatis via Tombol/Kunci)
  lvl.activeGates = (lvl.gates || []).map(g => ({
    id   : g.id,
    x    : g.x,
    y    : g.y,
    w    : g.w,
    h    : g.h,
    label: g.label || 'GERBANG',
    open : false,
  }));

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

      if (upper.isAmmo || lower.isAmmo) continue;

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

      if (a.isAmmo || b.isAmmo) continue;

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

// ─── Dynamic Heavy Boxes Physics (DDS & Stacking) ────────────────────────────
function updateBoxes(lvl, dt) {
  if (!lvl.activeBoxes || lvl.activeBoxes.length === 0) return;
  const pArr = Object.values(players);

  // 1. Deteksi interaksi pemain terhadap setiap kotak (berdiri di atas & mendorong)
  lvl.activeBoxes.forEach(box => {
    let rightPushers = 0;
    let leftPushers  = 0;

    pArr.forEach(p => {
      // Pemain berdiri di atas kotak
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

      // Deteksi dorongan ke Kanan (pemain di kiri kotak, menekan kanan)
      const onLeft = p.x + p.w >= box.x - 6 &&
                     p.x + p.w <= box.x + 8 &&
                     p.y + p.h > box.y + 6 &&
                     p.y < box.y + box.h - 6;
      if (onLeft && p.keys.right) {
        rightPushers++;
      }

      // Deteksi dorongan ke Kiri (pemain di kanan kotak, menekan kiri)
      const onRight = p.x >= box.x + box.w - 8 &&
                      p.x <= box.x + box.w + 6 &&
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
      // 1. Pemain berdiri di atas kotak
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
          if (p.y + p.h > box.y + 8) {
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
function updateButtonsAndBridges(lvl) {
  if (!lvl.activeButtons || lvl.activeButtons.length === 0) return;
  const pArr = Object.values(players);
  const bArr = lvl.activeBoxes || [];

  // Reset status tombol (kecuali jika sudah latched)
  lvl.activeButtons.forEach(btn => {
    btn.pressed = false;
    if (!btn.active) return;

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

    // Jika ini adalah tombol Latch dan terinjak:
    if (btn.isLatch && btn.pressed) {
      btn.latched = true;
      // Kunci jembatan group terkait
      if (lvl.activeBridges && btn.group) {
        lvl.activeBridges.forEach(brg => {
          if (brg.group === btn.group) {
            brg.latched = true;
          }
        });
      }
      // Buka gerbang terkait
      if (lvl.activeGates && btn.gateId) {
        lvl.activeGates.forEach(g => {
          if (g.id === btn.gateId) {
            g.open = true;
          }
        });
      }
    } else if (btn.gateId && (btn.pressed || btn.latched) && lvl.activeGates) {
      lvl.activeGates.forEach(g => {
        if (g.id === btn.gateId) {
          g.open = true;
        }
      });
    }
  });

  // Jika kunci diambil, buka semua gerbang & jembatan selamanya!
  if (keyCollected) {
    if (lvl.activeGates) {
      lvl.activeGates.forEach(g => { g.open = true; });
    }
    if (lvl.activeBridges) {
      lvl.activeBridges.forEach(brg => { brg.latched = true; });
    }
  }

  // Update status Jembatan
  if (lvl.activeBridges) {
    lvl.activeBridges.forEach(brg => {
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
  if (!lvl.activeLasers || lvl.activeLasers.length === 0) return;
  const pArr = Object.values(players);

  lvl.activeLasers.forEach(laser => {
    // 1. Jika Kunci sudah diambil, seluruh laser otomatis mati!
    if (keyCollected) {
      laser.isBlocked = true;
      laser.blockedByShield = false;
      return;
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
      pArr.forEach((p, idx) => {
        // Color Lasers: Collision diabaikan (tembus aman) jika warna pemain SAMA dengan warna laser!
        if (laser.color && p.color && p.color.toLowerCase() === laser.color.toLowerCase()) {
          return;
        }

        // Pemain pembawa perisai depan kebal terhadap laser horizontal
        if (p.shieldType === 'front' && isHorizontal) return;
        // Pemain pembawa perisai atas kebal terhadap laser vertikal
        if (p.shieldType === 'top' && isVertical) return;

        // Escort Co-op: Teammates terlindungi saat berjalan bersama rekan pembawa perisai
        if (isHorizontal) {
          const frontBearer = pArr.find(pl => pl.shieldType === 'front');
          if (frontBearer && Math.abs(p.x - frontBearer.x) < 80 && Math.abs(p.y - frontBearer.y) < 60) return;
        }
        if (isVertical && blockedByShield) {
          const topBearer = pArr.find(pl => pl.shieldType === 'top');
          if (topBearer && Math.abs(p.x - topBearer.x) < 60 && p.y >= topBearer.y - 12) return;
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
          const sp = lvl.spawns[idx] || { x: 60, y: 500 };
          const respawnX = p.lastSafeX !== undefined ? p.lastSafeX : sp.x;
          const respawnY = p.lastSafeY !== undefined ? p.lastSafeY : sp.y;
          p.x = respawnX;
          p.y = respawnY;
          p.prevX = respawnX;
          p.prevY = respawnY;
          p.deltaX = 0;
          p.standingOnId = null;
          p.vx = 0;
          p.vy = 0;
          p.onGround = false;
          io.emit('playerVaporized', { id: p.id, name: p.name });
        }
      });
    }
  });
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
      if (p.isAmmo) return;
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

// ─── Seesaw Physics (Level 12 The Balance) ────────────────────────────────────
function updateSeesaws(lvl, dt) {
  if (!lvl.activeSeesaws || lvl.activeSeesaws.length === 0) return;
  const pArr = Object.values(players);

  lvl.activeSeesaws.forEach(sw => {
    let torque = 0;
    const maxA = sw.maxAngle || 0.32; // ~18.3 derajat
    const curA = sw.angle || 0;
    const halfL = sw.length / 2;

    pArr.forEach(p => {
      if (p.isAmmo) return;
      const px = p.x + p.w / 2;
      const py = p.y + p.h;
      const dx = px - sw.pivotX;

      // Cek apakah pemain berada di atas bentang papan timbangan
      if (Math.abs(dx) <= halfL + 6) {
        const plankY = sw.pivotY + Math.sin(curA) * dx;
        if (py >= plankY - 8 && py <= plankY + 16 && p.vy >= 0) {
          p.y = plankY - p.h;
          p.vy = 0;
          p.onGround = true;

          // Torsi: jarak dari poros * massa
          torque += dx * 1.6;

          // Efek Merosot (Slide) jika kemiringan curam (> 9.5 derajat = 0.165 rad)
          if (Math.abs(curA) > 0.165) {
            const slideForce = Math.sin(curA) * 360;
            p.vx += slideForce * dt;
          }
        }
      }
    });

    // Fisika rotasi dengan inersia dan peredaman (damping)
    const angularAcc = torque * 0.00045 - (sw.angularVel || 0) * 4.0;
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

    if (runners >= req) {
      gw.power = Math.min(100, (gw.power || 0) + (40 * (runners / req)) * dt);
      gw.rotation = ((gw.rotation || 0) + 4.0 * dt) % (Math.PI * 2);
    } else if (runners > 0) {
      gw.power = Math.min(100, (gw.power || 0) + (20 * (runners / req)) * dt);
      gw.rotation = ((gw.rotation || 0) + 2.0 * dt) % (Math.PI * 2);
    } else {
      gw.power = Math.max(0, (gw.power || 0) - 12 * dt);
    }

    // Aktifkan jembatan / elevator yang terhubung
    if (gw.targetType === 'bridge' && lvl.activeBridges) {
      const brg = lvl.activeBridges.find(b => b.id === gw.targetId);
      if (brg) {
        brg.active = gw.power >= 25 || keyCollected;
      }
    }
    if (gw.targetType === 'elevator' && lvl.activeMovingPlatforms) {
      const elev = lvl.activeMovingPlatforms.find(m => m.id === gw.targetId);
      if (elev && elev.minY !== undefined && elev.maxY !== undefined) {
        const ratio = (gw.power || 0) / 100;
        elev.y = elev.maxY - (elev.maxY - elev.minY) * ratio;

        // Bawa pemain yang berdiri di atas elevator naik/turun bersama elevator
        pArr.forEach(p => {
          if (p.isAmmo) return;
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
      if (gen && gen.power > 15) {
        revealed = true;
      }
    }
    if (keyCollected) revealed = true;
    ip.isRevealed = revealed;
  });
}

// ─── Compactor Wall (Level 18 Panic Room) ─────────────────────────────────────
function updateCompactorWall(lvl, dt) {
  if (!lvl.activeCompactorWall) return;
  const cw = lvl.activeCompactorWall;
  if (!cw.active) return;
  const pArr = Object.values(players);

  cw.currentX += (cw.speed || 25) * dt;

  pArr.forEach((p, idx) => {
    if (p.isAmmo) return;
    const cwRight = cw.currentX + cw.w;
    if (p.x < cwRight && p.x + p.w > cw.currentX) {
      p.x = cwRight;
      p.vx = Math.max(p.vx, cw.speed || 25);

      const tileCol = Math.floor((p.x + p.w + 2) / lvl.tileSize);
      const tileRow = Math.floor((p.y + p.h / 2) / lvl.tileSize);
      const isSolidAhead = lvl.tiles[tileRow] && lvl.tiles[tileRow][tileCol] === '1';

      if (isSolidAhead || p.x + p.w >= lvl.worldW) {
        const sp = lvl.spawns[idx] || { x: 60, y: 500 };
        const safeX = Math.max(sp.x, cw.currentX + cw.w + 16);
        p.x = safeX;
        p.y = sp.y;
        p.prevX = safeX;
        p.prevY = sp.y;
        p.vx = 0;
        p.vy = 0;
        p.onGround = false;
        io.emit('playerVaporized', { id: p.id, name: p.name });
      }
    }
  });
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

  const maxDist = (lvl.tether && lvl.tether.maxDistance) || 165;
  const stiffness = (lvl.tether && lvl.tether.stiffness) || 280;

  for (let i = 0; i < pArr.length - 1; i++) {
    const p1 = pArr[i];
    const p2 = pArr[i + 1];

    const dx = (p2.x + p2.w / 2) - (p1.x + p1.w / 2);
    const dy = (p2.y + p2.h / 2) - (p1.y + p1.h / 2);
    const dist = Math.hypot(dx, dy);

    if (dist > maxDist && dist > 0.001) {
      const stretch = dist - maxDist;
      const nx = dx / dist;
      const ny = dy / dist;

      const force = stretch * stiffness;
      p1.vx += nx * force * dt;
      p1.vy += ny * force * dt;
      p2.vx -= nx * force * dt;
      p2.vy -= ny * force * dt;

      // Tarikan jurang maut: jika rekan jatuh, seret pemain pasangannya ke bawah!
      if (p1.vy > 250 || p1.y > 540) {
        p2.vy += Math.max(120, p1.vy * 0.75) * dt * 4;
        p2.vx += nx * 140 * dt;
        p2.onGround = false;
      } else if (p2.vy > 250 || p2.y > 540) {
        p1.vy += Math.max(120, p2.vy * 0.75) * dt * 4;
        p1.vx -= nx * 140 * dt;
        p1.onGround = false;
      }
    }
  }
}

// ─── Shared Viewport Camera & Screen Constraint (Pico Park Style) ────────────
function updateCameraAndConstraints(lvl) {
  const pArr = Object.values(players);
  if (pArr.length === 0) return;

  // Di Level 11 (The Great Divide) atau level tanpa batas layar
  if (lvl.id === 11 || lvl.noScreenClamp) {
    const launched = pArr.find(p => p.isLaunched || p.vx > 300);
    let targetX = 0;
    if (launched) {
      targetX = launched.x - VIEW_W / 2;
    } else if (lvl.activeSlingshot && (lvl.activeSlingshot.ammoId || lvl.activeSlingshot.isPulling)) {
      targetX = 0;
    } else {
      const minX = Math.min(...pArr.map(p => p.x));
      const maxX = Math.max(...pArr.map(p => p.x + p.w));
      targetX = ((minX + maxX) / 2) - VIEW_W / 2;
    }
    targetX = Math.max(0, Math.min(lvl.worldW - VIEW_W, targetX));
    if (lvl.camX === undefined) lvl.camX = targetX;
    else lvl.camX += (targetX - lvl.camX) * 0.14;
    return;
  }

  const minX = Math.min(...pArr.map(p => p.x));
  const maxX = Math.max(...pArr.map(p => p.x + p.w));

  // Pusatkan kamera pada rata-rata posisi seluruh tim
  const teamCenter = (minX + maxX) / 2;
  let targetCamX = teamCenter - VIEW_W / 2;
  targetCamX = Math.max(0, Math.min(lvl.worldW - VIEW_W, targetCamX));

  if (lvl.camX === undefined) {
    lvl.camX = targetCamX;
  } else {
    // Interpolasi kamera halus
    lvl.camX += (targetCamX - lvl.camX) * 0.12;
  }

  // ⚠️ SCREEN CONSTRAINT: Tidak ada pemain yang boleh keluar dari batas layar!
  // Pemain di tepi kanan akan terhalang sampai kawan di belakang maju.
  // Pemain di tepi kiri akan didorong maju oleh batas kamera.
  const leftEdge  = lvl.camX;
  const rightEdge = lvl.camX + VIEW_W;

  pArr.forEach(p => {
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

    if (p.keys.up && p.onGround) {
      p.vy = JUMP_VELOCITY;
      p.onGround = false;
      p.standingOnId = null;
    }

    p.vy += GRAVITY * dt;

    const res = resolveAABBVsTiles(lvl, p.x, p.y, p.vx, p.vy, p.w, p.h, dt);
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
  updateButtonsAndBridges(lvl);

  // 4. Update Dynamic Gates (Anti-Strand Gate Barriers)
  updateGates(lvl);

  // 5. Update Lasers (Hazard Level 5)
  updateLasers(lvl);

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
  updateCompactorWall(lvl, dt);

  // 6h. Update Torches (Darkness & Obor - Level 15 & 19)
  updateTorches(lvl);

  // 6i. Update Tethers (Tali Kematian - Level 14 & 19)
  updateTethers(lvl, dt);

  // 7. Tabrakan antar pemain (Bebas Lengket & Tumpuk Solid)
  resolvePlayerCollisions(lvl);

  // 8. Update Kamera Bersama & Batas Layar Tetap (Shared Viewport Constraint)
  updateCameraAndConstraints(lvl);

  // Simpan checkpoint pijakan aman saat pemain berdiri di tanah solid
  Object.values(players).forEach(p => {
    if (p.onGround && p.y < lvl.worldH - 60 && !p.isAmmo) {
      const tileCol = Math.floor((p.x + p.w / 2) / lvl.tileSize);
      const tileRow = Math.floor((p.y + p.h + 2) / lvl.tileSize);
      if (lvl.tiles[tileRow] && lvl.tiles[tileRow][tileCol] === '1') {
        p.lastSafeX = p.x;
        p.lastSafeY = p.y;
      }
    }
  });

  // 9. Jurang / Pit Respawn (jika pemain jatuh ke luar arena maut di semua level)
  Object.values(players).forEach((p, idx) => {
    if (p.y > lvl.worldH - 24 || p.y + p.h >= lvl.worldH + 8) {
      const sp = lvl.spawns[idx] || { x: 60, y: 500 };
      const respawnX = p.lastSafeX !== undefined ? p.lastSafeX : sp.x;
      const respawnY = p.lastSafeY !== undefined ? p.lastSafeY : sp.y;

      p.x = respawnX;
      p.y = respawnY;
      p.prevX = respawnX;
      p.prevY = respawnY;
      p.deltaX = 0;
      p.standingOnId = null;
      p.vx = 0;
      p.vy = 0;
      p.onGround = false;
      p.isAmmo = false;
      p.isLaunched = false;

      if (lvl.activeSlingshot && lvl.activeSlingshot.ammoId === p.id) {
        lvl.activeSlingshot.ammoId = null;
        lvl.activeSlingshot.tension = 0;
        lvl.activeSlingshot.isPulling = false;
      }

      io.emit('playerVaporized', { id: p.id, name: p.name });
    }
  });

  // 9. Ambil Kunci
  if (!keyCollected) {
    const kx = lvl.key.x, ky = lvl.key.y;
    Object.values(players).forEach(p => {
      if (!keyCollected &&
          p.x < kx + 28 && p.x + p.w > kx &&
          p.y < ky + 28 && p.y + p.h > ky) {
        keyCollected = true;
        p.hasKey = true;
        io.emit('keyCollected', { by: p.id });
      }
    });
  }

  // 10. Cek Pintu Keluar – semua pemain yang terhubung harus berada di pintu bersamaan
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

  // 11. Broadcast snapshot ke semua client (termasuk camX, lasers, springboards, shields)
  const snapshot = Object.values(players).map(p => ({
    id        : p.id,
    name      : p.name,
    color     : p.color,
    colorName : p.colorName,
    x         : Math.round(p.x),
    y         : Math.round(p.y),
    onGround  : p.onGround,
    hasKey    : p.hasKey,
    atDoor    : p.atDoor,
    facing    : p.facing || (p.vx < 0 ? -1 : 1),
    shieldType: p.shieldType || null,
    isAmmo    : !!p.isAmmo,
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
    pl.lastSafeX = sp.x;
    pl.lastSafeY = sp.y;
    pl.deltaX   = 0;
    pl.standingOnId = null;
    pl.vx       = 0;
    pl.vy       = 0;
    pl.facing   = 1;
    pl.onGround = false;
    pl.isAmmo   = false;
    pl.isLaunched = false;
    pl.atDoor   = false;
    pl.hasKey   = false;

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
    if (gameState === 'playing') {
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
