'use strict';

// ── LEVEL 1: First Steps (Tutorial & Basic Co-op) ────────────────────────────
// Jarak: 1200 px (1 Viewport)
// Pengenalan kontrol gerak, melompat, dan mencapai pintu keluar bersama.

module.exports = {
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
    '000000001111000000001111000000', // row 10 – stepping stones
    '000000000000000000000000000000', // row 11
    '000001100000000000000000011000', // row 12 – anak tangga awal (80px dari lantai)
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
  boxes       : [],
  buttons     : [],
  bridges     : [],
  lasers      : [],
  springboards: [],
};

