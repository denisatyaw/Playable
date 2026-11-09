'use strict';

// ── LEVEL 20: The Ultimate Machine (Generator + Invisible Floor Combo) ────────
// Jarak: 2800 px (70 Kolom, 2.3x Panjang Layar)
// Fitur Gabungan 2: Generator Wheel (Roda Listrik) + Invisible Solid (Lantai Ilusi).
// - Lantai transparan tidak lagi dinyalakan memakai saklar biasa, melainkan harus dihidupkan
//   dengan arus listrik dari Roda Generator!
// - Ketika roda berhenti berputar, daya listrik perlahan habis dan lantai ilusi kembali lenyap!
// PUZZLE RELAY GANDA (TEAMWORK EKSTREM):
// 1. Tahap 1: Sebagian tim berlari di Roda Generator A (x: 440) untuk menyalakan lampu penunjuk
//    Lantai Ilusi Segmen 1 (x: 680 - 1280).
// 2. Tim pelari seberang melintasi jembatan ilusi hingga mencapai Pulau Tengah (x: 1360 - 1600).
// 3. Di Pulau Tengah terdapat Roda Generator Cadangan B (x: 1480).
// 4. Tim di Pulau Tengah mulai berlari di Generator B untuk menyalakan Lantai Ilusi Segmen 2
//    (x: 1680 - 2280) sekaligus membuka Gerbang Relai bagi kawan-kawan dari Generator A!
// 5. Seluruh tim berkumpul di Brankas Agung (x: 2360 - 2800), mengambil Kunci Emas,
//    dan masuk ke Pintu Keluar Utama untuk menamatkan game!

module.exports = {
  id      : 20,
  name    : 'Level 20 – The Ultimate Machine',
  worldW  : 2800,
  worldH  : 600,
  tileSize: 40,
  tiles   : [
    // 70 kolom per baris (0=udara, 1=solid)
    // 0         1         2         3         4         5         6
    // 0123456789012345678901234567890123456789012345678901234567890123456789
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 0
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 1
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 2
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 3
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 4
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 5
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 6
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 7
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 8
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 9
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 10
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 11
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 12
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 13
    '1111111111111110000000000000000001111110000000000000000001111111111111', // 14 - Dermaga Awal (0-14), Pulau Tengah (34-39), Brankas Akhir (58-69)
  ],
  spawns: [
    { x:  80, y: 500 },
    { x: 120, y: 500 },
    { x: 160, y: 500 },
    { x: 200, y: 500 },
    { x: 240, y: 500 },
  ],
  // 2 Roda Generator Listrik (Dermaga Awal & Pulau Tengah)
  generatorWheels: [
    {
      id               : 'gen_wheel_20_a',
      x                : 440,
      y                : 500,
      radius           : 48,
      power            : 0,
      reqRunnersFormula: (pCount) => Math.max(1, Math.floor(pCount / 2)),
    },
    {
      id               : 'gen_wheel_20_b',
      x                : 1480,
      y                : 500,
      radius           : 48,
      power            : 0,
      reqRunnersFormula: (pCount) => Math.max(1, Math.floor(pCount / 2)),
    },
  ],
  // Lantai Ilusi yang Menyala Saat Arus Listrik Mengalir
  invisiblePlatforms: [
    // Segmen 1: Ditenagai oleh Generator A (spacing ~180px maks gap antar platform)
    { id: 'inv_u20_1', x: 660,  y: 530, w: 100, h: 20, revealWithPower: true, powerGenId: 'gen_wheel_20_a' },
    { id: 'inv_u20_2', x: 860,  y: 500, w: 100, h: 20, revealWithPower: true, powerGenId: 'gen_wheel_20_a' },
    { id: 'inv_u20_3', x: 1060, y: 470, w: 100, h: 20, revealWithPower: true, powerGenId: 'gen_wheel_20_a' },
    { id: 'inv_u20_4', x: 1260, y: 510, w: 100, h: 20, revealWithPower: true, powerGenId: 'gen_wheel_20_a' },
    // Stepping stone antara Segmen 1 dan Segmen 2 (Pulau Tengah row 14 cols 34-39 = x:1360-1600)
    // Gap dari inv_u20_4 (x:1360) ke Pulau Tengah (x:1360) = 0px → langsung nyambung!
    // Segmen 2: Ditenagai oleh Generator B (dari Pulau Tengah x:1600 ke Brankas x:2320)
    { id: 'inv_u20_5', x: 1680, y: 520, w: 100, h: 20, revealWithPower: true, powerGenId: 'gen_wheel_20_b' },
    { id: 'inv_u20_6', x: 1880, y: 490, w: 100, h: 20, revealWithPower: true, powerGenId: 'gen_wheel_20_b' },
    { id: 'inv_u20_7', x: 2080, y: 510, w: 100, h: 20, revealWithPower: true, powerGenId: 'gen_wheel_20_b' },
    { id: 'inv_u20_8', x: 2240, y: 530, w: 100, h: 20, revealWithPower: true, powerGenId: 'gen_wheel_20_b' },
  ],
  key : { x: 2480, y: 500 },
  door: { x: 2680, y: 488 },
  doorW: 48,
  doorH: 72,
  buttons     : [],
  bridges     : [],
  boxes       : [],
  gates       : [],
  lasers      : [],
  springboards: [],
};

