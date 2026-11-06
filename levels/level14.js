'use strict';

// ── LEVEL 14: Tangled (Tether Chain & Acid Gap) ───────────────────────────────
// Jarak: 2400 px (60 Kolom, 2.0x Panjang Layar)
// Fitur Baru: Tether (Tali Kematian).
// - Seluruh pemain diikat menjadi satu rantai (P1 - P2 - P3 - dst).
// - Jarak antar pemain tidak boleh melebihi maxDistance (170 px).
// - Jika satu pemain jatuh ke jurang asam, gaya jatuh akan menyeret rekan yang terikat!
// PUZZLE & KERJASAMA:
// - Melewati pilar-pilar batu di atas danau asam maut.
// - Seluruh rekan harus melompat secara kompak dan seirama agar tali tidak tegang dan
//   menarik kawan dari pilar.
// - Terdapat pulau istirahat di tengah (x: 1040 - 1200) untuk konsolidasi tim sebelum
//   melompat ke dermaga seberang.

module.exports = {
  id       : 14,
  name     : 'Level 14 – Tangled',
  worldW   : 2400,
  worldH   : 600,
  tileSize : 40,
  hasTether: true,
  tether   : {
    maxDistance: 170,
    stiffness  : 300,
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
    '000000000000000000000000000000000000000000000000000000000000', // 10
    '000000000000000000000000000000000000000000000000000000000000', // 11
    '111111111110001110001110001111000111000111000111000111111111', // 12 - Pilar konsisten 120px gap, semua dapat dilompati
    '111111111110001110001110001111000111000111000111000111111111', // 13
    '111111111110001110001110001111000111000111000111000111111111', // 14 - Danau Asam di bawah
  ],
  spawns: [
    { x:  80, y: 420 },
    { x: 130, y: 420 },
    { x: 180, y: 420 },
    { x: 230, y: 420 },
    { x: 280, y: 420 },
  ],
  key : { x: 2100, y: 420 },
  door: { x: 2280, y: 408 },
  doorW: 48,
  doorH: 72,
  // Laser Bahaya Danau Asam di dasar jurang
  lasers: [
    {
      id         : 'laser_acid_tangled',
      x          : 440,
      y          : 576,
      w          : 1600,
      h          : 16,
      orientation: 'horizontal',
      active     : true,
    },
  ],
  buttons     : [],
  bridges     : [],
  boxes       : [],
  springboards: [],
};

