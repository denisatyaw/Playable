'use strict';

// ── LEVEL 5: Sacrifice & Trust (Laser Corridor & Ultimate Team Trust) ────────
// Jarak: 3200 px (80 Kolom, 2.7x Panjang Layar)
// Fitur: Rintangan Laser Mematikan (Deadly Laser Grid).
// Konsep: Lorong sempit dijaga lapis laser bertegangan tinggi.
// Skala Dinamis: Jumlah lapis laser dan tombol penahannya otomatis = (playerCount - 1).
// (playerCount - 1) rekan harus berdiri mengorbankan diri menahan tombol di Ruang Kontrol,
// sementara 1 rekan yang dipercaya (Runner) menyeberangi lorong berbahaya untuk mengambil kunci.
// ANTI-STRAND PENCEGAHAN:
// Lantai terowongan dan luar lorong dibuat rata dan solid tanpa jurang maut tak terseberangi.
// Begitu Kunci Emas diambil oleh sang Runner:
// SELURUH LASER MATI PERMANEN! Seluruh tim di Ruang Kontrol bisa langsung berlari bersama menuju Pintu Keluar!

module.exports = {
  id      : 5,
  name    : 'Level 5 – Sacrifice & Trust',
  worldW  : 3200,
  worldH  : 600,
  tileSize: 40,
  tiles: [
    // 80 kolom per baris
    // 0         1         2         3         4         5         6         7
    // 01234567890123456789012345678901234567890123456789012345678901234567890123456789
    '00000000000000000000000000000000000000000000000000000000000000000000000000000000', // 0
    '00000000000000000000000000000000000000000000000000000000000000000000000000000000', // 1
    '00000000000000000000000000000000000000000000000000000000000000000000000000000000', // 2
    '00000000000000000000000000000000000000000000000000000000000000000000000000000000', // 3
    '00000000000000000000000000000000000000000000000000000000000111100000000000000000', // 4
    '00000000000000000000000000000000000000000000000000000000000000000000000000000000', // 5
    '00000000000000000000000000000000000000000000000000000001111000000000000000000000', // 6 - Kunci di x: 2360
    '00000000000000000000000000000000000000000000000000000000000000000000000000000000', // 7
    '00000000000000000000000000000000000000000000000000001111000000000000000000000000', // 8 - Platform perantara
    '00000000000000000000000000000000000000000000000000000000000000000000000000000000', // 9
    '00000000000000000000111111111111111111111111100000000000000000000000000000000000', // 10 - Atap terowongan laser (Col 20-44)
    '00000000000000000000000000000000000000000000000000000000000000000000000000000000', // 11
    '00000000000000000000000000000000000000000000000000000000000000000000000000000000', // 12
    '00000000000000000000000000000000000000000000000000000000000000000000000000000000', // 13
    '11111111111111111111111111111111111111111111111111111111111111111111111111111111', // 14 - Lantai Solid Mulus (80 Kolom)
  ],
  spawns: [
    { x:  60, y: 500 },
    { x: 100, y: 500 },
    { x: 140, y: 500 },
    { x: 180, y: 500 },
    { x: 220, y: 500 },
  ],
  key : { x: 2360, y: 210 },  // Di atas platform baris 6 (x: 2360)
  door: { x: 3080, y: 480 },  // Di ujung paling kanan di lantai (x: 3080)
  doorW: 48,
  doorH: 72,
  // 4 Tombol Kontrol di Ruang Kendali Awal (x: 280 s/d 640)
  buttons: [
    { id: 'btn_laser_0', x: 280, y: 546, w: 38, h: 14, index: 0, laserIndex: 0, label: 'LASER #1' },
    { id: 'btn_laser_1', x: 400, y: 546, w: 38, h: 14, index: 1, laserIndex: 1, label: 'LASER #2' },
    { id: 'btn_laser_2', x: 520, y: 546, w: 38, h: 14, index: 2, laserIndex: 2, label: 'LASER #3' },
    { id: 'btn_laser_3', x: 640, y: 546, w: 38, h: 14, index: 3, laserIndex: 3, label: 'LASER #4' },
  ],
  // 4 Lapis Laser di dalam Terowongan Sempit (x: 960 s/d 1680)
  lasers: [
    { id: 'laser_0', x: 960,  y: 440, w: 12, h: 120, index: 0, active: true },
    { id: 'laser_1', x: 1200, y: 440, w: 12, h: 120, index: 1, active: true },
    { id: 'laser_2', x: 1440, y: 440, w: 12, h: 120, index: 2, active: true },
    { id: 'laser_3', x: 1680, y: 440, w: 12, h: 120, index: 3, active: true },
  ],
  // Bantalan Lompat di x: 1880 (di lantai luar terowongan) untuk melambung ke platform Kunci
  springboards: [
    { id: 'spring_vault', x: 1880, y: 546, w: 50, h: 14, bounceForce: -900 },
  ],
  boxes  : [],
  bridges: [],
  gates  : [],
};
