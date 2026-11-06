'use strict';

// ── LEVEL 2: The Step (Expanded Multi-Stage Heavy Box, Stacking & Anti-Strand Gate)
// Jarak: 2400 px (60 Kolom, 2x Panjang Layar)
// Stage 1: Dorong Peti 1 (x: 380) untuk lewati dinding pertama (120px).
// Stage 2: Dorong Peti 2 (x: 1040) ke dinding kedua (160px).
// MEKANIK ANTI-STRAND:
// Kawan pertama melompati dinding dengan menumpuk badan di atas kawan yang berdiri di atas peti.
// Begitu kawan pertama mendarat di seberang, terdapat tombol [🔓 BUKA GERBANG] di x: 1540.
// Menginjak tombol ini akan membuka Gerbang Bawah secara permanen sehingga SEMUA kawan di belakang
// bisa langsung lewat tanpa ada yang ketinggalan/terjebak!
// Stage 3: Anak tangga dari lantai memudahkan naik ke platform Kunci (x: 1820) dan Pintu Keluar (x: 2280).

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
    '000000000000000000000000000000000000000011000000000000000000', // 8  - Platform atas
    '000000000000000000000000000000000000000000000000000000000000', // 9
    '000000000000000000000000000000000001100000110000000000000000', // 10 - Dinding Stage 2 col 35-36 (160px) + Tangga col 41-42
    '000000000000000011000000000000000001100000000000000000000000', // 11 - Dinding Stage 1 + Dinding Stage 2
    '000000000000000011100000000000000000000001100000000000000000', // 12 - Step balik Stg 1 + Gerbang Stg 2 (00) + Step Stg 2
    '000000000000000011000000000000000000000000000000000000000000', // 13 - Gerbang Stg 2 (00)
    '111111111111111111111111111111111111111111111111111111111111', // 14 - Lantai Solid
  ],
  spawns: [
    { x:  60, y: 500 },
    { x: 100, y: 500 },
    { x: 140, y: 500 },
    { x: 180, y: 500 },
    { x: 220, y: 500 },
  ],
  key : { x: 1820, y: 210 },  // Di atas platform baris 6 (x: 1820)
  door: { x: 2280, y: 480 },  // Di lantai ujung kanan (x: 2280)
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
    // Peti 2 (Stage 2 - Heavy Box DDS): di x: 1040
    {
      id: 'box_stage_2',
      x: 1040,
      y: 500,
      w: 60,
      h: 60,
      vx: 0,
      vy: 0,
      onGround: true,
      minPushersFormula: (pCount) => Math.max(1, pCount - 1),
    }
  ],
  // Gerbang pencegah ketinggalan: Terbuka saat kawan menekan tombol di seberang!
  gates: [
    {
      id   : 'gate_stage2',
      x    : 1400,
      y    : 480,
      w    : 80,
      h    : 80,
      label: 'GERBANG DINDING',
    }
  ],
  buttons: [
    // Tombol pembuka gerbang di sisi seberang dinding (x: 1540):
    {
      id     : 'btn_gate_stage2',
      x      : 1540,
      y      : 546,
      w      : 44,
      h      : 14,
      isLatch: true,
      gateId : 'gate_stage2',
      label  : 'BUKA GERBANG',
    }
  ],
  bridges     : [],
  lasers      : [],
  springboards: [],
};
