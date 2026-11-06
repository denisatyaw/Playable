'use strict';

// ── LEVEL 8: Moving Ferry (Electric Ferry & Chasm Crossing) ───────────────────
// Jarak: 2400 px (60 Kolom, 2.0x Panjang Layar)
// Fitur: Feri Pengangkut Listrik (Moving Ferry Platform) yang berpatroli bolak-balik
//        melintasi jurang maut selebar 1160 px!
// SKALA KESULITAN DINAMIS (DDS):
// - Lebar Feri Pengangkut diatur dinamis sesuai jumlah pemain (wFormula: 50 + pCount * 38).
// - Seluruh rekan tim harus kompak berdiri di atas feri dan menjaga keseimbangan saat menyeberang.
// PENCEGAHAN SOFTLOCK & ANTI-STRAND:
// - Di dermaga kanan (x: 1720) terdapat tombol kait darurat [JEMBATAN DARURAT].
// - Saat salah satu kawan berhasil mendarat di seberang dan menginjak tombol ini,
//   sebuah jembatan darurat raksasa membentang menutupi seluruh jurang!
// - Kawan yang sempat jatuh atau tertinggal dapat langsung berlari menyeberang jembatan dengan aman!

module.exports = {
  id      : 8,
  name    : 'Level 8 – Moving Ferry',
  worldW  : 2400,
  worldH  : 600,
  tileSize: 40,
  tiles   : [
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
    '111111111111000000000000000000000000000001111111111111111111', // 12 - Dermaga Kiri (cols 0-11) & Kanan (cols 41-59, y: 480)
    '111111111111000000000000000000000000000001111111111111111111', // 13
    '111111111111000000000000000000000000000001111111111111111111', // 14 - Jurang di cols 12-40 (x: 480-1640)
  ],
  spawns: [
    { x:  80, y: 420 },
    { x: 120, y: 420 },
    { x: 160, y: 420 },
    { x: 200, y: 420 },
    { x: 240, y: 420 },
  ],
  key : { x: 1980, y: 380 },
  door: { x: 2260, y: 408 },
  doorW: 48,
  doorH: 72,
  // Feri Pengangkut Listrik
  movingPlatforms: [
    {
      id      : 'ferry_main',
      x       : 480,
      y       : 480,
      w       : 130,
      h       : 18,
      minX    : 470,
      maxX    : 1510,
      speed   : 90,
      dir     : 1,
      label   : 'FERI PENGANGKUT',
      wFormula: (pCount) => 50 + (pCount * 38),
    },
  ],
  // Tombol Jembatan Darurat di Dermaga Kanan
  buttons: [
    {
      id     : 'btn_ferry_safety',
      x      : 1720,
      y      : 466,
      w      : 44,
      h      : 14,
      isLatch: true,
      group  : 1,
      label  : 'JEMBATAN DARURAT',
    },
  ],
  // Jembatan Darurat yang membentang jika tombol darurat diinjak
  bridges: [
    {
      id     : 'bridge_ferry_safety',
      x      : 480,
      y      : 480,
      w      : 1160,
      h      : 14,
      group  : 1,
      active : false,
      latched: false,
    },
  ],
  // Laser Bahaya di dasar jurang
  lasers: [
    {
      id         : 'laser_ferry_pit',
      x          : 480,
      y          : 574,
      w          : 1160,
      h          : 18,
      orientation: 'horizontal',
      active     : true,
    },
  ],
  boxes       : [],
  gates       : [],
  springboards: [],
};

