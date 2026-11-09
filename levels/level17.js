'use strict';

// ── LEVEL 17: Leap of Faith (Invisible Solid & Dual Relay) ────────────────────
// Jarak: 2600 px (65 Kolom, 2.1x Panjang Layar)
// Fitur Baru: Invisible Solid (Lantai Ilusi).
// - Platform yang memiliki hitbox solid (dapat diinjak), namun grafisnya disembunyikan.
// - Lantai ilusi hanya akan terlihat menyala HANYA ketika saklar penunjuk sedang diinjak!
// PUZZLE & KERJASAMA:
// - Jurang luas membentang dari x: 640 hingga x: 1840.
// - Tombol A (x: 580) di dermaga awal menyalakan batu-batu ilusi transparan.
// - Pemain 1 menahan Tombol A agar teman-temannya bisa menyeberang melihat jalurnya.
// - Begitu tiba di seberang, kawan menginjak Tombol B (x: 1920) untuk menyalakan lantai ilusi
//   bagi Pemain 1 agar bisa menyusul menyeberang dengan aman!

module.exports = {
  id      : 17,
  name    : 'Level 17 – Leap of Faith',
  worldW  : 2600,
  worldH  : 600,
  tileSize: 40,
  tiles   : [
    // 65 kolom per baris (0=udara, 1=solid)
    // 0         1         2         3         4         5         6
    // 01234567890123456789012345678901234567890123456789012345678901234
    '00000000000000000000000000000000000000000000000000000000000000000', // 0
    '00000000000000000000000000000000000000000000000000000000000000000', // 1
    '00000000000000000000000000000000000000000000000000000000000000000', // 2
    '00000000000000000000000000000000000000000000000000000000000000000', // 3
    '00000000000000000000000000000000000000000000000000000000000000000', // 4
    '00000000000000000000000000000000000000000000000000000000000000000', // 5
    '00000000000000000000000000000000000000000000000000000000000000000', // 6
    '00000000000000000000000000000000000000000000000000000000000000000', // 7
    '00000000000000000000000000000000000000000000000000000000000000000', // 8
    '00000000000000000000000000000000000000000000000000000000000000000', // 9
    '00000000000000000000000000000000000000000000000000000000000000000', // 10
    '00000000000000000000000000000000000000000000000000000000000000000', // 11
    '00000000000000000000000000000000000000000000000000000000000000000', // 12
    '00000000000000000000000000000000000000000000000000000000000000000', // 13
    '11111111111111110000000000000000000000000000001111111111111111111', // 14 - Dermaga Kiri (0-15) & Kanan (46-64)
  ],
  spawns: [
    { x:  80, y: 500 },
    { x: 120, y: 500 },
    { x: 160, y: 500 },
    { x: 200, y: 500 },
    { x: 240, y: 500 },
  ],
  // 6 Batu Pijakan Ilusi (Solid Hitbox, Muncul Saat Tombol A atau B Diinjak)
  invisiblePlatforms: [
    { id: 'inv_faith_1', x: 680,  y: 530, w: 90, h: 20, revealButtonIds: ['btn_faith_a', 'btn_faith_b'] },
    { id: 'inv_faith_2', x: 880,  y: 490, w: 90, h: 20, revealButtonIds: ['btn_faith_a', 'btn_faith_b'] },
    { id: 'inv_faith_3', x: 1080, y: 460, w: 90, h: 20, revealButtonIds: ['btn_faith_a', 'btn_faith_b'] },
    { id: 'inv_faith_4', x: 1280, y: 490, w: 90, h: 20, revealButtonIds: ['btn_faith_a', 'btn_faith_b'] },
    { id: 'inv_faith_5', x: 1480, y: 520, w: 90, h: 20, revealButtonIds: ['btn_faith_a', 'btn_faith_b'] },
    { id: 'inv_faith_6', x: 1680, y: 530, w: 90, h: 20, revealButtonIds: ['btn_faith_a', 'btn_faith_b'] },
  ],
  key : { x: 2150, y: 500 },
  door: { x: 2440, y: 488 },
  doorW: 48,
  doorH: 72,
  buttons: [
    // Tombol A di Dermaga Awal (Menyalakan Lantai Ilusi)
    {
      id     : 'btn_faith_a',
      x      : 580,
      y      : 546,
      w      : 44,
      h      : 14,
      label  : 'SAKLAR ILUSI A',
    },
    // Tombol B di Dermaga Seberang (Juga Menyalakan Lantai Ilusi)
    {
      id     : 'btn_faith_b',
      x      : 1920,
      y      : 546,
      w      : 44,
      h      : 14,
      label  : 'SAKLAR ILUSI B',
    },
  ],
  bridges     : [],
  boxes       : [],
  gates       : [],
  lasers      : [],
  springboards: [],
};

