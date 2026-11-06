'use strict';

// ── LEVEL 2: The Step (Expanded Multi-Stage Heavy Box & Stacking) ────────────
// Jarak: 2400 px (60 Kolom, 2x Panjang Layar)
// Kamera bergerak mengikuti tim. Pemain dibatasi di dalam batas layar bersama.
// Stage 1: Dorong Peti 1 untuk lewati dinding pertama (120px).
// Stage 2: Dorong Peti 2 + Tumpuk badan di atas peti untuk lewati dinding tinggi (200px).
// Stage 3: Parkour platform menuju Kunci dan Pintu Keluar di ujung map.

module.exports = {
  id      : 2,
  name    : 'Level 2 – The Step',
  worldW  : 2400,
  worldH  : 600,
  tileSize: 40,
  tiles: [
    // 60 kolom per baris
    // 0         1         2         3         4         5
    // 012345678901234567890123456789012345678901234567890123456789
    '000000000000000000000000000000000000000000000000000000000000', // 0
    '000000000000000000000000000000000000000000000000000000000000', // 1
    '000000000000000000000000000000000000000000000000000000000000', // 2
    '000000000000000000000000000000000000000000000000000000000000', // 3
    '000000000000000000000000000000000000000000000000111100000000', // 4
    '000000000000000000000000000000000000000000000000000000000000', // 5
    '000000000000000000000000000000000000000000011110000000000000', // 6 - Kunci di sini
    '000000000000000000000000000000000000000000000000000000000000', // 7
    '000000000000000000000000000000000001100001100000000000000000', // 8
    '000000000000000000000000000000000001100000000000000000000000', // 9  - Dinding tinggi Stage 2 (baris 9-13)
    '000000000000000000000000000000000001100000000000000000000000', // 10
    '000000000000000011000000000000000001100000000000000000000000', // 11 - Dinding Stage 1 (baris 11-13)
    '000000000000000011000000000000000001100000000000000000000000', // 12
    '000000000000000011000000000000000001100000000000000000000000', // 13
    '111111111111111111111111111111111111111111111111111111111111', // 14 - Lantai
  ],
  spawns: [
    { x:  60, y: 500 },
    { x: 100, y: 500 },
    { x: 140, y: 500 },
    { x: 180, y: 500 },
    { x: 220, y: 500 },
  ],
  key : { x: 1820, y: 210 },  // Di atas platform baris 6 (x: 1820)
  door: { x: 2280, y: 480 },  // Di ujung kanan (x: 2280)
  doorW: 48,
  doorH: 72,
  boxes: [
    // Peti 1 (Stage 1): di x: 380
    {
      id: 'box_stage_1',
      x: 380,
      y: 504,
      w: 56,
      h: 56,
      vx: 0,
      vy: 0,
      onGround: true,
      minPushersFormula: (pCount) => Math.max(1, pCount - 1),
    },
    // Peti 2 (Stage 2): di x: 1020
    {
      id: 'box_stage_2',
      x: 1020,
      y: 500,
      w: 60,
      h: 60,
      vx: 0,
      vy: 0,
      onGround: true,
      minPushersFormula: (pCount) => Math.max(1, pCount - 1),
    }
  ],
  buttons     : [],
  bridges     : [],
  lasers      : [],
  springboards: [],
};
