'use strict';

/**
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║          LEVEL LOGIC VALIDATOR & ANALYZER – BoxBuds Co-op Engine           ║
 * ║  Checks every level for:                                                   ║
 * ║    1. Structural integrity (tile dimensions, spawn positions, key/door)    ║
 * ║    2. Jump physics feasibility (gaps, heights)                             ║
 * ║    3. Obstacle-to-endpoint reachability                                    ║
 * ║    4. Button ↔ Bridge / Gate / Laser linkage correctness                  ║
 * ║    5. Dynamic difficulty scaling sanity (DDS)                              ║
 * ║    6. Special mechanics integrity (Seesaw, Tether, Darkness, etc.)        ║
 * ║    7. Overall difficulty curve across levels                               ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * Usage:
 *   node tools/level-validator.js           → validate all levels
 *   node tools/level-validator.js 12        → validate only level 12
 *   node tools/level-validator.js 12 15     → validate levels 12 to 15
 *   node tools/level-validator.js --verbose → show all checks (pass + fail)
 */

const path = require('path');
const LEVELS = require('../levels');

// ─── Physics Constants (must match server.js) ─────────────────────────────────
const PLAYER_W        = 36;
const PLAYER_H        = 36;
const PLAYER_SPEED    = 220;   // px/s
const JUMP_VELOCITY   = -520;  // px/s (negative = up)
const GRAVITY         = 1600;  // px/s²
const TILE_SIZE       = 40;

// Derived physics ceilings
const JUMP_HEIGHT_MAX = Math.abs(JUMP_VELOCITY * JUMP_VELOCITY / (2 * GRAVITY)); // ≈84px
const AIR_TIME        = Math.abs(JUMP_VELOCITY * 2 / GRAVITY);                   // ≈0.65s
const JUMP_RANGE_MAX  = PLAYER_SPEED * AIR_TIME;                                  // ≈143px
// Allow slight margin for running start + player width overlap
const GAP_SAFE        = JUMP_RANGE_MAX + PLAYER_W;   // ≈179px
const GAP_WARN        = GAP_SAFE * 1.15;              // ≈206px (warning zone)
const HEIGHT_SAFE     = JUMP_HEIGHT_MAX - 4;          // ≈80px (1 tile = 40px)
const HEIGHT_WARN     = HEIGHT_SAFE * 1.1;            // ≈88px

// ─── ANSI Color Codes ─────────────────────────────────────────────────────────
const C = {
  reset  : '\x1b[0m',
  bold   : '\x1b[1m',
  dim    : '\x1b[2m',
  red    : '\x1b[31m',
  green  : '\x1b[32m',
  yellow : '\x1b[33m',
  blue   : '\x1b[34m',
  magenta: '\x1b[35m',
  cyan   : '\x1b[36m',
  white  : '\x1b[37m',
  bgRed  : '\x1b[41m',
  bgGreen: '\x1b[42m',
};

// ─── Result Accumulator ───────────────────────────────────────────────────────
let totalErrors   = 0;
let totalWarnings = 0;
let totalPasses   = 0;

class LevelReport {
  constructor(lvl) {
    this.lvl    = lvl;
    this.errors = [];
    this.warns  = [];
    this.passes = [];
  }

  error(msg) { this.errors.push(msg); }
  warn(msg)  { this.warns.push(msg); }
  pass(msg)  { this.passes.push(msg); }

  print(verbose) {
    const hasIssues = this.errors.length > 0 || this.warns.length > 0;
    const statusIcon = this.errors.length > 0 ? `${C.red}✖` : this.warns.length > 0 ? `${C.yellow}⚠` : `${C.green}✔`;

    console.log(`\n${statusIcon}${C.reset} ${C.bold}Level ${this.lvl.id} – ${this.lvl.name}${C.reset}`);
    console.log(`${C.dim}   World: ${this.lvl.worldW}×${this.lvl.worldH}px | Tiles: ${this.lvl.tiles[0].length}c×${this.lvl.tiles.length}r${C.reset}`);

    if (this.errors.length > 0) {
      this.errors.forEach(e => console.log(`   ${C.red}[ERROR]${C.reset} ${e}`));
    }
    if (this.warns.length > 0) {
      this.warns.forEach(w => console.log(`   ${C.yellow}[WARN] ${C.reset} ${w}`));
    }
    if (verbose && this.passes.length > 0) {
      this.passes.forEach(p => console.log(`   ${C.green}[PASS] ${C.reset} ${C.dim}${p}${C.reset}`));
    }

    if (!hasIssues && !verbose) {
      console.log(`   ${C.green}${C.dim}All checks passed.${C.reset}`);
    }

    totalErrors   += this.errors.length;
    totalWarnings += this.warns.length;
    totalPasses   += this.passes.length;
  }
}

// ─── Helper: get solid tile at world-pixel coords ─────────────────────────────
function isSolid(lvl, col, row) {
  if (row < 0 || row >= lvl.tiles.length) return false;
  const rowStr = lvl.tiles[row];
  if (col < 0 || col >= rowStr.length) return false;
  return rowStr[col] === '1';
}

function isSolidAt(lvl, worldX, worldY) {
  return isSolid(lvl, Math.floor(worldX / lvl.tileSize), Math.floor(worldY / lvl.tileSize));
}

function floorYAt(lvl, worldX) {
  const col = Math.floor(worldX / lvl.tileSize);
  for (let row = 0; row < lvl.tiles.length; row++) {
    if (isSolid(lvl, col, row)) return row * lvl.tileSize;
  }
  return lvl.worldH; // no floor = pit
}

// ─── Helper: find all solid platform spans on a given row ─────────────────────
function platformSpansOnRow(lvl, row) {
  const spans = [];
  let start = -1;
  const len  = lvl.tiles[row] ? lvl.tiles[row].length : 0;
  for (let c = 0; c <= len; c++) {
    const solid = c < len && isSolid(lvl, c, row);
    if (solid && start === -1) start = c;
    if (!solid && start !== -1) {
      spans.push({ col: start, endCol: c - 1, x: start * lvl.tileSize, endX: c * lvl.tileSize });
      start = -1;
    }
  }
  return spans;
}

// ─── Helper: BFS reachability (tile-level, ignoring dynamic entities) ─────────
function bfsReachable(lvl, startX, startY) {
  const ts   = lvl.tileSize;
  const cols = Math.round(lvl.worldW / ts);
  const rows = lvl.tiles.length;

  // Represent state as (tileCol, tileRow)
  const startCol = Math.floor(startX / ts);
  const startRow = Math.min(rows - 2, Math.floor(startY / ts));

  const visited = new Set();
  const queue   = [[startCol, startRow]];
  visited.add(`${startCol},${startRow}`);

  const dirs = [
    // Walk left/right
    [-1, 0], [1, 0],
    // Jump up (1–2 tiles)
    [-1, -1], [0, -1], [1, -1],
    [-1, -2], [0, -2], [1, -2],
    // Drop down
    [-1, 1], [0, 1], [1, 1],
  ];

  while (queue.length > 0) {
    const [c, r] = queue.shift();

    for (const [dc, dr] of dirs) {
      const nc = c + dc;
      const nr = r + dr;
      const key = `${nc},${nr}`;

      if (visited.has(key)) continue;
      if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
      if (isSolid(lvl, nc, nr)) continue; // solid block = wall

      // For upward moves, check jump physics reachability
      if (dr < 0) {
        const heightPx = Math.abs(dr) * ts;
        if (heightPx > HEIGHT_SAFE + 8) continue; // cannot jump that high
      }

      visited.add(key);
      queue.push([nc, nr]);
    }
  }

  return visited;
}

// ─── CHECK SUITE ─────────────────────────────────────────────────────────────

// 1. Structural checks
function checkStructure(lvl, R) {
  const ts           = lvl.tileSize;
  const expectedCols = Math.round(lvl.worldW / ts);
  const expectedRows = 15; // all levels use 15 tile rows

  // 1a. Tile row count
  if (lvl.tiles.length !== expectedRows) {
    R.error(`Tile rows = ${lvl.tiles.length}, expected ${expectedRows}`);
  } else {
    R.pass(`Tile rows = ${expectedRows} ✓`);
  }

  // 1b. Tile column count consistency
  let colMismatch = false;
  lvl.tiles.forEach((row, i) => {
    if (row.length !== expectedCols) {
      R.error(`Row ${i}: length ${row.length}, expected ${expectedCols} cols (worldW=${lvl.worldW} / tileSize=${ts})`);
      colMismatch = true;
    }
  });
  if (!colMismatch) R.pass(`All ${expectedRows} tile rows have correct width (${expectedCols} cols)`);

  // 1c. Floor: at least row 14 must have some solid ground at extremes
  const row14 = lvl.tiles[14] || '';
  const hasLeftFloor  = row14[0] === '1';
  const hasRightFloor = row14[row14.length - 1] === '1';
  if (!hasLeftFloor && !hasRightFloor) {
    R.warn(`Row 14 has no solid tiles at all – players may have no floor`);
  } else {
    R.pass(`Row 14 has solid floor segments`);
  }

  // 1d. Spawns
  if (!lvl.spawns || lvl.spawns.length === 0) {
    R.error('No spawns defined');
  } else {
    lvl.spawns.forEach((sp, i) => {
      if (sp.x < 0 || sp.x > lvl.worldW || sp.y < 0 || sp.y > lvl.worldH) {
        R.error(`Spawn[${i}] (${sp.x},${sp.y}) is out of world bounds`);
      }
      // Spawn should land on or near solid ground
      const col = Math.floor(sp.x / ts);
      const row = Math.floor(sp.y / ts);
      const colAbove = row + 1;
      if (!isSolid(lvl, col, row + 1) && !isSolid(lvl, col, row + 2)) {
        R.warn(`Spawn[${i}] (${sp.x},${sp.y}) – no solid ground directly below within 2 tiles`);
      }
    });
    R.pass(`${lvl.spawns.length} spawns defined`);
  }

  // 1e. Key
  if (!lvl.key) {
    R.error('No key defined');
  } else {
    if (lvl.key.x < 0 || lvl.key.x > lvl.worldW || lvl.key.y < 0 || lvl.key.y > lvl.worldH) {
      R.error(`Key (${lvl.key.x},${lvl.key.y}) is out of world bounds`);
    } else {
      R.pass(`Key at (${lvl.key.x},${lvl.key.y})`);
    }
  }

  // 1f. Door
  if (!lvl.door) {
    R.error('No door defined');
  } else {
    if (lvl.door.x < 0 || lvl.door.x > lvl.worldW || lvl.door.y < 0 || lvl.door.y > lvl.worldH) {
      R.error(`Door (${lvl.door.x},${lvl.door.y}) is out of world bounds`);
    } else {
      R.pass(`Door at (${lvl.door.x},${lvl.door.y})`);
    }
  }

  // 1g. Key must be to the left of (or near) the door (progress direction = right)
  if (lvl.key && lvl.door) {
    if (lvl.key.x > lvl.door.x + 200) {
      R.warn(`Key (x=${lvl.key.x}) is significantly to the right of Door (x=${lvl.door.x}) – verify intended flow`);
    }
  }
}

// 2. Jump physics – scan for gaps and height differences
function checkJumpPhysics(lvl, R) {
  const ts = lvl.tileSize;

  // Determine if the level has mechanics that intentionally bridge wide gaps
  const hasBridgeMechanic = !!(
    lvl.slingshot ||
    (lvl.bridges && lvl.bridges.length > 0) ||
    (lvl.movingPlatforms && lvl.movingPlatforms.length > 0) ||
    (lvl.seesaws  && lvl.seesaws.length  > 0) ||
    (lvl.invisiblePlatforms && lvl.invisiblePlatforms.length > 0) ||
    (lvl.generatorWheels    && lvl.generatorWheels.length    > 0) ||
    (lvl.gravityZones       && lvl.gravityZones.length       > 0)
  );
  const hasSpringboard = (lvl.springboards || []).length > 0;
  const hasGates       = (lvl.gates        || []).length > 0;

  // Find all genuine PIT gaps: gaps in the FLOOR row (row 14) that have no floor below.
  // Other platform rows with gaps are likely intentional design (sunken pits, raised platforms, etc.)
  const floorRow     = 14;
  const floorSpans   = platformSpansOnRow(lvl, floorRow);
  const hasFloorGap  = floorSpans.length > 1;  // row 14 is NOT continuous → real pit exists

  // For rows above the floor: gaps are only flagged if the tile row is a "walkable" platform
  // (i.e., the row has solid tiles AND the row immediately below is NOT solid - making it a floor surface)
  function isWalkablePlatformRow(row) {
    if (row >= 14) return true; // row 14 = main floor
    const hasThisRow  = lvl.tiles[row]  && lvl.tiles[row].includes('1');
    const hasBelowRow = lvl.tiles[row + 1] && lvl.tiles[row + 1].includes('1');
    // "Walkable" = this row has solid tiles that players can stand ON TOP OF
    // = this row has solid but the row above it is open air (so player can reach it)
    const hasAboveRow = row > 0 && lvl.tiles[row - 1] && lvl.tiles[row - 1].includes('1');
    // If the row above is ALSO solid (like a wall section), it's a wall, not a platform
    return hasThisRow;
  }

  // Check row 14 (main floor) gaps — these are always real pits
  for (let i = 0; i < floorSpans.length - 1; i++) {
    const left  = floorSpans[i];
    const right = floorSpans[i + 1];
    const gapPx = (right.col - left.endCol - 1) * ts;

    if (gapPx > GAP_WARN) {
      if (hasBridgeMechanic || hasSpringboard) {
        R.warn(`Floor gap ${gapPx}px (col ${left.endCol}→${right.col}) – exceeds jump max (≈${Math.round(GAP_SAFE)}px). Verify bridge/slingshot/seesaw/invisible-platform covers this gap`);
      } else if (lvl.pitDesignIntentional) {
        R.warn(`Floor gap ${gapPx}px (col ${left.endCol}→${right.col}) – intentional pit design (pitDesignIntentional=true). Verify stepping stones / laser pit floor covers this`);
      } else {
        R.error(`Floor gap ${gapPx}px (col ${left.endCol}→${right.col}) – too wide to jump (max ≈${Math.round(GAP_SAFE)}px) and NO bridge mechanic defined!`);
      }
    } else if (gapPx > GAP_SAFE) {
      R.warn(`Floor gap ${gapPx}px (col ${left.endCol}→${right.col}) – borderline jumpable (max ≈${Math.round(GAP_SAFE)}px)`);
    }
  }

  // Check sub-platform rows ONLY if there IS a floor gap (pit exists)
  // AND if the sub-platform gaps seem like they're ON the main travel path.
  // If row 14 is fully solid, everything above is decoration/obstacle, not pits.
  if (hasFloorGap) {
    for (let row = 11; row <= 13; row++) {
      if (!lvl.tiles[row]) continue;
      const spans = platformSpansOnRow(lvl, row);
      for (let i = 0; i < spans.length - 1; i++) {
        const left  = spans[i];
        const right = spans[i + 1];
        const gapPx = (right.col - left.endCol - 1) * ts;
        // Only flag if this sub-row gap lines up with a floor pit (not just a wall gap)
        const midCol = Math.round((left.endCol + right.col) / 2);
        const floorAtMidCol = floorSpans.some(sp => midCol >= sp.col && midCol <= sp.endCol);
        if (floorAtMidCol) continue; // floor exists underneath this gap → it's a wall, not a pit

        if (gapPx > GAP_WARN) {
          if (hasBridgeMechanic || hasSpringboard) {
            R.warn(`Row ${row}: platform gap ${gapPx}px (col ${left.endCol}→${right.col}) over pit – verify mechanic covers it`);
          } else {
            R.error(`Row ${row}: platform gap ${gapPx}px (col ${left.endCol}→${right.col}) over pit – too wide to jump and no bridge mechanic!`);
          }
        } else if (gapPx > GAP_SAFE) {
          R.warn(`Row ${row}: platform gap ${gapPx}px (col ${left.endCol}→${right.col}) – borderline jumpable (max ≈${Math.round(GAP_SAFE)}px)`);
        }
      }
    }
  }

  // Check vertical height steps for step-ups requiring stacking
  // Only warn if the step is taller than 3 tiles (120px) AND no boost mechanic
  for (let row = 10; row <= 12; row++) {
    if (!lvl.tiles[row]) continue;
    const spans = platformSpansOnRow(lvl, row);
    for (const span of spans) {
      for (let lowerRow = row + 2; lowerRow <= 14; lowerRow++) {
        if (!lvl.tiles[lowerRow]) continue;
        const lowerSpans = platformSpansOnRow(lvl, lowerRow);
        for (const ls of lowerSpans) {
          const overlapStart = Math.max(span.col, ls.col);
          const overlapEnd   = Math.min(span.endCol, ls.endCol);
          if (overlapStart <= overlapEnd) {
            const heightDiff = (lowerRow - row) * ts;
            if (heightDiff > HEIGHT_SAFE * 2 && !hasSpringboard && !lvl.slingshot) {
              R.warn(`Platform at row ${row} is ${heightDiff}px above row ${lowerRow} – step-up requires stacking (max solo jump ≈${Math.round(HEIGHT_SAFE)}px)`);
            }
            break;
          }
        }
      }
    }
  }

  // Also check invisible platforms
  const invPlats = lvl.invisiblePlatforms || [];
  for (const ip of invPlats) {
    if (ip.y < 0 || ip.y > lvl.worldH) {
      R.error(`InvisiblePlatform '${ip.id}': y=${ip.y} out of world bounds`);
    }
    if (ip.w < PLAYER_W) {
      R.warn(`InvisiblePlatform '${ip.id}': width ${ip.w}px is narrower than player (${PLAYER_W}px) – very hard to land on`);
    }
  }

  // Check invisible platform spacing (max jump gap)
  if (invPlats.length > 1) {
    const sorted = [...invPlats].sort((a, b) => a.x - b.x);
    for (let i = 0; i < sorted.length - 1; i++) {
      const left  = sorted[i];
      const right = sorted[i + 1];

      // Check if there is solid ground between left and right platform (e.g. intermediate island)
      const startCol = Math.floor((left.x + left.w) / ts);
      const endCol   = Math.floor(right.x / ts);
      let hasSolidGroundBetween = false;
      for (let c = startCol; c <= endCol; c++) {
        if (isSolid(lvl, c, 14) || isSolid(lvl, c, 13) || isSolid(lvl, c, 12)) {
          hasSolidGroundBetween = true;
          break;
        }
      }
      if (hasSolidGroundBetween) {
        continue; // Solid island/ground separates segments – players walk across island
      }

      const gapPx = right.x - (left.x + left.w);
      if (gapPx > GAP_WARN) {
        R.error(`InvisiblePlatforms '${left.id}'→'${right.id}': gap ${gapPx}px exceeds max jump range ≈${Math.round(GAP_SAFE)}px`);
      } else if (gapPx > GAP_SAFE) {
        R.warn(`InvisiblePlatforms '${left.id}'→'${right.id}': gap ${gapPx}px is borderline (max ≈${Math.round(GAP_SAFE)}px)`);
      }
      // Height difference
      const heightDiff = Math.abs(right.y - left.y);
      if (heightDiff > HEIGHT_WARN) {
        R.warn(`InvisiblePlatforms '${left.id}'→'${right.id}': height diff ${heightDiff}px may be too high to jump`);
      }
    }
  }
}

// 3. BFS Reachability: Can player reach key AND door from spawn?
function checkReachability(lvl, R) {
  if (!lvl.spawns || lvl.spawns.length === 0 || !lvl.key || !lvl.door) return;

  const sp       = lvl.spawns[0];
  const ts       = lvl.tileSize;
  const reached  = bfsReachable(lvl, sp.x, sp.y);

  const keyCol   = Math.floor(lvl.key.x / ts);
  const keyRow   = Math.floor(lvl.key.y / ts);
  const doorCol  = Math.floor(lvl.door.x / ts);
  const doorRow  = Math.floor(lvl.door.y / ts);
  const spawnCol = Math.floor(sp.x / ts);
  const spawnRow = Math.floor(sp.y / ts);

  // Check key reachability
  // Note: BFS ignores dynamic mechanics (slingshot, seesaw, bridges) so flag
  //       "unreachable" only as a warning if the level has special mechanics
  const hasSpecialMechanic = !!(
    lvl.slingshot || lvl.seesaws?.length || lvl.bridges?.length ||
    lvl.invisiblePlatforms?.length || lvl.generatorWheels?.length
  );

  const keyReached  = reached.has(`${keyCol},${keyRow}`) ||
                      reached.has(`${keyCol},${keyRow - 1}`) ||  // 1 tile above
                      reached.has(`${keyCol},${keyRow + 1}`);    // 1 tile below
  const doorReached = reached.has(`${doorCol},${doorRow}`) ||
                      reached.has(`${doorCol},${doorRow - 1}`) ||
                      reached.has(`${doorCol},${doorRow + 1}`);

  if (!keyReached) {
    if (hasSpecialMechanic) {
      R.warn(`Key at (${lvl.key.x},${lvl.key.y}) is NOT tile-reachable from spawn without special mechanics (seesaw/slingshot/bridge). Make sure the mechanic is correctly configured`);
    } else {
      R.error(`Key at (${lvl.key.x},${lvl.key.y}) is NOT reachable from spawn (${sp.x},${sp.y}) via jump/walk! No special mechanic to bridge the gap`);
    }
  } else {
    R.pass(`Key is reachable from spawn (tile BFS)`);
  }

  if (!doorReached) {
    if (hasSpecialMechanic) {
      R.warn(`Door at (${lvl.door.x},${lvl.door.y}) is NOT tile-reachable from spawn without special mechanics`);
    } else {
      R.error(`Door at (${lvl.door.x},${lvl.door.y}) is NOT reachable from spawn! No special mechanic defined`);
    }
  } else {
    R.pass(`Door is reachable from spawn (tile BFS)`);
  }
}

// 4. Button ↔ Obstacle linkage
function checkButtonLinkage(lvl, R) {
  const buttons      = lvl.buttons      || [];
  const bridges      = lvl.bridges      || [];
  const gates        = lvl.gates        || [];
  const lasers       = lvl.lasers       || [];
  const colorLasers  = lvl.colorLasers  || [];
  const allLasers    = [...lasers, ...colorLasers];

  // Check every bridge has at least one button pointing to it
  for (const brg of bridges) {
    if (brg.active && brg.latched) {
      R.pass(`Bridge '${brg.id}' starts active & latched (auto-on)`);
      continue;
    }
    const linked = buttons.some(b => b.group === brg.group);
    if (!linked && brg.group) {
      R.error(`Bridge '${brg.id}' has group ${brg.group} but NO button with matching group – bridge can never be activated!`);
    } else if (linked) {
      R.pass(`Bridge '${brg.id}' linked to button(s) via group ${brg.group}`);
    }
  }

  // Check every gate has a button targeting it
  for (const gate of gates) {
    const linked = buttons.some(b => b.gateId === gate.id);
    if (!linked) {
      R.error(`Gate '${gate.id}' has no button with matching gateId – gate can never be opened!`);
    } else {
      R.pass(`Gate '${gate.id}' linked to a button`);
    }
  }

  // Check laser buttons – laserIndex must match a laser's index or laserIndex
  for (const btn of buttons) {
    if (btn.laserIndex === undefined) continue;
    const matchingLaser = allLasers.find(l => {
      return l.laserIndex === btn.laserIndex || l.index === btn.laserIndex;
    });
    if (!matchingLaser) {
      R.error(`Button '${btn.id}' targets laserIndex=${btn.laserIndex} but no laser has that index – laser can never be deactivated!`);
    } else {
      R.pass(`Button '${btn.id}' correctly targets laser index ${btn.laserIndex}`);
    }
  }

  // Check buttons have valid position (on solid ground or ceiling)
  const ts = lvl.tileSize;
  for (const btn of buttons) {
    if (btn.isCeiling) {
      const col = Math.floor((btn.x + btn.w / 2) / ts);
      const row = Math.floor((btn.y - 4) / ts);
      if (!isSolid(lvl, col, row)) {
        R.warn(`Ceiling button '${btn.id}' at (${btn.x},${btn.y}) – no solid ceiling directly above (col=${col}, row=${row}).`);
      }
      continue;
    }
    const col = Math.floor((btn.x + btn.w / 2) / ts);
    const row = Math.floor((btn.y + btn.h + 4) / ts);
    if (!isSolid(lvl, col, row)) {
      R.warn(`Button '${btn.id}' at (${btn.x},${btn.y}) – no solid ground directly underneath (col=${col}, row=${row}). Player may fall through before pressing it`);
    }
  }

  // Buttons with no effect whatsoever
  for (const btn of buttons) {
    const hasBridge    = btn.group && bridges.some(b => b.group === btn.group);
    const hasGate      = !!btn.gateId;
    const hasLaser     = btn.laserIndex !== undefined;
    const hasInvPlat   = (lvl.invisiblePlatforms || []).some(ip => ip.revealButtonId === btn.id || (ip.revealButtonIds && ip.revealButtonIds.includes(btn.id)));
    if (!hasBridge && !hasGate && !hasLaser && !hasInvPlat) {
      R.warn(`Button '${btn.id}' has no linked bridge, gate, laser, or invisible platform – it does nothing!`);
    }
  }
}

// 5. Special mechanics checks
function checkSpecialMechanics(lvl, R) {
  const ts = lvl.tileSize;

  // ── SEESAW ──────────────────────────────────────────────────────────────────
  if (lvl.seesaws && lvl.seesaws.length > 0) {
    for (const sw of lvl.seesaws) {
      if (!sw.pivotX || !sw.pivotY) {
        R.error(`Seesaw '${sw.id}' missing pivotX or pivotY`);
      }
      if (!sw.length || sw.length < 200) {
        R.warn(`Seesaw '${sw.id}' length=${sw.length}px seems too short for co-op use`);
      }
      // Check that players can reach the seesaw from spawn
      const leftTip  = sw.pivotX - sw.length / 2;
      const rightTip = sw.pivotX + sw.length / 2;
      const pivY     = sw.pivotY;

      if (leftTip < 0 || rightTip > lvl.worldW) {
        R.error(`Seesaw '${sw.id}' extends outside world bounds (${leftTip}…${rightTip} vs 0…${lvl.worldW})`);
      }

      // The seesaw pivot should be near solid ground (the pivot rock)
      const pivCol = Math.floor(sw.pivotX / ts);
      const pivRow = Math.floor(sw.pivotY / ts);
      let pivHasSolid = false;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (isSolid(lvl, pivCol + dc, pivRow + dr)) { pivHasSolid = true; break; }
        }
        if (pivHasSolid) break;
      }
      if (!pivHasSolid) {
        R.warn(`Seesaw '${sw.id}' pivot at (${sw.pivotX},${sw.pivotY}) has no solid tile nearby – the pivot rock might be missing from the tilemap`);
      }

      // The key must be reachable when seesaw is tilted (only check if key is above this seesaw)
      if (lvl.key && lvl.key.x >= leftTip - 50 && lvl.key.x <= rightTip + 50) {
        const keyY         = lvl.key.y;
        const halfLen      = sw.length / 2;
        const maxAng       = sw.maxAngle || 0.35;
        const seesawTipY   = pivY - Math.sin(maxAng) * halfLen;         // y of tilted tip
        const topJumpY     = seesawTipY - PLAYER_H - HEIGHT_SAFE;       // top of player jump
        if (keyY < topJumpY - 20) {   // 20px tolerance
          R.error(`Key y=${keyY} may be too high – seesaw tip ≈${Math.round(seesawTipY)}px, player jump reaches ≈${Math.round(topJumpY)}px. Lower key or increase maxAngle`);
        } else {
          R.pass(`Key y=${keyY} is reachable from seesaw tip (est. reachable y≈${Math.round(topJumpY)})`);
        }
      }
      R.pass(`Seesaw '${sw.id}' basic configuration OK`);
    }
  }

  // ── SLINGSHOT ───────────────────────────────────────────────────────────────
  if (lvl.slingshot) {
    const sl = lvl.slingshot;
    if (!sl.x || !sl.y) R.error(`Slingshot '${sl.id}' missing x/y position`);

    // Check gap width – slingshot is only needed if gap is too wide to jump
    // Find the gap in row 14
    const row14    = lvl.tiles[14] || '';
    const slCol    = Math.floor(sl.x / ts);
    // Find next solid tile to the right of slingshot
    let gapStart = slCol, gapEnd = slCol;
    for (let c = slCol; c < row14.length; c++) {
      if (row14[c] === '0') { gapStart = c; break; }
    }
    for (let c = gapStart; c < row14.length; c++) {
      if (row14[c] === '1') { gapEnd = c; break; }
    }
    const gapPx = (gapEnd - gapStart) * ts;

    if (gapPx < GAP_SAFE) {
      R.warn(`Slingshot '${sl.id}' – gap is only ${gapPx}px which players might be able to jump without slingshot (max jump ≈${Math.round(GAP_SAFE)}px)`);
    } else {
      R.pass(`Slingshot gap ${gapPx}px correctly requires slingshot (gap > ${Math.round(GAP_SAFE)}px)`);
    }

    // Bridge for the "launcher" must exist
    const hasReturnBridge = (lvl.bridges || []).some(b => b.x <= sl.x + 200 && b.w > 200);
    if (!hasReturnBridge) {
      R.warn(`Slingshot '${sl.id}' – no bridge found that lets the launcher cross after firing. Verify level has a return path`);
    }
    R.pass(`Slingshot '${sl.id}' basic configuration OK`);
  }

  // ── COLOR LASERS ────────────────────────────────────────────────────────────
  if (lvl.colorLasers && lvl.colorLasers.length > 0) {
    const KNOWN_COLORS = ['#ff4d6d', '#4cc9f0', '#52b788', '#ffd60a', '#ff9ff3'];
    for (const cl of lvl.colorLasers) {
      if (!cl.color) {
        R.error(`ColorLaser '${cl.id}' has no color property`);
      } else {
        const colorOK = KNOWN_COLORS.includes(cl.color.toLowerCase());
        if (!colorOK) R.warn(`ColorLaser '${cl.id}' color '${cl.color}' does not match any player color`);
      }
      if (cl.laserIndex === undefined) {
        R.error(`ColorLaser '${cl.id}' missing laserIndex – buttons cannot target it`);
      }
      // Check bypass button exists on the other side
      const bypassBtn = (lvl.buttons || []).find(b => b.laserIndex === cl.laserIndex);
      if (!bypassBtn) {
        R.error(`ColorLaser '${cl.id}' (laserIndex=${cl.laserIndex}) has no bypass button – players cannot deactivate it!`);
      } else {
        // Button should be on the right side of the laser
        if (bypassBtn.x <= cl.x) {
          R.warn(`Bypass button '${bypassBtn.id}' is to the LEFT of ColorLaser '${cl.id}' – unreachable after passing through laser`);
        } else {
          R.pass(`ColorLaser '${cl.id}' has bypass button '${bypassBtn.id}' correctly placed to the right`);
        }
      }
    }
  }

  // ── TETHER ──────────────────────────────────────────────────────────────────
  if (lvl.hasTether && lvl.tether) {
    const maxDist = lvl.tether.maxDistance || 110;
    const bridges = lvl.bridges || [];
    const movingPlats = lvl.movingPlatforms || [];

    // Check gaps across floor (row 13)
    const floorSpans = platformSpansOnRow(lvl, 13);
    for (let i = 0; i < floorSpans.length - 1; i++) {
      const left  = floorSpans[i];
      const right = floorSpans[i + 1];
      const gapStartPx = (left.endCol + 1) * ts;
      const gapEndPx   = right.col * ts;
      const gapPx      = gapEndPx - gapStartPx;

      const coveredByBridge = bridges.some(b => b.x <= gapStartPx + 10 && b.x + b.w >= gapEndPx - 10);
      const coveredByFerry  = movingPlats.some(mp => mp.minX <= gapStartPx + 20 && mp.maxX + mp.w >= gapEndPx - 20);

      if (!coveredByBridge && !coveredByFerry) {
        if (gapPx > maxDist * 0.95) {
          R.error(`Tether level: gap ${gapPx}px between col ${left.endCol} and col ${right.col} exceeds safe tether distance ${Math.round(maxDist * 0.95)}px. Players will be dragged into pit!`);
        } else if (gapPx > maxDist * 0.75) {
          R.warn(`Tether level: gap ${gapPx}px is close to tether limit ${maxDist}px – very challenging but possible`);
        }
      }
    }
    R.pass(`Tether maxDistance=${maxDist}px defined and validated`);
  }

  // ── DARKNESS ────────────────────────────────────────────────────────────────
  if (lvl.darkness && lvl.darkness.enabled) {
    if (!lvl.torches || lvl.torches.length === 0) {
      R.error('Darkness is enabled but NO torches defined – players will be permanently blind!');
    } else {
      // Torches should be near spawn
      const sp = lvl.spawns[0];
      for (const t of lvl.torches) {
        const dist = Math.hypot(t.x - sp.x, t.y - sp.y);
        if (dist > 600) {
          R.warn(`Torch '${t.id}' is ${Math.round(dist)}px from spawn – players must navigate blind to reach it`);
        } else {
          R.pass(`Torch '${t.id}' is ${Math.round(dist)}px from spawn (accessible)`);
        }
      }
    }
  }

  // ── GENERATOR WHEELS ────────────────────────────────────────────────────────
  if (lvl.generatorWheels && lvl.generatorWheels.length > 0) {
    for (const gw of lvl.generatorWheels) {
      // The wheel should be on solid ground
      const gwCol = Math.floor(gw.x / ts);
      const gwRow = Math.floor((gw.y + (gw.radius || 48)) / ts);
      let onGround = false;
      for (let dr = 0; dr <= 2; dr++) {
        if (isSolid(lvl, gwCol, gwRow + dr)) { onGround = true; break; }
      }
      if (!onGround) {
        R.warn(`GeneratorWheel '${gw.id}' at (${gw.x},${gw.y}) has no solid ground directly below – wheel may hang in midair`);
      }

      // The elevator or bridge it powers must exist
      if (gw.targetId || (gw.targetBridgeIds && gw.targetBridgeIds.length > 0)) {
        const targetList = gw.targetBridgeIds || [gw.targetId];
        for (const tId of targetList) {
          const elevExists = (lvl.movingPlatforms || []).some(m => m.id === tId);
          const brgExists  = (lvl.bridges || []).some(b => b.id === tId);
          if (!elevExists && !brgExists) {
            R.error(`GeneratorWheel '${gw.id}' targets '${tId}' but no movingPlatform or bridge with that id exists!`);
          } else {
            R.pass(`GeneratorWheel '${gw.id}' correctly targets '${tId}'`);
          }
        }
      } else if (gw.targetType) {
        R.warn(`GeneratorWheel '${gw.id}' has targetType='${gw.targetType}' but no targetId – nothing will be powered!`);
      }
    }
  }

  // ── INVISIBLE PLATFORMS ─────────────────────────────────────────────────────
  if (lvl.invisiblePlatforms && lvl.invisiblePlatforms.length > 0) {
    for (const ip of lvl.invisiblePlatforms) {
      const hasRevealBtn   = !!ip.revealButtonId || (ip.revealButtonIds && ip.revealButtonIds.length > 0);
      const hasRevealPower = !!ip.revealWithPower;
      if (!hasRevealBtn && !hasRevealPower) {
        R.error(`InvisiblePlatform '${ip.id}' has no revealButtonId/revealButtonIds/revealWithPower – it is permanently invisible AND solid: players will walk on invisible ground they cannot see, but cannot unsee it either`);
      }
      // Check reveal button exists
      if (ip.revealButtonId) {
        const btn = (lvl.buttons || []).find(b => b.id === ip.revealButtonId);
        if (!btn) R.error(`InvisiblePlatform '${ip.id}' references button '${ip.revealButtonId}' which does not exist!`);
      }
      if (ip.revealButtonIds) {
        for (const bid of ip.revealButtonIds) {
          const btn = (lvl.buttons || []).find(b => b.id === bid);
          if (!btn) R.error(`InvisiblePlatform '${ip.id}' references button '${bid}' which does not exist!`);
        }
      }
      if (ip.revealWithPower && ip.powerGenId) {
        const gen = (lvl.generatorWheels || []).find(g => g.id === ip.powerGenId);
        if (!gen) R.error(`InvisiblePlatform '${ip.id}' references generatorWheel '${ip.powerGenId}' which does not exist!`);
      }
    }
  }

  // ── COMPACTOR WALL ──────────────────────────────────────────────────────────
  if (lvl.compactorWall) {
    const cw = lvl.compactorWall;
    // Should have an escape route (gate or door) before it crushes players
    const hasGate = (lvl.gates || []).length > 0;
    if (!hasGate) {
      R.warn(`Compactor wall level has no gate – verify there is an alternative escape route`);
    } else {
      R.pass(`Compactor wall level has escape gate(s)`);
    }

    // Speed sanity
    if ((cw.speed || 25) > 60) {
      R.warn(`Compactor wall speed=${cw.speed}px/s is very fast – players may not have enough time`);
    }

    // Verify there IS a wall to climb on tile map
    const cliffExists = lvl.tiles.some((row, ri) => ri <= 11 && ri >= 8 && row.includes('1'));
    if (!cliffExists) {
      R.warn(`Compactor wall level: no high platform tiles found in rows 8-11 – what do players climb?`);
    }
  }
}

// 6. DDS (Dynamic Difficulty Scaling) sanity
function checkDDS(lvl, R) {
  const buttons = lvl.buttons || [];

  // Buttons with index-based DDS (without isLatch/gateId/laserIndex → DDS-counted)
  const ddsButtons = buttons.filter(b => !b.isLatch && !b.gateId && b.laserIndex === undefined && b.minPlayers === undefined);
  if (ddsButtons.length > 0) {
    // Group by group id
    const groupCounts = {};
    ddsButtons.forEach(b => {
      const g = b.group || 0;
      groupCounts[g] = (groupCounts[g] || 0) + 1;
    });
    for (const [g, count] of Object.entries(groupCounts)) {
      if (count > 5) {
        R.warn(`${count} DDS buttons defined in group ${g} – only max 5 players, so only up to 4 will ever be active`);
      }
    }
    R.pass(`${ddsButtons.length} DDS button(s) scale with playerCount`);
  }

  // Generator wheel DDS
  for (const gw of (lvl.generatorWheels || [])) {
    if (gw.reqRunnersFormula) {
      // Try calling the formula with 2–5 players
      try {
        const vals = [2, 3, 4, 5].map(n => gw.reqRunnersFormula(n));
        R.pass(`GeneratorWheel '${gw.id}' reqRunners scales: [2p→${vals[0]}, 3p→${vals[1]}, 4p→${vals[2]}, 5p→${vals[3]}]`);
        // The min value should be ≥ 1
        if (Math.min(...vals) < 1) {
          R.error(`GeneratorWheel '${gw.id}' reqRunners formula returns <1 for some playerCount`);
        }
        // Should leave at least 1 player free to ride elevator
        const maxRunners = Math.max(...vals);
        if (maxRunners >= 5) {
          R.warn(`GeneratorWheel '${gw.id}' reqRunners = ${maxRunners} at 5 players – no one left to use the elevator/bridge!`);
        }
      } catch (e) {
        R.error(`GeneratorWheel '${gw.id}' reqRunnersFormula threw: ${e.message}`);
      }
    } else if (gw.reqRunners !== undefined) {
      if (gw.reqRunners < 1) R.error(`GeneratorWheel '${gw.id}' reqRunners < 1`);
      if (gw.reqRunners >= 5) R.warn(`GeneratorWheel '${gw.id}' reqRunners=${gw.reqRunners} ≥ 5 – leaves no one for the other task`);
    }
  }
}

// 7. Difficulty curve (inter-level comparison)
function checkDifficultyCurve(levels) {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`${C.bold}${C.cyan}  DIFFICULTY CURVE ANALYSIS (across all levels)${C.reset}`);
  console.log(`${'─'.repeat(72)}`);

  const rows = levels.map(lvl => {
    const spawnX    = lvl.spawns[0]?.x || 0;
    const doorX     = lvl.door?.x     || lvl.worldW;
    const keyX      = lvl.key?.x      || 0;
    const travelPx  = doorX - spawnX;
    const mechCount =
      (lvl.buttons?.length || 0) +
      (lvl.bridges?.length || 0) +
      (lvl.gates?.length   || 0) +
      (lvl.lasers?.length  || 0) +
      (lvl.colorLasers?.length || 0) +
      (lvl.seesaws?.length || 0) +
      (lvl.invisiblePlatforms?.length || 0) +
      (lvl.generatorWheels?.length || 0) +
      (lvl.compactorWall ? 1 : 0) +
      (lvl.slingshot ? 1 : 0) +
      (lvl.hasTether ? 1 : 0) +
      (lvl.darkness?.enabled ? 1 : 0);

    const gaps = [];
    for (let row = 12; row <= 14; row++) {
      if (!lvl.tiles[row]) continue;
      const spans = platformSpansOnRow(lvl, row);
      for (let i = 0; i < spans.length - 1; i++) {
        const gapPx = (spans[i + 1].col - spans[i].endCol - 1) * lvl.tileSize;
        if (gapPx > 0) gaps.push(gapPx);
      }
    }
    const maxGap = gaps.length > 0 ? Math.max(...gaps) : 0;

    return { id: lvl.id, name: lvl.name, worldW: lvl.worldW, travelPx, mechCount, maxGap };
  });

  // Print table
  console.log(`\n  ${'Lvl'.padEnd(4)} ${'World W'.padEnd(9)} ${'Travel'.padEnd(8)} ${'Mechs'.padEnd(7)} ${'MaxGap'.padEnd(8)} Name`);
  console.log(`  ${'─'.repeat(60)}`);

  rows.forEach((r, i) => {
    const prev = i > 0 ? rows[i - 1] : null;
    let flag = '';

    // Warn if mechCount drops sharply compared to previous level
    if (prev && r.mechCount < prev.mechCount - 3) {
      flag = `${C.yellow}⚠ fewer mechanics than previous level${C.reset}`;
    }
    // Warn if worldW doesn't grow with level number
    if (prev && r.worldW < prev.worldW - 400) {
      flag = flag ? flag + '; ' : '';
      flag += `${C.yellow}⚠ shorter world than previous level${C.reset}`;
    }

    const idStr      = String(r.id).padEnd(4);
    const worldStr   = String(r.worldW).padEnd(9);
    const travelStr  = String(r.travelPx).padEnd(8);
    const mechStr    = String(r.mechCount).padEnd(7);
    const gapStr     = r.maxGap > GAP_WARN
      ? `${C.red}${String(r.maxGap).padEnd(8)}${C.reset}`
      : r.maxGap > GAP_SAFE
        ? `${C.yellow}${String(r.maxGap).padEnd(8)}${C.reset}`
        : String(r.maxGap).padEnd(8);

    console.log(`  ${idStr} ${worldStr} ${travelStr} ${mechStr} ${gapStr} ${C.dim}${r.name}${C.reset}  ${flag}`);
  });
}

// ─── MAIN RUNNER ─────────────────────────────────────────────────────────────
function validateLevel(lvl, verbose) {
  const R = new LevelReport(lvl);

  checkStructure(lvl, R);
  checkJumpPhysics(lvl, R);
  checkReachability(lvl, R);
  checkButtonLinkage(lvl, R);
  checkSpecialMechanics(lvl, R);
  checkDDS(lvl, R);

  R.print(verbose);
  return R;
}

function main() {
  const args    = process.argv.slice(2);
  const verbose = args.includes('--verbose');
  const nums    = args.filter(a => /^\d+$/.test(a)).map(Number);

  let targets = LEVELS;
  if (nums.length === 1) {
    targets = LEVELS.filter(l => l.id === nums[0]);
    if (targets.length === 0) { console.error(`Level ${nums[0]} not found`); process.exit(1); }
  } else if (nums.length === 2) {
    targets = LEVELS.filter(l => l.id >= nums[0] && l.id <= nums[1]);
  }

  console.log(`\n${'═'.repeat(72)}`);
  console.log(`${C.bold}${C.magenta}  BoxBuds Level Validator  –  checking ${targets.length} level(s)${C.reset}`);
  console.log(`${'═'.repeat(72)}`);
  console.log(`${C.dim}  Physics ceiling: max jump ≈${Math.round(JUMP_HEIGHT_MAX)}px high, ≈${Math.round(JUMP_RANGE_MAX)}px across${C.reset}`);

  const reports = targets.map(lvl => validateLevel(lvl, verbose));

  if (targets.length === LEVELS.length) {
    checkDifficultyCurve(targets);
  }

  // Summary
  console.log(`\n${'═'.repeat(72)}`);
  const errLabel  = totalErrors   > 0 ? `${C.red}${C.bold}${totalErrors} error(s)${C.reset}`   : `${C.green}0 errors${C.reset}`;
  const warnLabel = totalWarnings > 0 ? `${C.yellow}${totalWarnings} warning(s)${C.reset}` : `${C.green}0 warnings${C.reset}`;
  console.log(`  ${C.bold}Result:${C.reset} ${errLabel}  ${warnLabel}  ${C.green}${totalPasses} passed${C.reset}`);

  if (totalErrors > 0) {
    console.log(`\n  ${C.bgRed}${C.white}${C.bold}  ACTION REQUIRED: Fix errors before testing level(s) in-game!  ${C.reset}`);
  } else if (totalWarnings > 0) {
    console.log(`\n  ${C.yellow}Review warnings – they may cause confusing or uncompletable gameplay.${C.reset}`);
  } else {
    console.log(`\n  ${C.bgGreen}  All levels passed validation!  ${C.reset}`);
  }
  console.log('');

  process.exit(totalErrors > 0 ? 1 : 0);
}

main();
