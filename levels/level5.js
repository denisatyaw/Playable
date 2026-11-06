'use strict';

// ── LEVEL 5: Shield & Laser Co-op (Dual-Shield Synergy) ──────────────────────
// Jarak: 2200 px (55 Kolom)
// MEKANIK BARU: PERISAI SINERGI 2 PEMAIN (DUAL-SHIELD CO-OP)
// - Pemain 1 membawa TOP SHIELD (Perisai Langit-Langit di atas kepala):
//   Menahan laser vertikal yang menyembur dari atap terowongan.
// - Pemain 2 membawa FRONT SHIELD (Perisai Depan Badan di arah hadap):
//   Menahan laser horizontal yang memotong di sepanjang lantai.
// SINERGI SALING MELENGKAPI:
// - Saat ada laser horizontal, Pemain 2 berjalan di depan menahan sinar.
// - Saat ada laser vertikal, Pemain 1 berjalan melindungi bagian atas.
// - Di zona gabungan, Pemain 1 MENUMPUK di atas kepala Pemain 2:
//   Pemain 1 menahan atas + Pemain 2 menahan depan = Unit Tank Sempurna!
// JALAN KELUAR PASTI:
// Di ujung koridor (x: 1840) terdapat Kunci Emas.
// Begitu Kunci disentuh: SELURUH LASER MATI PERMANEN!
// Tepat di depan (x: 2040) terdapat PINTU KELUAR yang langsung terbuka lebar!

module.exports = {
  id      : 5,
  name    : 'Level 5 – Shield & Laser Co-op',
  worldW  : 2200,
  worldH  : 600,
  tileSize: 40,
  tiles: [
    // 55 kolom per baris
    // 0         1         2         3         4         5
    // 0123456789012345678901234567890123456789012345678901234
    '0000000000000000000000000000000000000000000000000000000', // 0
    '0000000000000000000000000000000000000000000000000000000', // 1
    '0000000000000000000000000000000000000000000000000000000', // 2
    '0000000000111111111111111111111111111111111100000000000', // 3 - Atap Terowongan Laser (cols 10-44, y: 120)
    '0000000000000000000000000000000000000000000000000000000', // 4
    '0000000000000000000000000000000000000000000000000000000', // 5
    '0000000000000000000000000000000000000000000000000000000', // 6
    '0000000000000000000000000000000000000000000000000000000', // 7
    '0000000000000000000000000000000000000000000000000000000', // 8
    '0000000000000000000000000000000000000000000000000000000', // 9
    '0000000000000000000000000000000000000000000000000000000', // 10
    '0000000000000000000000000000000000000000000000000000000', // 11
    '0000000000000000000000000000000000000000000000000000000', // 12
    '0000000000000000000000000000000000000000000000110000000', // 13 - Pedestal Kunci di col 46 (x: 1840)
    '1111111111111111111111111111111111111111111111111111111', // 14 - Lantai Solid Mulus (55 Kolom)
  ],
  spawns: [
    { x:  60, y: 500 },
    { x: 100, y: 500 },
    { x: 140, y: 500 },
    { x: 180, y: 500 },
    { x: 220, y: 500 },
  ],
  key : { x: 1850, y: 480 },  // Di atas pedestal col 46 (x: 1850)
  door: { x: 2040, y: 480 },  // Pintu Keluar di lantai ujung kanan (x: 2040)
  doorW: 48,
  doorH: 72,
  // Rangkaian Laser Sinergi
  lasers: [
    // 1. Zona Front Shield: Laser Horizontal lantai (x: 440 s/d 780)
    {
      id         : 'laser_h1',
      orientation: 'horizontal',
      x          : 440,
      y          : 520,
      w          : 340,
      h          : 16,
      active     : true,
    },
    // 2. Zona Top Shield: Laser Vertikal Langit-Langit #1 (x: 960)
    {
      id         : 'laser_v1',
      orientation: 'vertical',
      x          : 960,
      y          : 160,
      w          : 16,
      h          : 400,
      active     : true,
    },
    // 3. Zona Top Shield: Laser Vertikal Langit-Langit #2 (x: 1160)
    {
      id         : 'laser_v2',
      orientation: 'vertical',
      x          : 1160,
      y          : 160,
      w          : 16,
      h          : 400,
      active     : true,
    },
    // 4. Zona Gauntlet Gabungan: Laser Horizontal Lantai #2 (x: 1380 s/d 1740)
    {
      id         : 'laser_h2',
      orientation: 'horizontal',
      x          : 1380,
      y          : 520,
      w          : 360,
      h          : 16,
      active     : true,
    },
    // 5. Zona Gauntlet Gabungan: Laser Vertikal Atas #3 (x: 1520)
    {
      id         : 'laser_v3',
      orientation: 'vertical',
      x          : 1520,
      y          : 160,
      w          : 16,
      h          : 400,
      active     : true,
    },
    // 6. Zona Gauntlet Gabungan: Laser Vertikal Atas #4 (x: 1680)
    {
      id         : 'laser_v4',
      orientation: 'vertical',
      x          : 1680,
      y          : 160,
      w          : 16,
      h          : 400,
      active     : true,
    },
  ],
  boxes       : [],
  buttons     : [],
  bridges     : [],
  gates       : [],
  springboards: [],
};
