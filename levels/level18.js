'use strict';

// ── LEVEL 18: Panic Room (Compactor Wall & Speed Stacking) ────────────────────
// Jarak: 2400 px (60 Kolom, 2.0x Panjang Layar)
// Fitur Baru: Compactor Wall (Dinding Bergeser / Panic Wall).
// - Dinding raksasa berputar dan berduri hidrolik maju dari kiri ke kanan (speed: 28 px/s).
// - Menyentuh atau terjepit dinding ini berakibat mati seketika!
// PUZZLE & KERJASAMA CEPAT (SPEED STACKING):
// - Di x: 880 terdapat tebing vertikal tinggi setinggi 240 px yang menghalangi jalan.
// - Tim harus berlari cepat ke kaki tebing dan segera bertumpuk menara manusia (human tower)
//   sebelum dinding maut mencapai mereka!
// - Pemain di puncak menara melompat ke atas tebing dan menginjak tombol [BUKA GERBANG PELARIAN].
// - Gerbang bawah langsung terbuka seketika sehingga seluruh kawan di bawah bisa lolos
//   ke zona aman sebelum tergilas!

module.exports = {
  id           : 18,
  name         : 'Level 18 – Panic Room',
  worldW       : 2400,
  worldH       : 600,
  tileSize     : 40,
  compactorWall: {
    x     : 0,
    w     : 140,
    speed : 24,
    active: true,
  },
  tiles: [
    // 60 kolom per baris (0=udara, 1=solid)
    // 0         1         2         3         4         5
    // 012345678901234567890123456789012345678901234567890123456789
    '000000000000000000000000000000000000000000000000000000000000', // 0
    '000000000000000000000000000000000000000000000000000000000000', // 1
    '000000000000000000000000000000000000000000000000000000000000', // 2
    '000000000000000000000000000000000000000000000000000000000000', // 3
    '000000000000000000000000000000000000000000000000000000000000', // 4
    '000000000000000000000000000000000000000000000000000000000000', // 5
    '000000000000000000000000000000000000000000000000000000000000', // 6
    '000000000000000000000000000000000000000000000000000000000000', // 7
    '000000000000000000000000000000000000000000000000000000000000', // 8
    '000000000000000000000000000000000000000000000000000000000000', // 9
    '000000000000000000000011110000000000000000000000000000000000', // 10 - Puncak Tebing (cols 22-25, y: 400)
    '000000000000000000000111110000000000000000000000000000000000', // 11 - Tangga Pijakan (col 21, y: 440)
    '000000000000000000000000000000000000000000000000000000000000', // 12 - Gerbang Bawah Pelarian (cols 22-23)
    '000000000000000000000000000000000000000000000000000000000000', // 13 - Gerbang Bawah Pelarian
    '111111111111111111111111111111111111111111111111111111111111', // 14 - Lantai Solid Penuh (y: 560)
  ],
  spawns: [
    { x: 180, y: 500 },
    { x: 220, y: 500 },
    { x: 260, y: 500 },
    { x: 300, y: 500 },
    { x: 340, y: 500 },
  ],
  key : { x: 1800, y: 500 },
  door: { x: 2260, y: 488 },
  doorW: 48,
  doorH: 72,
  gates: [
    // Gerbang Bawah Pelarian
    {
      id   : 'gate_panic_room',
      x    : 880,
      y    : 480,
      w    : 80,
      h    : 80,
      label: 'GERBANG PELARIAN',
    },
  ],
  buttons: [
    // Tombol di puncak tebing penyelamat
    {
      id     : 'btn_panic_escape',
      x      : 920,
      y      : 386,
      w      : 44,
      h      : 14,
      isLatch: true,
      gateId : 'gate_panic_room',
      label  : 'BUKA GERBANG PELARIAN',
    },
  ],
  bridges     : [],
  boxes       : [],
  lasers      : [],
  springboards: [],
};

