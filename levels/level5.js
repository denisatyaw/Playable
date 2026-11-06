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
//   Sinar yang tertahan dinonaktifkan sehingga kawan di belakang dapat menyeberang aman!
// - Di seberang laser terdapat tombol terminal untuk mematikan laser permanen bagi seluruh tim.
// - Di zona gabungan, kawan saling menempel atau bertumpuk badan untuk melewati rintangan bersama!
// JALAN KELUAR PASTI:
// Di ujung koridor (x: 1850) terdapat Kunci Emas.
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
    // 1. Zona Front Shield: Laser Horizontal lantai (x: 440 s/d 660)
    {
      id         : 'laser_h1',
      index      : 0,
      orientation: 'horizontal',
      x          : 440,
      y          : 520,
      w          : 220,
      h          : 16,
      active     : true,
    },
    // 2. Zona Top Shield: Laser Vertikal Langit-Langit #1 (x: 880)
    {
      id         : 'laser_v1',
      index      : 1,
      orientation: 'vertical',
      x          : 880,
      y          : 160,
      w          : 16,
      h          : 400,
      active     : true,
    },
    // 3. Zona Top Shield: Laser Vertikal Langit-Langit #2 (x: 1080)
    {
      id         : 'laser_v2',
      index      : 2,
      orientation: 'vertical',
      x          : 1080,
      y          : 160,
      w          : 16,
      h          : 400,
      active     : true,
    },
    // 4. Zona Gauntlet Gabungan: Laser Horizontal Lantai #2 (x: 1320 s/d 1560)
    {
      id         : 'laser_h2',
      index      : 3,
      orientation: 'horizontal',
      x          : 1320,
      y          : 520,
      w          : 240,
      h          : 16,
      active     : true,
    },
    // 5. Zona Gauntlet Gabungan: Laser Vertikal Atas #3 (x: 1440)
    {
      id         : 'laser_v3',
      index      : 4,
      orientation: 'vertical',
      x          : 1440,
      y          : 160,
      w          : 16,
      h          : 400,
      active     : true,
    },
    // 6. Zona Gauntlet Gabungan: Laser Vertikal Atas #4 (x: 1620)
    {
      id         : 'laser_v4',
      index      : 5,
      orientation: 'vertical',
      x          : 1620,
      y          : 160,
      w          : 16,
      h          : 400,
      active     : true,
    },
  ],
  // Tombol Terminal untuk mematikan laser permanen setelah berhasil dilewati perisai
  buttons: [
    { id: 'btn_off_h1', x: 720,  y: 546, w: 42, h: 14, isLatch: true, laserIndex: 0, label: 'MATIKAN LASER #1' },
    { id: 'btn_off_v1', x: 1160, y: 546, w: 42, h: 14, isLatch: true, laserIndex: 1, label: 'MATIKAN LASER #2' },
    { id: 'btn_off_v2', x: 1220, y: 546, w: 42, h: 14, isLatch: true, laserIndex: 2, label: 'MATIKAN LASER #3' },
  ],
  boxes       : [],
  bridges     : [],
  gates       : [],
  springboards: [],
};
