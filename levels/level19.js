'use strict';

// ── LEVEL 19: Tethered in the Dark (Tether + Darkness Synergy) ────────────────
// Jarak: 2600 px (65 Kolom, 2.1x Panjang Layar)
// Fitur Gabungan: Darkness (Gelap Gulita) + Tether (Tali Kematian Ketat: 110 px).
// - Seluruh pemain diikat erat menjadi satu tali fisik DAN ruangan gelap gulita.
// - Pemegang Obor dapat melihat jalan, dan tali 110px memastikan rekan-rekannya
//   selalu berada di dalam lingkaran cahaya obor.
// TANTANGAN & PUZZLE CO-OP (3 FASE):
// 1. FASE 1 - Navigasi Rintangan dalam Gelap:
//    Menghindari lubang jurang tersembunyi yang hanya terlihat saat disinari obor.
//    Menemukan saklar pedestal tersembunyi untuk membuka gerbang koridor gelap.
// 2. FASE 2 - Feri Listrik dalam Kegelapan:
//    Menyeberangi jurang maut menggunakan platform bergerak (feri).
//    Seluruh tim yang terikat harus kompak menaiki feri bersama-sama di kegelapan!
// 3. FASE 3 - Pengambilan Kunci & Gerbang Keluar:
//    Memanjat pedestal kunci dan membuka gerbang pintu keluar.

module.exports = {
  id       : 19,
  name     : 'Level 19 – Tethered in the Dark',
  worldW   : 2600,
  worldH   : 600,
  tileSize : 40,
  hasTether: true,
  tether   : {
    maxDistance: 110,
    stiffness  : 350,
  },
  darkness : {
    enabled      : true,
    ambientRadius: 45,
    torchRadius  : 220,
  },
  tiles: [
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
    '00000000000000000000100000000000000000000000000010000000000000000', // 12 - Pedestal col 20 & col 48
    '11111111111101111011111111000000000000000001111111111111111111111', // 13 - Lantai Utama & Jurang Feri (col 26-42)
    '11111111111101111011111111000000000000000001111111111111111111111', // 14 - Danau Asam di bawah feri
  ],
  spawns: [
    { x:  80, y: 480 },
    { x: 120, y: 480 },
    { x: 160, y: 480 },
    { x: 200, y: 480 },
    { x: 240, y: 480 },
  ],
  torches: [
    { id: 'torch_tethered', x: 240, y: 505 },
  ],
  key : { x: 1926, y: 440 },
  door: { x: 2400, y: 448 },
  doorW: 48,
  doorH: 72,

  // Tombol Interaktif
  buttons: [
    // Tombol 1 (Pedestal Col 20): Membuka Gerbang Koridor Gelap (Latch)
    {
      id     : 'btn_dark_gate1',
      x      : 802,
      y      : 472,
      w      : 36,
      h      : 8,
      gateId : 'gate_dark_1',
      isLatch: true,
    },
    // Tombol 2 (Col 52): Membuka Gerbang Menuju Pintu Keluar (Latch)
    {
      id     : 'btn_dark_exit',
      x      : 2082,
      y      : 512,
      w      : 36,
      h      : 8,
      gateId : 'gate_dark_exit',
      isLatch: true,
    },
  ],

  // Gerbang Keamanan
  gates: [
    {
      id  : 'gate_dark_1',
      x   : 960,
      y   : 440,
      w   : 16,
      h   : 80,
      open: false,
    },
    {
      id  : 'gate_dark_exit',
      x   : 2240,
      y   : 440,
      w   : 16,
      h   : 80,
      open: false,
    },
  ],

  // Feri Listrik Penyeberangan Jurang Kegelapan
  movingPlatforms: [
    {
      id   : 'ferry_dark',
      x    : 1080,
      y    : 520,
      w    : 120,
      h    : 16,
      minX : 1060,
      maxX : 1660,
      speed: 95,
      dir  : 1,
    },
  ],

  bridges     : [],
  boxes       : [],
  springboards: [],

  // Laser Danau Asam di Bawah Feri
  lasers: [
    {
      id         : 'laser_pit_tethered',
      x          : 1040,
      y          : 574,
      w          : 680,
      h          : 18,
      orientation: 'horizontal',
      active     : true,
    },
  ],
};
