'use strict';

// ── LEVEL 6: The Tower (Tower Stacking & Anti-Strand Gates) ───────────────────
// Jarak: 2200 px (55 Kolom, 1.8x Panjang Layar)
// Fitur: Kerjasama Tumpuk Menara Manusia (Pure Stacking) tanpa tangga pembantu.
// FORMULA KETINGGIAN KUNCI (DDS):
// Ketinggian Kunci disesuaikan secara dinamis dengan jumlah pemain (playerCount).
// Agar kunci dapat diraih, seluruh pemain harus bertumpuk menara saling menopang!
// Pemain terbawah dapat berjalan membawa seluruh menara di kepalanya (Tower Carrying).
// PENCEGAHAN SOFTLOCK & ANTI-STRAND:
// 1. Tembok Pembatas 1 (x: 720) memiliki Gerbang Bawah. Rekan yang berhasil naik ke atas
//    cukup menginjak tombol kait [BUKA GERBANG DINDING] agar kawan di bawah bisa lewat!
// 2. Tembok Pembatas 2 (x: 1680) memiliki Gerbang Keluar dengan tombol kait di puncaknya.
// 3. Seluruh gerbang juga otomatis terbuka permanen begitu Kunci berhasil diraih!

module.exports = {
  id      : 6,
  name    : 'Level 6 – The Tower',
  worldW  : 2200,
  worldH  : 600,
  tileSize: 40,
  tiles   : [
    // 55 kolom per baris (0=udara, 1=solid)
    // 0         1         2         3         4         5
    // 0123456789012345678901234567890123456789012345678901234
    '0000000000000000000000000000000000000000000000000000000', // 0
    '0000000000000000000000000000000000000000000000000000000', // 1
    '0000000000000000000000000000000000000000000000000000000', // 2
    '0000000000000000000000000000000000000000000000000000000', // 3
    '0000000000000000000000000000000000000000000000000000000', // 4
    '0000000000000000000000000000000000000000000000000000000', // 5
    '0000000000000000000000000000000000000000000000000000000', // 6
    '0000000000000000000000000000000000000000000000000000000', // 7
    '0000000000000000000000000000000000000000001100000000000', // 8  - Puncak Dinding 2 (col 42-43, y: 320)
    '0000000000000000001100000000000000000000001100000000000', // 9  - Puncak Dinding 1 (col 18-19, y: 360)
    '0000000000000000001100000000000000000000001100000000000', // 10
    '0000000000000000001100000000000000000000001100000000000', // 11
    '0000000000000000000000000000000000000000000000000000000', // 12 - Gerbang 1 (col 18-19) & Gerbang 2 (col 42-43)
    '0000000000000000000000000000000000000000000000000000000', // 13 - Gerbang 1 & 2
    '1111111111111111111111111111111111111111111111111111111', // 14 - Lantai Solid Penuh (y: 560)
  ],
  spawns: [
    { x:  80, y: 500 },
    { x: 120, y: 500 },
    { x: 160, y: 500 },
    { x: 200, y: 500 },
    { x: 240, y: 500 },
  ],
  key: { x: 1220, y: 380 },
  // Skala Dinamis: Kunci harus diraih dengan tumpukan menara setinggi seluruh pemain
  keyFormula: (pCount) => ({
    x: 1220,
    y: Math.max(80, 560 - (pCount * 36) - 55),
  }),
  door: { x: 2040, y: 488 },
  doorW: 48,
  doorH: 72,
  gates: [
    // Gerbang bawah dinding pembatas 1
    {
      id   : 'gate_tower_wall1',
      x    : 720,
      y    : 480,
      w    : 80,
      h    : 80,
      label: 'GERBANG DINDING',
    },
    // Gerbang bawah dinding pembatas 2
    {
      id   : 'gate_tower_wall2',
      x    : 1680,
      y    : 480,
      w    : 80,
      h    : 80,
      label: 'GERBANG KELUAR',
    },
  ],
  buttons: [
    // Tombol di puncak Dinding 1
    {
      id     : 'btn_tower_wall1',
      x      : 738,
      y      : 346,
      w      : 44,
      h      : 14,
      isLatch: true,
      gateId : 'gate_tower_wall1',
      label  : 'BUKA GERBANG 1',
    },
    // Tombol di puncak Dinding 2
    {
      id     : 'btn_tower_wall2',
      x      : 1698,
      y      : 306,
      w      : 44,
      h      : 14,
      isLatch: true,
      gateId : 'gate_tower_wall2',
      label  : 'BUKA GERBANG 2',
    },
  ],
  bridges     : [],
  boxes       : [],
  lasers      : [],
  springboards: [],
};

