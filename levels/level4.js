'use strict';

// ── LEVEL 4: Bouncer (Springboard / Trampolin & High-Air Stacking) ────────────
// Jarak: 3000 px (75 Kolom, 2.5x Panjang Layar)
// Fitur Baru: Bantalan Lompat (Springboard / Trampolin) dengan daya lontar -880 px/s!
// Menggabungkan Peti Berat + Bantalan Lompat + Mekanik Tumpuk di Udara.
// Skala Dinamis: Ketinggian Kunci bertambah tinggi sesuai (playerCount - 1),
// mengharuskan pemain saling bertumpuk saat melambung dari trampolin.

module.exports = {
  id      : 4,
  name    : 'Level 4 – Bouncer',
  worldW  : 3000,
  worldH  : 600,
  tileSize: 40,
  tiles: [
    // 75 kolom per baris
    // 0         1         2         3         4         5         6         7
    // 012345678901234567890123456789012345678901234567890123456789012345678901234
    '000000000000000000000000000000000000000000000000000000000000000000000000000', // 0
    '000000000000000000000000000000000000000000000000000000000000000000000000000', // 1
    '000000000000000000000000000000000000000000000000000000000000000000000000000', // 2
    '000000000000000000000000000000000000000000000000000000000000000000000000000', // 3
    '000000000000000000000000000000000000000000000000000000000000000000000000000', // 4
    '000000000000000000000000000000000000000000000000000000000000000000000000000', // 5
    '000000000000000000000000000000000000000000000000000000000000000000000000000', // 6
    '000000000000000000000000000000000000000000000000000000000000000000000000000', // 7
    '000000000000000000000000000000000000000000000000000000000000000000000000000', // 8
    '000000000000000000001100000000000000000000000000000000000000000000000000000', // 9  - Dinding tinggi 200px di Col 20
    '000000000000000000001100000000000000000000000000000000000000000000000000000', // 10
    '000000000000000000001100000000000000000000000000000000000000000000000000000', // 11
    '000000000000000000001100000000000000000000000000000000000000000000000000000', // 12
    '000000000000000000001100000000000000000000000000000000000000000000000000000', // 13
    '111111111111111111111111111111111111111111111111000000111111111111111111111', // 14 - Jurang di Col 48-53
  ],
  spawns: [
    { x:  60, y: 500 },
    { x: 100, y: 500 },
    { x: 140, y: 500 },
    { x: 180, y: 500 },
    { x: 220, y: 500 },
  ],
  // Posisi kunci dinamis: melayang tinggi di atas zona trampolin kedua
  key : { x: 1680, y: 240 },
  keyFormula: (pCount) => ({
    x: 1680,
    y: Math.max(90, 270 - (pCount - 1) * 40),
  }),
  door: { x: 2880, y: 480 },
  doorW: 48,
  doorH: 72,
  // Bantalan Lompat (Springboards / Trampolin)
  springboards: [
    // Trampolin 1: di x: 620 (untuk melompati tembok 200px di x: 800)
    { id: 'spring_1', x: 620, y: 546, w: 48, h: 14, bounceForce: -880 },
    // Trampolin 2: di x: 1660 (di bawah kunci melayang tinggi)
    { id: 'spring_2', x: 1660, y: 546, w: 54, h: 14, bounceForce: -920 },
    // Trampolin 3: di x: 1860 (untuk melompati jurang maut di x: 1920)
    { id: 'spring_3', x: 1860, y: 546, w: 48, h: 14, bounceForce: -840 },
  ],
  boxes: [
    // Peti di Stage 2 yang harus didorong ke dekat trampolin kedua
    {
      id: 'box_bouncer_1',
      x: 1300,
      y: 504,
      w: 56,
      h: 56,
      vx: 0,
      vy: 0,
      onGround: true,
      minPushersFormula: (pCount) => Math.max(1, pCount - 1),
    }
  ],
  buttons: [],
  bridges: [],
  lasers : [],
};
