'use strict';

// ── LEVEL 11: The Great Divide (Human Slingshot Co-op) ───────────────────────
// Jarak: 2800 px (70 Kolom, 2.3x Panjang Layar)
// MEKANIK BARU: KETAPEL MANUSIA (HUMAN SLINGSHOT)
// - Titik Awal (Kiri): Tebing aman dengan Ketapel Raksasa tertanam di lantai (x: 360).
// - State 'Ammo': Pemain yang masuk ke kantong ketapel terkunci sebagai peluru.
// - State 'Launcher': Rekan di belakang menahan tombol kiri [A / ←] untuk menarik ketapel (0 - 3s).
// - Parabolic Launch: Saat dilepas, peluru terlontar melengkung (parabola) menyeberangi jurang maut!
// JURANG RAKSASA (THE GAP):
// - Jurang selebar 1320 px (x: 520 s/d 1840). Mustahil dilompati tanpa ketapel!
// TEBING KANAN & PUZZLE:
// - Tebing kanan memiliki platform bertingkat (Ledge 1 s/d 3 & Peak) dengan Tombol di tiap tingkatan.
// - Skala Dinamis (playerCount - 1): Jumlah tombol aktif menyesuaikan jumlah kawan yang dilontarkan.
// - Ketika semua kawan yang mendarat menginjak tombol masing-masing secara bersamaan:
//   JEMBATAN RAKSASA membentang melintasi jurang 1320 px dan terkunci otomatis!
// - Sang Penembak ("Sang Tumbal") di tebing kiri bisa berjalan santai menyeberang jembatan!
// - Seluruh pemain berkumpul di puncak, mengambil Kunci, dan masuk Pintu Keluar bersama!

module.exports = {
  id      : 11,
  name    : 'Level 11 – The Great Divide',
  worldW  : 2800,
  worldH  : 600,
  tileSize: 40,
  tiles: [
    // 70 kolom per baris
    // 0         1         2         3         4         5         6
    // 0123456789012345678901234567890123456789012345678901234567890123456789
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 0
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 1
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 2
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 3
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 4
    '0000000000000000000000000000000000000000000000000000000000000001111110', // 5 - Peak (cols 63-68, y: 200)
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 6
    '0000000000000000000000000000000000000000000000000000000000011110000000', // 7 - Ledge 3 (cols 59-62, y: 280)
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 8
    '0000000000000000000000000000000000000000000000000000001111000000000000', // 9 - Ledge 2 (cols 54-57, y: 360)
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 10
    '0000000000000000000000000000000000000000000000001111100000000000000000', // 11 - Ledge 1 (cols 48-52, y: 440)
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 12
    '0000000000000000000000000000000000000000000000110000000000000000000000', // 13 - Step dari Jembatan ke Ledge 1 (cols 46-47, y: 520)
    // Lantai: Tebing Kiri (cols 0-12) + Jurang Raksasa (cols 13-45) + Tebing Kanan (cols 46-69)
    '1111111111111000000000000000000000000000000000111111111111111111111111', // 14 (y: 560)
  ],
  spawns: [
    { x:  80, y: 500 },
    { x: 120, y: 500 },
    { x: 160, y: 500 },
    { x: 200, y: 500 },
    { x: 240, y: 500 },
  ],
  // Ketapel Manusia di Tebing Kiri
  slingshot: {
    id        : 'slingshot_divide',
    x         : 360,
    y         : 490,
    w         : 48,
    h         : 70,
    pouchX    : 360,
    pouchY    : 524,
    maxTension: 3.0,
  },
  key : { x: 2650, y: 160 },  // Kunci di Peak (y: 160 di atas row 5)
  door: { x: 2710, y: 128 },  // Pintu Keluar di Peak (y: 128 di atas row 5)
  doorW: 48,
  doorH: 72,
  // 4 Tombol Bertingkat di Tebing Kanan (Syarat aktif = playerCount - 1)
  buttons: [
    { id: 'btn_divide_0', x: 1980, y: 426, w: 42, h: 14, index: 0, group: 1, label: 'TOMBOL LEDGE #1' },
    { id: 'btn_divide_1', x: 2200, y: 346, w: 42, h: 14, index: 1, group: 1, label: 'TOMBOL LEDGE #2' },
    { id: 'btn_divide_2', x: 2400, y: 266, w: 42, h: 14, index: 2, group: 1, label: 'TOMBOL LEDGE #3' },
    { id: 'btn_divide_3', x: 2560, y: 186, w: 42, h: 14, index: 3, group: 1, label: 'TOMBOL PUNCAK' },
  ],
  // Jembatan Raksasa yang membentang saat seluruh kawan di tebing kanan menginjak tombol
  bridges: [
    {
      id     : 'bridge_great_divide',
      x      : 520,
      y      : 546,
      w      : 1320,
      h      : 14,
      group  : 1,
      active : false,
      latched: false,
    }
  ],
  boxes       : [],
  gates       : [],
  lasers      : [],
  springboards: [],
};
