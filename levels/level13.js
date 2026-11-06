'use strict';

// ── LEVEL 13: Color Checkpoint (Color Lasers Co-op) ───────────────────────────
// Jarak: 2400 px (60 Kolom, 2.0x Panjang Layar)
// Fitur Baru: Color Lasers (Laser Warna).
// - Laser pembatas mematikan yang memiliki properti warna (color).
// - Collision diabaikan (tembus aman) HANYA JIKA warna pemain sama dengan warna laser!
// SKALA KESULITAN DINAMIS (DDS):
// - Laser warna yang aktif HANYA warna yang sesuai dengan karakter pemain yang sedang join di room!
// - Pemain ke-1 (Merah), ke-2 (Biru), ke-3 (Hijau), ke-4 (Kuning), ke-5 (Pink).
// PUZZLE & KERJASAMA:
// - Di seberang setiap laser terdapat tombol bypass [MATIKAN LASER].
// - Rekan yang cocok warnanya maju menembus laser, lalu menginjak tombol di baliknya
//   sehingga laser mati permanen dan kawan-kawan lainnya bisa menyusul lewat dengan aman!

module.exports = {
  id      : 13,
  name    : 'Level 13 – Color Checkpoint',
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
    '000000000000001000000100000010000001000000100000000000000000', // 10 - Plafon emitter laser
    '000000000000000000000000000000000000000000000000000000000000', // 11
    '000000000000000000000000000000000000000000000000000000000000', // 12
    '000000000000000000000000000000000000000000000000000000000000', // 13
    '111111111111111111111111111111111111111111111111111111111111', // 14 - Lantai Solid Penuh (y: 560)
  ],
  spawns: [
    { x:  80, y: 500 },
    { x: 120, y: 500 },
    { x: 160, y: 500 },
    { x: 200, y: 500 },
    { x: 240, y: 500 },
  ],
  key : { x: 1960, y: 500 },
  door: { x: 2260, y: 488 },
  doorW: 48,
  doorH: 72,
  // Deretan 5 Laser Warna Sesuai Warna Karakter
  colorLasers: [
    { id: 'laser_col_red',    x: 580,  y: 440, w: 16, h: 120, orientation: 'vertical', color: '#FF4D6D', laserIndex: 101 },
    { id: 'laser_col_blue',   x: 860,  y: 440, w: 16, h: 120, orientation: 'vertical', color: '#4CC9F0', laserIndex: 102 },
    { id: 'laser_col_green',  x: 1140, y: 440, w: 16, h: 120, orientation: 'vertical', color: '#52B788', laserIndex: 103 },
    { id: 'laser_col_yellow', x: 1420, y: 440, w: 16, h: 120, orientation: 'vertical', color: '#FFD60A', laserIndex: 104 },
    { id: 'laser_col_pink',   x: 1700, y: 440, w: 16, h: 120, orientation: 'vertical', color: '#FF9FF3', laserIndex: 105 },
  ],
  // Tombol Bypass di seberang masing-masing laser
  buttons: [
    { id: 'btn_col_red',    x: 640,  y: 546, w: 44, h: 14, isLatch: true, laserIndex: 101, label: 'BYPASS MERAH' },
    { id: 'btn_col_blue',   x: 920,  y: 546, w: 44, h: 14, isLatch: true, laserIndex: 102, label: 'BYPASS BIRU' },
    { id: 'btn_col_green',  x: 1200, y: 546, w: 44, h: 14, isLatch: true, laserIndex: 103, label: 'BYPASS HIJAU' },
    { id: 'btn_col_yellow', x: 1480, y: 546, w: 44, h: 14, isLatch: true, laserIndex: 104, label: 'BYPASS KUNING' },
    { id: 'btn_col_pink',   x: 1760, y: 546, w: 44, h: 14, isLatch: true, laserIndex: 105, label: 'BYPASS PINK' },
  ],
  bridges     : [],
  boxes       : [],
  springboards: [],
  seesaws     : [],
};

