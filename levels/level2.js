'use strict';

// ── LEVEL 2: The Step (Expanded Multi-Stage Heavy Box, Stacking & Anti-Strand Gate)
// Jarak: 2400 px (60 Kolom, 2x Panjang Layar)
// Kamera bergerak mengikuti tim. Pemain dibatasi di dalam batas layar bersama.
// Stage 1: Dorong Peti 1 untuk lewati dinding pertama (120px). Ada anak tangga balik di sisi kanan.
// Stage 2: Terdapat 2 Peti (Peti Berat + Peti Tumpuk). Pemain bisa menumpuk kotak / saling menumpuk badan.
// ANTI-STRAND PENCEGAHAN:
// Begitu kawan pertama melompati dinding, di sisi kanan dinding terdapat tombol [🔓 BUKA GERBANG].
// Menginjak tombol ini akan membuka Gerbang Bawah secara permanen sehingga SEMUA kawan di belakang
// bisa langsung lewat tanpa ada yang ketinggalan/terjebak!
// Stage 3: Anak tangga dari lantai memudahkan siapa pun naik ke platform Kunci dan Pintu Keluar.

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
    '000000000000000000000000000000000001100000000000000000000000', // 9  - Dinding atas Stage 2 (col 35-36)
    '000000000000000000000000000000000001100000110000000000000000', // 10 - Dinding + Anak tangga col 41-42
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
    // Peti 2A (Stage 2 - Heavy Box DDS): di x: 960
    {
      id: 'box_stage_2_a',
      x: 960,
      y: 504,
      w: 56,
      h: 56,
      vx: 0,
      vy: 0,
      onGround: true,
      minPushersFormula: (pCount) => Math.max(1, pCount - 1),
    },
    // Peti 2B (Stage 2 - Utility / Stacking Box): di x: 1080
    {
      id: 'box_stage_2_b',
      x: 1080,
      y: 510,
      w: 50,
      h: 50,
      vx: 0,
      vy: 0,
      onGround: true,
      minPushers: 1, // Bisa didorong sendirian untuk tumpukan tangga
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
