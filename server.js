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
    active    : btn.isLatch || btn.gateId || btn.laserIndex !== undefined ? true : (idx < reqButtons),
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

  // 9. Slingshot (Ketapel Manusia)
  if (lvl.slingshot) {
    lvl.activeSlingshot = {
      ...lvl.slingshot,
      ammoId    : null,
      launcherId: null,
      tension   : 0,
      isPulling : false,
      cooldown  : 0,
    };
  } else {
    lvl.activeSlingshot = null;
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

      // Jangan tabrakkan jika salah satu pemain sedang menjadi peluru di kantong ketapel
      if (a.isAmmo || b.isAmmo) continue;

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
        if (box.deltaX) p.x += box.deltaX;
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
        break;
      }
    }
  }

  const ammoPlayer = sling.ammoId ? players[sling.ammoId] : null;

  // 3. Jika ada Ammo player di kantong:
  if (ammoPlayer) {
    ammoPlayer.isAmmo = true;
    ammoPlayer.onGround = false;

    // Rekan di belakang (State 'Launcher'):
    let activeLauncher = null;
    for (const p of pArr) {
      if (p.id === ammoPlayer.id) continue;
      const isBehind = p.x <= sling.x + 20 && p.x >= sling.x - 140 &&
                       Math.abs(p.y - ammoPlayer.y) < 60;
      if (isBehind) {
        activeLauncher = p;
        break;
      }
    }

    if (activeLauncher) {
      sling.launcherId = activeLauncher.id;

      // Pemain B menekan dan menahan tombol mundur (kiri [A / ←]) untuk menarik ketapel
      if (activeLauncher.keys.left) {
        sling.isPulling = true;
        sling.tension = Math.min(sling.maxTension, sling.tension + dt);
      } else if (sling.isPulling) {
        // 🚀 SAAT DILEPAS: PARABOLIC LAUNCH!
        const tensionRatio = Math.max(0.12, sling.tension / sling.maxTension);

        // Formula parabola terkalibrasi:
        // vx = 800 + T * 1050 (px/s ke kanan)
        // vy = -(750 + T * 500) (px/s ke atas, lalu melengkung oleh gravitasi 1800 px/s²)
        const launchVx = 800 + tensionRatio * 1050;
        const launchVy = -(750 + tensionRatio * 500);

        ammoPlayer.vx = launchVx;
        ammoPlayer.vy = launchVy;
        ammoPlayer.isAmmo = false;
        ammoPlayer.facing = 1;
        ammoPlayer.onGround = false;

        sling.ammoId = null;
        sling.launcherId = null;
        sling.tension = 0;
        sling.isPulling = false;
        sling.cooldown = 0.6;

        io.emit('slingshotFired', { tension: tensionRatio, vx: launchVx, vy: launchVy });
      } else {
        sling.tension = Math.max(0, sling.tension - dt * 2);
      }
    } else {
      // Tidak ada launcher di belakang
      sling.launcherId = null;
      sling.isPulling = false;
      sling.tension = Math.max(0, sling.tension - dt * 2);

      // Jika ammo menekan tombol lompat (W / Space / Up), izinkan keluar dari kantong
      if (ammoPlayer.keys.up && sling.tension === 0) {
        ammoPlayer.vy = -450;
        ammoPlayer.isAmmo = false;
        sling.ammoId = null;
        sling.cooldown = 0.5;
      }
    }

    // Kunci posisi ammo di kantong (tertarik mundur sesuai tension)
    if (sling.ammoId === ammoPlayer.id) {
      const stretchOffset = (sling.tension / sling.maxTension) * 44;
      ammoPlayer.x = sling.pouchX - ammoPlayer.w / 2 - stretchOffset;
      ammoPlayer.y = sling.pouchY - ammoPlayer.h;
      ammoPlayer.vx = 0;
      ammoPlayer.vy = 0;
    }
  } else {
    sling.tension = 0;
    sling.isPulling = false;
    sling.launcherId = null;
  }
}

// ─── Shared Viewport Camera & Screen Constraint (Pico Park Style) ────────────
function updateCameraAndConstraints(lvl) {
  const pArr = Object.values(players);
  if (pArr.length === 0) return;

  // Di Level 11 (The Great Divide), pemain dilontarkan menyeberang jurang jauh (1320 px).
  // Kamera fokus mengikuti kawan yang dilontarkan atau pusat tim tanpa mengunci batas tepi layar!
  if (lvl.id === 11) {
    const launched = pArr.find(p => p.vx > 300);
    let targetX = 0;
    if (launched) {
      targetX = launched.x - VIEW_W / 2;
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

  // 1. Update pergerakan pemain (Input + Gravitasi + Ubin)
  Object.values(players).forEach(p => {
    if (p.isAmmo) {
      // Pemain terkunci di kantong ketapel manusia
      return;
    }
    if (p.keys.left)       { p.vx = -PLAYER_SPEED; p.facing = -1; }
    else if (p.keys.right) { p.vx =  PLAYER_SPEED; p.facing =  1; }
    else                   { p.vx = 0; }

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

  // 6b. Update Slingshot (Ketapel Manusia Co-op - Level 11)
  updateSlingshot(lvl, dt);

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
      p.isAmmo = false;
      if (lvl.activeSlingshot && lvl.activeSlingshot.ammoId === p.id) {
        lvl.activeSlingshot.ammoId = null;
        lvl.activeSlingshot.tension = 0;
        lvl.activeSlingshot.isPulling = false;
      }
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
    pl.vx       = 0;
    pl.vy       = 0;
    pl.facing   = 1;
    pl.onGround = false;
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
