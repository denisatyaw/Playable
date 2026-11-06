'use strict';

// ── LEVEL 5: Shield & Laser Co-op (Dual-Shield Synergy) ──────────────────────
// Jarak: 2200 px (55 Kolom)
// MEKANIK: PERISAI SINERGI 2 PEMAIN (DUAL-SHIELD CO-OP)
// - Pemain 1 membawa TOP SHIELD (Perisai Langit-Langit di atas kepala):
//   Menahan laser vertikal yang menyembur dari atap terowongan.
// - Pemain 2 membawa FRONT SHIELD (Perisai Depan Badan di arah hadap):
//   Menahan laser horizontal yang memotong dari dinding samping.
// RUANG KE BAWAH (SUNKEN TRENCH) & LASER DARI SAMPING:
// - Di awal level, tim melompat turun ke ruang bawah (cols 8-18).
// - Laser pertama memancar horizontal dari dinding samping di ruang bawah!
// - Pemain Front Shield maju ke depan menahan laser, menetralkan berkas sinar.
// - Tim menyeberang bersama, menaiki undakan, dan menekan tombol saklar permanen.
// KORIDOR ATAS & GAUNTLET GABUNGAN:
// - Koridor berikutnya memiliki laser vertikal yang menyembur dari atap.
// - Di zona akhir, kedua perisai bersinergi (tumpuk badan / jalan berdampingan).
// - Kunci Emas di ujung mematikan seluruh laser secara permanen!

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
    '0000000000000000000001111111111100000111111100000000000', // 3 - Atap Koridor Laser (y: 120)
    '0000000000000000000001111111111100000111111100000000000', // 4 - Atap Koridor Laser (y: 160)
    '0000000000000000000000000000000000000000000000000000000', // 5
    '0000000000000000000000000000000000000000000000000000000', // 6
    '0000000000000000000000000000000000000000000000000000000', // 7
    '0000000000000000000000000000000000000000000000000000000', // 8
    '0000000000000000000000000000000000000000000000000000000', // 9
    '0000000000000000000000000000000000000000000000000000000', // 10
    '1111111100000000000111000000000000000000000000000000000', // 11 - Spawn Platform (cols 0-7, y: 440) + Dinding Pembatas (cols 19-21, y: 440)
    '1111111100000000000111111111111000000000000000000000000', // 12 - Koridor Laser Atas (cols 19-31, y: 480)
    '1111111100000000010111111111111111111111111111111111111', // 13 - Step col 17 (x: 680) + Lantai Kanan (cols 32-54, y: 520)
    '1111111111111111111111111111111111111111111111111111111', // 14 - Lantai Dasar Ruang Bawah (cols 8-18, y: 560)
  ],
  spawns: [
    { x:  60, y: 390 },
    { x: 100, y: 390 },
    { x: 140, y: 390 },
    { x: 180, y: 390 },
    { x: 220, y: 390 },
  ],
  key : { x: 1860, y: 480 },  // Di lantai col 46 (x: 1860, y: 480)
  door: { x: 2020, y: 448 },  // Pintu Keluar di ujung kanan (x: 2020, y: 448)
  doorW: 48,
  doorH: 72,
  // Rangkaian Laser Sinergi (Seluruhnya Aktif)
  lasers: [
    // 1. Ruang Bawah (Sunken Trench): Laser Horizontal dari dinding samping (x: 330 s/d 750)
    {
      id         : 'laser_h1',
      index      : 0,
      orientation: 'horizontal',
      x          : 330,
      y          : 520,
      w          : 420,
      h          : 16,
      active     : true,
    },
    // 2. Koridor Laser Langit-Langit: Laser Vertikal #1 (x: 940)
    {
      id         : 'laser_v1',
      index      : 1,
      orientation: 'vertical',
      x          : 940,
      y          : 160,
      w          : 16,
      h          : 320,
      active     : true,
    },
    // 3. Koridor Laser Langit-Langit: Laser Vertikal #2 (x: 1120)
    {
      id         : 'laser_v2',
      index      : 2,
      orientation: 'vertical',
      x          : 1120,
      y          : 160,
      w          : 16,
      h          : 320,
      active     : true,
    },
    // 4. Zona Gauntlet Gabungan: Laser Horizontal Samping #2 (x: 1360 s/d 1620)
    {
      id         : 'laser_h2',
      index      : 3,
      orientation: 'horizontal',
      x          : 1360,
      y          : 480,
      w          : 260,
      h          : 16,
      active     : true,
    },
    // 5. Zona Gauntlet Gabungan: Laser Vertikal Atas #3 (x: 1500)
    {
      id         : 'laser_v3',
      index      : 4,
      orientation: 'vertical',
      x          : 1500,
      y          : 160,
      w          : 16,
      h          : 360,
      active     : true,
    },
  ],
  // Tombol Terminal untuk mematikan rintangan laser permanen setelah berhasil dilewati perisai
  buttons: [
    { id: 'btn_off_h1', x: 780,  y: 426, w: 42, h: 14, isLatch: true, laserIndex: 0, label: 'MATIKAN LASER #1' },
    { id: 'btn_off_v1', x: 1220, y: 466, w: 42, h: 14, isLatch: true, laserIndex: 1, label: 'MATIKAN LASER ATAS' },
    { id: 'btn_off_v2', x: 1660, y: 506, w: 42, h: 14, isLatch: true, laserIndex: 3, label: 'MATIKAN GAUNTLET' },
  ],
  boxes       : [],
  bridges     : [],
  gates       : [],
  springboards: [],
};
