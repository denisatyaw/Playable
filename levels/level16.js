'use strict';

// ── LEVEL 16: Hamster Power (Generator Wheel & Sky Elevator) ──────────────────
// Jarak: 2600 px (65 Kolom, 2.1x Panjang Layar)
// Fitur Baru: Generator Wheel (Roda Hamster).
// - Area roda berongga (x: 680, y: 500). Pemain yang berlari di dalamnya akan mengisi tenaga listrik.
// SKALA KESULITAN DINAMIS (DDS):
// - Generator membutuhkan tenaga lari dari (playerCount - 2) pemain secara serempak!
//   * 2 Pemain : Butuh 1 pelari di roda, 1 rekan naik elevator.
//   * 3 Pemain : Butuh 1 pelari di roda, 2 rekan naik elevator.
//   * 4 Pemain : Butuh 2 pelari di roda, 2 rekan naik elevator.
//   * 5 Pemain : Butuh 3 pelari di roda, 2 rekan naik elevator.
// PUZZLE & CARA MENANG:
// - Listrik roda menggerakkan Elevator Vertikal (minY: 200, maxY: 520) ke Brankas Langit.
// - Rekan di atas mengambil Kunci dan menginjak tombol [JEMBATAN BANTUAN] di x: 1540.
// - Jembatan bawah terbentang permanen agar seluruh pelari di roda bisa menyeberang ke Pintu Keluar.

module.exports = {
  id      : 16,
  name    : 'Level 16 – Hamster Power',
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
    '00000000000000000000000000000000111111110000000000000000000000000', // 5  - Brankas Langit (col 32-39, y: 200)
    '00000000000000000000000000000000000000000000000000000000000000000', // 6
    '00000000000000000000000000000000000000000000000000000000000000000', // 7
    '00000000000000000000000000000000000000000000000000000000000000000', // 8
    '00000000000000000000000000000000000000000000000000000000000000000', // 9
    '00000000000000000000000000000000000000000000000000000000000000000', // 10
    '00000000000000000000000000000000000000000000000000000000000000000', // 11
    '00000000000000000000000000000000000000000000000000000000000000000', // 12
    '00000000000000000000000000000000000000000000000000000000000000000', // 13
    '11111111111111111111111100000000000000000000000011111111111111111', // 14 - Jurang di cols 24-47 (x: 960-1920)
  ],
  spawns: [
    { x:  80, y: 500 },
    { x: 120, y: 500 },
    { x: 160, y: 500 },
    { x: 200, y: 500 },
    { x: 240, y: 500 },
  ],
  // Roda Generator Listrik
  generatorWheels: [
    {
      id               : 'gen_wheel_hamster',
      x                : 680,
      y                : 500,
      radius           : 48,
      power            : 0,
      targetType       : 'elevator',
      targetId         : 'elev_power_hamster',
      reqRunnersFormula: (pCount) => Math.max(1, pCount - 2),
    },
  ],
  // Elevator Listrik yang naik turun seiring tenaga roda
  movingPlatforms: [
    {
      id   : 'elev_power_hamster',
      x    : 1120,
      y    : 520,
      w    : 110,
      h    : 18,
      minY : 200,
      maxY : 520,
      speed: 0,
      dir  : 0,
      label: 'ELEVATOR LISTRIK',
    },
  ],
  key : { x: 1420, y: 150 },
  door: { x: 2440, y: 488 },
  doorW: 48,
  doorH: 72,
  buttons: [
    {
      id     : 'btn_wheel_bridge',
      x      : 1540,
      y      : 186,
      w      : 44,
      h      : 14,
      isLatch: true,
      group  : 1,
      label  : 'JEMBATAN BANTUAN',
    },
  ],
  bridges: [
    {
      id     : 'bridge_wheel_safety',
      x      : 960,
      y      : 546,
      w      : 960,
      h      : 14,
      group  : 1,
      active : false,
      latched: false,
    },
  ],
  boxes       : [],
  gates       : [],
  lasers      : [],
  springboards: [],
};

