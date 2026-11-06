'use strict';

// ── LEVEL 12: The Balance (Seesaw Co-op & Tilt Physics) ───────────────────────
// Jarak: 1800 px (45 Kolom, 1.5x Panjang Layar)
// Fitur Baru: Timbangan Raksasa (Seesaw).
// - Platform horizontal dengan poros di tengah (pivotX: 800, pivotY: 480, length: 900).
// - Titik tumpu membentang langsung dari tepi tebing kiri (x: 360) ke tebing kanan (x: 1240).
// - Dipengaruhi oleh massa: jumlah pemain di sisi kiri vs kanan menentukan kemiringan.
// - Jika kemiringan terlalu ekstrem (> 9.5°), pemain di atasnya akan merosot (slide).
// PUZZLE & CARA MENANG:
// - Kunci emas melayang tinggi di udara sebelah kanan (x: 1100, y: 240).
// - Pemain di kiri menahan timbangan agar ujung kanan terangkat tinggi ke angkasa.
// - Rekan di kanan melompat meraih Kunci Emas, lalu mendarat di tebing kanan (x: 1240).
// - Di tebing kanan terdapat tombol [JEMBATAN BANTUAN] di x: 1320 yang membentangkan jembatan
//   otomatis agar seluruh rekan bisa menyeberang dengan santai ke Pintu Keluar.

module.exports = {
  id      : 12,
  name    : 'Level 12 – The Balance',
  worldW  : 1800,
  worldH  : 600,
  tileSize: 40,
  tiles   : [
    // 45 kolom per baris (0=udara, 1=solid)
    // 0         1         2         3         4
    // 012345678901234567890123456789012345678901234
    '000000000000000000000000000000000000000000000', // 0
    '000000000000000000000000000000000000000000000', // 1
    '000000000000000000000000000000000000000000000', // 2
    '000000000000000000000000000000000000000000000', // 3
    '000000000000000000000000000000000000000000000', // 4
    '000000000000000000000000000000000000000000000', // 5
    '000000000000000000000000000000000000000000000', // 6
    '000000000000000000000000000000000000000000000', // 7
    '000000000000000000000000000000000000000000000', // 8
    '000000000000000000000000000000000000000000000', // 9
    '000000000000000000000000000000000000000000000', // 10
    '000000000000000000000000000000000000000000000', // 11
    '111111111000000000011000000000011111111111111', // 12 - Tebing Kiri (0-8), Pivot Rock (19-20), Tebing Kanan (31-44)
    '111111111000000000011000000000011111111111111', // 13
    '111111111000000000011000000000011111111111111', // 14
  ],
  spawns: [
    { x: 100, y: 420 },
    { x: 150, y: 420 },
    { x: 200, y: 420 },
    { x: 250, y: 420 },
    { x: 300, y: 420 },
  ],
  // Timbangan Raksasa Langsung Menghubungkan Tebing Kiri dan Kanan
  seesaws: [
    {
      id       : 'seesaw_balance',
      pivotX   : 800,
      pivotY   : 480,
      length   : 900,
      thickness: 16,
      maxAngle : 0.35,
    },
  ],
  key : { x: 1100, y: 240 },
  door: { x: 1620, y: 408 },
  doorW: 48,
  doorH: 72,
  buttons: [
    {
      id     : 'btn_balance_bridge',
      x      : 1320,
      y      : 466,
      w      : 44,
      h      : 14,
      isLatch: true,
      group  : 1,
      label  : 'JEMBATAN BANTUAN',
    },
  ],
  bridges: [
    {
      id          : 'bridge_balance_safety',
      x           : 360,
      y           : 480,
      w           : 880,
      h           : 14,
      group       : 1,
      hideInactive: true,
      active      : false,
      latched     : false,
    },
  ],
  boxes       : [],
  gates       : [],
  lasers      : [],
  springboards: [],
};
