'use strict';

// ── LEVEL 10: Final Exam (The Grand Finale Co-op Gauntlet) ───────────────────
// Jarak: 2800 px (70 Kolom, 2.3x Panjang Layar)
// Fitur: Ujian Kelulusan Puncak yang menggabungkan seluruh mekanik kerja sama:
//        1. Menara Manusia (Tower Stack)
//        2. Dorong Beban Berat Bersama (Team Heavy Push)
//        3. Deaktivasi Laser Pembatas (Laser Barrier Switch)
//        4. Seluruh Tim Berkumpul di Pintu Keluar
// MULTI-STAGE CO-OP (DDS):
// - Tahap 1 (x: 520): Panjat tebing menara untuk menginjak [SAKLAR JEMBATAN A].
//   Jembatan A membentang sebagai tangga agar seluruh kawan naik bersama ke Tahap 2.
// - Tahap 2 (x: 740): Dorong Batu Raksasa (minPushers: pCount - 1) melintasi lorong atas
//   hingga jatuh ke saklar [SAKLAR GERBANG LASER] di x: 1256.
// - Tahap 3 (x: 1540): Injak tombol [MATIKAN LASER] untuk menonaktifkan laser vertikal,
//   memungkinkan kawan mengambil Kunci Emas di x: 1780.
// - Tahap 4 (x: 2000 - 2800): Lorong kemenangan menuju Pintu Keluar Agung di x: 2680.
// PENCEGAHAN SOFTLOCK & ANTI-STRAND:
// - Seluruh rintangan memiliki mekanisme penolong timbal-balik (latch button / batu penindih).
// - Begitu Kunci Emas diambil, seluruh pintu pengaman terbuka otomatis selamanya!

module.exports = {
  id      : 10,
  name    : 'Level 10 – Final Exam',
  worldW  : 2800,
  worldH  : 600,
  tileSize: 40,
  tiles   : [
    // 70 kolom per baris (0=udara, 1=solid)
    // 0         1         2         3         4         5         6
    // 0123456789012345678901234567890123456789012345678901234567890123456789
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 0
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 1
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 2
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 3
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 4
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 5
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 6
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 7
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 8
    '0000000000000000000000000000000000011000000000000000000000000000000000', // 9  - Dinding atas Gerbang Laser (col 35-36, y: 360)
    '0000000000000111111111111111110000011000000000000000000000000000000000', // 10 - Platform Tahap 2 (col 13-30, y: 400)
    '0000000000000111111111111111110000011000000000000000000000000000000000', // 11
    '0000000000000111111111111111111111000000000000000000000000000000000000', // 12 - Ditch Saklar (col 31, y: 480) & Gerbang (col 35-36)
    '0000000000000000000000000000000000000000000000000000000000000000000000', // 13 - Gerbang (col 35-36)
    '1111111111111111111111111111111111111111111111111111111111111111111111', // 14 - Lantai Bawah Solid Penuh (y: 560)
  ],
  spawns: [
    { x:  80, y: 500 },
    { x: 120, y: 500 },
    { x: 160, y: 500 },
    { x: 200, y: 500 },
    { x: 240, y: 500 },
  ],
  key : { x: 1780, y: 500 },
  door: { x: 2680, y: 488 },
  doorW: 48,
  doorH: 72,
  // Peti Raksasa Tahap 2
  boxes: [
    {
      id               : 'box_final_boulder',
      x                : 740,
      y                : 334,
      w                : 64,
      h                : 64,
      vx               : 0,
      vy               : 0,
      onGround         : true,
      minPushersFormula: (pCount) => Math.max(1, pCount - 1),
    },
  ],
  // Gerbang Laser Ruang Kunci
  gates: [
    {
      id   : 'gate_final_lasers',
      x    : 1400,
      y    : 480,
      w    : 80,
      h    : 80,
      label: 'GERBANG RUANG LASER',
    },
  ],
  // Tombol Interaktif
  buttons: [
    // Tombol 1: Puncak Tebing Tahap 1 (Membuka Jembatan Tangga A)
    {
      id     : 'btn_final_stage1',
      x      : 540,
      y      : 386,
      w      : 44,
      h      : 14,
      isLatch: true,
      group  : 1,
      label  : 'SAKLAR JEMBATAN A',
    },
    // Tombol 2: Ditch Saklar yang ditindih oleh Batu Raksasa Tahap 2
    {
      id     : 'btn_final_stage2',
      x      : 1256,
      y      : 466,
      w      : 44,
      h      : 14,
      gateId : 'gate_final_lasers',
      label  : 'SAKLAR GERBANG LASER',
    },
    // Tombol 3: Saklar Deaktivasi Laser Vertikal di Ruang Kunci
    {
      id        : 'btn_final_laser',
      x         : 1540,
      y         : 546,
      w         : 44,
      h         : 14,
      laserIndex: 0,
      label     : 'MATIKAN LASER',
    },
  ],
  // Jembatan Tangga A (Tahap 1)
  bridges: [
    {
      id     : 'bridge_final_a',
      x      : 430,
      y      : 470,
      w      : 90,
      h      : 14,
      group  : 1,
      active : false,
      latched: false,
    },
  ],
  // Laser Vertikal Pembatas Ruang Kunci
  lasers: [
    {
      id         : 'laser_final_barrier',
      x          : 1660,
      y          : 360,
      w          : 16,
      h          : 200,
      orientation: 'vertical',
      index      : 0,
      active     : true,
    },
  ],
  springboards: [],
};

