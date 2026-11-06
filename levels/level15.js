'use strict';

// ── LEVEL 15: Lights Out (Darkness & Torch Navigation) ────────────────────────
// Jarak: 2400 px (60 Kolom, 2.0x Panjang Layar)
// Fitur Baru: Darkness (Kegelapan Pekat) & Torch (Obor).
// - Ruangan gelap gulita dengan sistem Fog of War Canvas.
// - Obor berada di titik awal (x: 280, y: 510). Karakter yang menyentuhnya akan membawanya.
// - Pembawa obor memancarkan lubang cahaya transparan (radial gradient) seluas 230 px.
// PUZZLE & KERJASAMA:
// - Lantai dipenuhi duri mematikan (laser spike traps) yang tidak terlihat dalam gelap.
// - Si pembawa obor wajib berjalan hati-hati di depan memandu kawan-kawannya.
// - Kawan-kawan harus tetap berada di dalam radius cahaya obor agar tidak terinjak jebakan.

module.exports = {
  id      : 15,
  name    : 'Level 15 – Lights Out',
  worldW  : 2400,
  worldH  : 600,
  tileSize: 40,
  darkness: {
    enabled      : true,
    ambientRadius: 50,
    torchRadius  : 230,
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
    '000000000000000000111000000001110000000011100000000000000000', // 12 - Platform lompat aman (18-20), (29-31), (40-42) setinggi 80px
    '000000000000000000000000000000000000000000000000000000000000', // 13
    '111111111100011110000000111100000001111000000011111111111111', // 14 - Celah lantai dengan jebakan duri
  ],
  spawns: [
    { x:  80, y: 500 },
    { x: 120, y: 500 },
    { x: 160, y: 500 },
    { x: 200, y: 500 },
    { x: 240, y: 500 },
  ],
  // Obor yang bisa diambil dan dibawa
  torches: [
    { id: 'torch_lvl15', x: 280, y: 510 },
  ],
  key : { x: 1960, y: 500 },
  door: { x: 2260, y: 488 },
  doorW: 48,
  doorH: 72,
  // Duri mematikan di celah kegelapan
  lasers: [
    { id: 'spike_1', x: 400,  y: 574, w: 120, h: 18, orientation: 'horizontal', active: true },
    { id: 'spike_2', x: 680,  y: 574, w: 280, h: 18, orientation: 'horizontal', active: true },
    { id: 'spike_3', x: 1120, y: 574, w: 280, h: 18, orientation: 'horizontal', active: true },
    { id: 'spike_4', x: 1560, y: 574, w: 280, h: 18, orientation: 'horizontal', active: true },
  ],
  buttons     : [],
  bridges     : [],
  boxes       : [],
  springboards: [],
};

