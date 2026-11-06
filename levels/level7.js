'use strict';

// ── LEVEL 7: Team Push (All Players Push & Boulder Chamber) ───────────────────
// Jarak: 2400 px (60 Kolom, 2.0x Panjang Layar)
// Fitur: Batu Raksasa yang SANGAT BERAT!
// SKALA KESULITAN DINAMIS (DDS):
// 1. Batu Raksasa 1 (x: 520): minPushersFormula = (pCount) => pCount.
//    Seluruh pemain online TANPA KECUALI wajib mendorong bersamaan ke arah kanan!
//    Batu didorong hingga menindih saklar [SAKLAR BATU] di x: 980 untuk membuka GERBANG BESI.
// 2. Peti Berat 2 (x: 1420): minPushersFormula = (pCount) => Math.max(1, pCount - 1).
//    Peti didorong jatuh dari platform atas ke saklar [SAKLAR AKHIR] untuk membuka GERBANG EMAS.
// PENCEGAHAN SOFTLOCK:
// - Batu dan peti yang diletakkan di atas saklar akan menekan saklar secara permanen.
// - Disediakan tangga pijakan alami agar seluruh pemain bisa naik turun tanpa terjebak.
// - Ketika Kunci Emas berhasil diraih, seluruh gerbang otomatis mengunci terbuka!

module.exports = {
  id      : 7,
  name    : 'Level 7 – Team Push',
  worldW  : 2400,
  worldH  : 600,
  tileSize: 40,
  tiles   : [
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
    '000000000000000000000000000011000000000000000011000000000000', // 9  - Dinding atas Gerbang 1 (col 28-29) & Gerbang 2 (col 46-47)
    '000000000000000000000000000011000011111100000011000000000000', // 10 - Platform Stage 2 (col 34-39, y: 400)
    '000000000000000000000000000011000100000000000011000000000000', // 11 - Tangga Step 2 (col 33, y: 440)
    '000000000000000000000000000000001100000000000000000000000000', // 12 - Gerbang 1 & Tangga Step 1 (col 32-33) & Gerbang 2
    '000000000000000000000000000000000000000000000000000000000000', // 13 - Gerbang 1 & 2
    '111111111111111111111111111111111111111111111111111111111111', // 14 - Lantai Solid Penuh (y: 560)
  ],
  spawns: [
    { x:  80, y: 500 },
    { x: 120, y: 500 },
    { x: 160, y: 500 },
    { x: 200, y: 500 },
    { x: 240, y: 500 },
  ],
  key : { x: 2020, y: 450 },
  door: { x: 2260, y: 488 },
  doorW: 48,
  doorH: 72,
  boxes: [
    // Batu Raksasa 1: Seluruh pemain online harus kompak mendorong bersama!
    {
      id               : 'boulder_team_1',
      x                : 520,
      y                : 488,
      w                : 72,
      h                : 72,
      vx               : 0,
      vy               : 0,
      onGround         : true,
      minPushersFormula: (pCount) => pCount,
    },
    // Peti Tahap 2 di atas platform bertingkat
    {
      id               : 'box_boulder_2',
      x                : 1420,
      y                : 344,
      w                : 56,
      h                : 56,
      vx               : 0,
      vy               : 0,
      onGround         : true,
      minPushersFormula: (pCount) => Math.max(1, pCount - 1),
    },
  ],
  gates: [
    // Gerbang Besi Tahap 1
    {
      id   : 'gate_boulder_hall',
      x    : 1120,
      y    : 480,
      w    : 80,
      h    : 80,
      label: 'GERBANG BESI',
    },
    // Gerbang Emas Tahap 2
    {
      id   : 'gate_boulder_vault',
      x    : 1840,
      y    : 480,
      w    : 80,
      h    : 80,
      label: 'GERBANG EMAS',
    },
  ],
  buttons: [
    // Saklar lantai untuk Batu Raksasa 1
    {
      id     : 'btn_boulder_slot',
      x      : 978,
      y      : 546,
      w      : 44,
      h      : 14,
      gateId : 'gate_boulder_hall',
      label  : 'SAKLAR BATU',
    },
    // Saklar lantai untuk Peti Tahap 2
    {
      id     : 'btn_boulder_slot2',
      x      : 1678,
      y      : 546,
      w      : 44,
      h      : 14,
      gateId : 'gate_boulder_vault',
      label  : 'SAKLAR AKHIR',
    },
  ],
  bridges     : [],
  lasers      : [],
  springboards: [],
};

