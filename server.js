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
    id        : btn.id,
    x         : btn.x,
    y         : btn.y,
    w         : btn.w,
    h         : btn.h,
    index     : btn.index !== undefined ? btn.index : idx,
    group     : btn.group,
    isLatch   : !!btn.isLatch,
    gateId    : btn.gateId,
    label     : btn.label,
    laserIndex: btn.laserIndex,
    active    : btn.isLatch || btn.gateId ? true : (idx < reqButtons),
    pressed   : false,
    latched   : false,
  }));

  // 3. Dynamic Bridges (Bridge DDS)
  lvl.activeBridges = (lvl.bridges || []).map(brg => ({
    id     : brg.id,
    x      : brg.x,
    y      : brg.y,
    w      : brg.w,
    h      : brg.h,
    group  : brg.group,
    active : false,
    latched: false,
  }));

  // 4. Dynamic Lasers (Laser Grid DDS: lapis laser = playerCount - 1)
  const reqLasers = Math.max(1, pCount - 1);
  lvl.activeLasers = (lvl.lasers || []).map((l, idx) => ({
    id    : l.id,
    x     : l.x,
    y     : l.y,
    w     : l.w,
    h     : l.h,
    index : l.index !== undefined ? l.index : idx,
    active: idx < reqLasers,
  }));

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
      // Jika menaiki kotak, bawa pemain ikut bergeser bersama kotak
      const onTop = p.x + p.w > box.x &&
                    p.x < box.x + box.w &&
                    Math.abs((p.y + p.h) - box.y) <= 8;
      if (onTop && box.deltaX) {
        p.x += box.deltaX;
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

// ─── Dynamic Lasers Physics (Level 5 Hazard DDS) ─────────────────────────────
function updateLasers(lvl) {
  if (!lvl.activeLasers || lvl.activeLasers.length === 0) return;
  const pArr = Object.values(players);

  lvl.activeLasers.forEach(laser => {
    // Laser mati jika tombol kontrolnya ditekan ATAU kunci sudah berhasil diambil
    const matchingBtn = (lvl.activeButtons || []).find(b => b.laserIndex === laser.index);
    const isBtnPressed = matchingBtn ? matchingBtn.pressed : false;

    laser.isBlocked = isBtnPressed || keyCollected;

    // Jika laser menyala (hazard aktif), periksa tabrakan mematikan dengan pemain
    if (laser.active && !laser.isBlocked) {
      pArr.forEach((p, idx) => {
        const hit = p.x + p.w > laser.x &&
                    p.x       < laser.x + laser.w &&
                    p.y + p.h > laser.y &&
                    p.y       < laser.y + laser.h;
        if (hit) {
          // Pemain terkena laser: respawn di spawn point
          const sp = lvl.spawns[idx] || { x: 60, y: 500 };
          p.x = sp.x;
          p.y = sp.y;
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

// ─── Shared Viewport Camera & Screen Constraint (Pico Park Style) ────────────
function updateCameraAndConstraints(lvl) {
  const pArr = Object.values(players);
  if (pArr.length === 0) return;

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

  // 4. Update Dynamic Gates (Anti-Strand Gate Barriers)
  updateGates(lvl);

  // 5. Update Lasers (Hazard Level 5)
  updateLasers(lvl);

  // 6. Update Springboards (Bantalan Lompat Level 4 & 5)
  updateSpringboards(lvl);

  // 7. Tabrakan antar pemain (Bebas Lengket & Tumpuk Solid)
  resolvePlayerCollisions(lvl);

  // 8. Update Kamera Bersama & Batas Layar Tetap (Shared Viewport Constraint)
  updateCameraAndConstraints(lvl);

  // 9. Jurang / Pit Respawn (jika pemain jatuh ke luar arena)
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

  // 11. Broadcast snapshot ke semua client (termasuk camX, lasers, springboards)
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
    camX        : Math.round(lvl.camX || 0),
    boxes       : lvl.activeBoxes || [],
    buttons     : lvl.activeButtons || [],
    bridges     : lvl.activeBridges || [],
    gates       : lvl.activeGates || [],
    lasers      : lvl.activeLasers || [],
    springboards: lvl.activeSpringboards || [],
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

  // ── Retry Level saat permainan sedang berlangsung ──────────────────────────
  socket.on('retryLevel', () => {
    const p = players[socket.id];
    if (!p || gameState !== 'playing') return;
    console.log(`  > Level ${currentLevelIdx + 1} retried by ${p.name}`);
    startLevel();
    io.emit('levelRetryNotification', { by: p.name });
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
