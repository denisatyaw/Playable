'use strict';

// ── LEVEL 19: Tethered in the Dark (Tether + Darkness Combo) ──────────────────
// Jarak: 2600 px (65 Kolom, 2.1x Panjang Layar)
// Fitur Gabungan 1: Darkness (Gelap Gulita) + Tether (Tali Kematian).
// - Seluruh pemain diikat menjadi satu rantai fisik DAN ruangan gelap gulita!
// - Pemegang Obor dapat melihat jalan di depannya, namun pergerakannya dibatasi oleh
//   tali rekan-rekannya yang berada di kegelapan.
// PUZZLE & TANTANGAN:
// - Jika rekan di belakang tertinggal atau melompat ceroboh ke jurang maut,
//   mereka akan menyeret pemegang obor dan seluruh tim ikut terjatuh!
// - Butuh komunikasi vokal dan pergerakan seirama: pemandu memberi aba-aba lompatan
//   agar seluruh tim menyeberang pilar kegelapan dengan selamat.

module.exports = {
  id       : 19,
  name     : 'Level 19 – Tethered in the Dark',
  worldW   : 2600,
  worldH   : 600,
  tileSize : 40,
  hasTether: true,
  tether   : {
    maxDistance: 165,
    stiffness  : 320,
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
    '00000000000000111001110011110011100111100111001110000000000000000', // 12 - Pilar-pilar lompatan rapi (gap 80px)
    '00000000000000111001110011110011100111100111001110000000000000000', // 13
    '11111111111100000000000000000000000000000000000000011111111111111', // 14 - Jurang kegelapan di bawah
  ],
  spawns: [
    { x:  80, y: 500 },
    { x: 120, y: 500 },
    { x: 160, y: 500 },
    { x: 200, y: 500 },
    { x: 240, y: 500 },
  ],
  torches: [
    { id: 'torch_tethered', x: 280, y: 510 },
  ],
  key : { x: 2200, y: 500 },
  door: { x: 2440, y: 488 },
  doorW: 48,
  doorH: 72,
  lasers: [
    {
      id         : 'laser_pit_tethered',
      x          : 480,
      y          : 574,
      w          : 1560,
      h          : 18,
      orientation: 'horizontal',
      active     : true,
    },
  ],
  buttons     : [],
  bridges     : [],
  boxes       : [],
  springboards: [],
};

