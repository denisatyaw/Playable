'use strict';

// ── LEVEL 3: Hold the Door (Expanded Dual-Chasm & Coordinated Bridges) ──────
// Jarak: 2800 px (70 Kolom, 2.3x Panjang Layar)
// Kamera bergerak dinamis mengikuti tim. Pemain wajib saling menunggu.
// Stage 1: Jurang 1 (x: 560-800). Tim menginjak (playerCount - 1) tombol untuk nyalakan Jembatan 1.
//          Runner menyeberang dan menginjak Kait 1 (x: 880) untuk mengunci Jembatan 1 selamanya!
// Stage 2: Jurang 2 (x: 1600-1840). Tim menahan tombol di pulau tengah agar runner menyeberangi Jembatan 2.
// ANTI-STRAND PENCEGAHAN:
// Begitu runner menyeberangi Jembatan 2, terdapat Kait 2 (x: 1900) yang mengunci Jembatan 2 permanen!
// Seluruh tim di pulau tengah langsung bisa menyusul ke pulau akhir bersama-sama!
// Stage 3: Anak tangga dari lantai memudahkan memanjat platform Kunci dan menuju Pintu Keluar.

module.exports = {
  id      : 3,
  name    : 'Level 3 – Hold the Door',
  worldW  : 2800,
  worldH  : 600,
  tileSize: 40,
  tiles: [
    // 70 kolom per baris
    // 0         1         2         3         4         5         6
    // 0123456789012345678901234567890123456789012345678901234567890123456789
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 0
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 1
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 2
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 3
    '0000000000000000000000000000000000000000000000000000000011110000000000', // 4 - Platform atas (col 56-59)
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 5
    '0000000000000000000000000000000000000000000000000000111100000000000000', // 6 - Kunci di col 52-55 (x: 2120)
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 7
    '0000000000000000000000000000000000000000000000001111000000000000000000', // 8 - Platform col 48-51
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 9
    '0000000000000000000000000000000000000000000001100000000000000000000000', // 10 - Step 2 col 45-46
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 11
    '0000000000000000000000000000000000000000001100000000000000000000000000', // 12 - Step 1 col 42-43 (80px dari lantai)
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 13
    // Lantai dengan 2 jurang maut (Kolom 14-19 dan Kolom 40-41):
    '1111111111111100000011111111111111111111001111111111111111111111111111', // 14
  ],
  spawns: [
    { x:  60, y: 500 },
    { x: 100, y: 500 },
    { x: 140, y: 500 },
    { x: 180, y: 500 },
    { x: 220, y: 500 },
  ],
  key : { x: 2120, y: 210 },  // Di atas platform baris 6 (x: 2120)
  door: { x: 2680, y: 480 },  // Di ujung paling kanan di lantai (x: 2680)
  doorW: 48,
  doorH: 72,
  boxes: [],
  // Tombol Stage 1 & Stage 2
  buttons: [
    // Tombol Stage 1 (di daratan awal: x: 220-400)
    { id: 'btn_stage1_0', x: 220, y: 546, w: 38, h: 14, index: 0, group: 1, label: 'JEMBATAN 1' },
    { id: 'btn_stage1_1', x: 280, y: 546, w: 38, h: 14, index: 1, group: 1, label: 'JEMBATAN 1' },
    { id: 'btn_stage1_2', x: 340, y: 546, w: 38, h: 14, index: 2, group: 1, label: 'JEMBATAN 1' },
    { id: 'btn_stage1_3', x: 400, y: 546, w: 38, h: 14, index: 3, group: 1, label: 'JEMBATAN 1' },
    // Kait 1 di pulau tengah (x: 880): Mengunci Jembatan 1 saat diinjak runner!
    { id: 'btn_latch_1',  x: 880, y: 546, w: 42, h: 14, isLatch: true, group: 1, label: 'KUNCI JEMBATAN 1' },

    // Tombol Stage 2 (di pulau tengah: x: 1100-1340): Untuk nyalakan Jembatan 2
    { id: 'btn_stage2_0', x: 1100, y: 546, w: 38, h: 14, index: 0, group: 2, label: 'JEMBATAN 2' },
    { id: 'btn_stage2_1', x: 1180, y: 546, w: 38, h: 14, index: 1, group: 2, label: 'JEMBATAN 2' },
    { id: 'btn_stage2_2', x: 1260, y: 546, w: 38, h: 14, index: 2, group: 2, label: 'JEMBATAN 2' },
    { id: 'btn_stage2_3', x: 1340, y: 546, w: 38, h: 14, index: 3, group: 2, label: 'JEMBATAN 2' },
    // Kait 2 di pulau akhir (x: 1880): Mengunci Jembatan 2 permanen agar tim tengah menyusul!
    { id: 'btn_latch_2',  x: 1880, y: 546, w: 42, h: 14, isLatch: true, group: 2, label: 'KUNCI JEMBATAN 2' },
  ],
  bridges: [
    // Jembatan Jurang 1: x: 560 s/d 800 (lebar 240px)
    { id: 'bridge_gap_1', x: 560, y: 546, w: 240, h: 14, group: 1, active: false, latched: false },
    // Jembatan Jurang 2: x: 1600 s/d 1720 (lebar 120px)
    { id: 'bridge_gap_2', x: 1600, y: 546, w: 120, h: 14, group: 2, active: false, latched: false },
  ],
  lasers      : [],
  springboards: [],
  gates       : [],
};
