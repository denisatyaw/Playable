'use strict';

// ── LEVEL 9: Trap Switch (Dual Parallel Paths & Co-op Coordination) ───────────
// Jarak: 2400 px (60 Kolom, 2.0x Panjang Layar)
// Fitur: Jalur Ganda Paralel (Upper Runway & Lower Control Floor).
// MEKANIK & SKALA KESULITAN DINAMIS (DDS):
// - Satu pemain bertindak sebagai Pelari (The Runner) di jalur atas (y: 320).
// - Rekan tim lainnya berada di lantai bawah (y: 560), menginjak tombol lantai masing-masing:
//   * Tombol #1 (x: 740)  -> Mengaktifkan Jembatan Atas #1 (minPlayers: 2)
//   * Tombol #2 (x: 1060) -> Mengaktifkan Jembatan Atas #2 (minPlayers: 3)
//   * Tombol #3 (x: 1380) -> Mengaktifkan Jembatan Atas #3 (minPlayers: 4)
//   * Tombol #4 (x: 1700) -> Mengaktifkan Jembatan Atas #4 (minPlayers: 5)
// - Jumlah jembatan dan tombol beradaptasi otomatis sesuai playerCount (DDS).
// PENCEGAHAN SOFTLOCK & ANTI-STRAND:
// - Di ujung jalur atas (x: 1850) terdapat tombol master [BUKA GERBANG BAWAH & TANGGA].
// - Saat diinjak oleh Pelari, Gerbang Bawah terbuka permanen dan tangga turun membentang,
//   sehingga seluruh rekan di lantai bawah bisa langsung berkumpul menuju Kunci dan Pintu Keluar!

module.exports = {
  id      : 9,
  name    : 'Level 9 – Trap Switch',
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
    // Row 8 (y: 320): Jalur Atas Pelari
    '000000000000011110000111100001111000011110000111000000000000', // 8  - Platform + 4 Celah Jembatan
    '000000000001000000000000000000000000000000000000110000000000', // 9  - Tangga naik col 11 & Dinding atas Gerbang Bawah (col 47-48)
    '000000000010000000000000000000000000000000000000110000000000', // 10 - Tangga naik col 10
    '000000000100000000000000000000000000000000000000110000000000', // 11 - Tangga naik col 9
    '000000001000000000000000000000000000000000000000000000000000', // 12 - Tangga naik col 8 & Gerbang Bawah (col 47-48)
    '000000000000000000000000000000000000000000000000000000000000', // 13 - Gerbang Bawah (col 47-48)
    '111111111111111111111111111111111111111111111111111111111111', // 14 - Lantai Bawah Solid Penuh (y: 560)
  ],
  spawns: [
    { x:  80, y: 500 },
    { x: 120, y: 500 },
    { x: 160, y: 500 },
    { x: 200, y: 500 },
    { x: 240, y: 500 },
  ],
  key : { x: 2060, y: 500 },
  door: { x: 2280, y: 488 },
  doorW: 48,
  doorH: 72,
  // 4 Jembatan Jalur Atas (Panjang masing-masing 160 px, y: 320)
  bridges: [
    {
      id        : 'bridge_trap_1',
      x         : 680,
      y         : 320,
      w         : 160,
      h         : 14,
      group     : 10,
      minPlayers: 2,
      active    : false,
      latched   : false,
    },
    {
      id        : 'bridge_trap_2',
      x         : 1000,
      y         : 320,
      w         : 160,
      h         : 14,
      group     : 20,
      minPlayers: 3,
      active    : false,
      latched   : false,
    },
    {
      id        : 'bridge_trap_3',
      x         : 1320,
      y         : 320,
      w         : 160,
      h         : 14,
      group     : 30,
      minPlayers: 4,
      active    : false,
      latched   : false,
    },
    {
      id        : 'bridge_trap_4',
      x         : 1640,
      y         : 320,
      w         : 160,
      h         : 14,
      group     : 40,
      minPlayers: 5,
      active    : false,
      latched   : false,
    },
    // Jembatan Tangga Turun yang membentang saat tombol master diinjak
    {
      id        : 'bridge_trap_stairs',
      x         : 1880,
      y         : 420,
      w         : 120,
      h         : 14,
      group     : 99,
      active    : false,
      latched   : false,
    },
  ],
  // 4 Tombol di Lantai Bawah + 1 Tombol Master di Jalur Atas
  buttons: [
    {
      id        : 'btn_trap_low_1',
      x         : 740,
      y         : 546,
      w         : 44,
      h         : 14,
      index     : 0,
      group     : 10,
      minPlayers: 2,
      label     : 'SAKLAR JALUR #1',
    },
    {
      id        : 'btn_trap_low_2',
      x         : 1060,
      y         : 546,
      w         : 44,
      h         : 14,
      index     : 1,
      group     : 20,
      minPlayers: 3,
      label     : 'SAKLAR JALUR #2',
    },
    {
      id        : 'btn_trap_low_3',
      x         : 1380,
      y         : 546,
      w         : 44,
      h         : 14,
      index     : 2,
      group     : 30,
      minPlayers: 4,
      label     : 'SAKLAR JALUR #3',
    },
    {
      id        : 'btn_trap_low_4',
      x         : 1700,
      y         : 546,
      w         : 44,
      h         : 14,
      index     : 3,
      group     : 40,
      minPlayers: 5,
      label     : 'SAKLAR JALUR #4',
    },
    // Tombol Master Latch di ujung Jalur Atas
    {
      id     : 'btn_trap_reunite',
      x      : 1840,
      y      : 306,
      w      : 44,
      h      : 14,
      isLatch: true,
      gateId : 'gate_trap_lower',
      group  : 99,
      label  : 'BUKA GERBANG BAWAH & TANGGA',
    },
  ],
  gates: [
    // Gerbang Bawah yang menghalangi jalan ke ruang kunci
    {
      id   : 'gate_trap_lower',
      x    : 1880,
      y    : 480,
      w    : 80,
      h    : 80,
      label: 'GERBANG BAWAH',
    },
  ],
  boxes       : [],
  lasers      : [],
  springboards: [],
};

