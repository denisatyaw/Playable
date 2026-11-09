'use strict';

// ── LEVEL 14: Tangled (Tether Chain Co-op Mastery) ───────────────────────────
// Dimensi: 2400 x 600 px (60 Kolom x 15 Baris, Tile: 40px)
// Mekanik Utama: Tether (Tali Kematian).
// - Seluruh pemain diikat erat menjadi satu rantai fisik (maxDistance: 110 px).
// - Fisika tali membatasi jarak rentang dan menyalurkan momentum rekan.
//
// 🏛️ ARSITEKTUR RUANG TERTUTUP & FILOSOFI PUZZLE CO-OP:
// 1. CHAMBER 1 – Gerbang Rentang Tali (Tension Gate):
//    - Ruangan tertutup plafon & dinding pemisah di col 10 (x: 400).
//    - P1 menginjak Tombol Penahan (btn_tangled_1, x: 340) agar gerbang terbuka.
//    - P1 tidak bisa lewat sendiri karena harus menahan tombol!
//    - P2 melangkah menembus gerbang, meregangkan tali (jarak 92px dari P1),
//      lalu menginjak Tombol Pengunci Latch (btn_tangled_latch_1, x: 432).
//    - Gerbang terkunci terbuka permanen, membebaskan P1 untuk menyusul ke Chamber 2.
//
// 2. CHAMBER 2 – Parkour Pilar Danau Asam (Pure Tether Parkour - Tanpa Jembatan!):
//    - Jurang asam membentang dari x: 720 hingga x: 1120 (laser asam di dasar).
//    - Terdapat 2 pilar batu kokoh (lebar 80 px) dengan celah lompat 80 px.
//    - Tidak ada jembatan instan: Pemain harus melompati pilar demi pilar sendiri
//      secara serempak dan seirama!
//    - KUNCI melayang di atas Pilar 1 (x: 825, y: 450).
//    - Jika ada pemain yang melompat ceroboh atau terpeleset, beban jatuhnya
//      akan menarik rekannya ke danau asam maut (Respawn ke checkpoint aman).
//
// 3. CHAMBER 3 – Tebing Tinggi & Dorong Peti Sejajar (High Plateau & Tandem Box Push):
//    - Tim melompat bersama di Springboard (sb_tangled, x: 1330) ke atas tebing (y: 360).
//    - Pintu keluar disegel di balik Gerbang Keluar (gate_tangled_exit, x: 2080).
//    - Pemain berbaris sejajar di belakang Peti Berat (box_tangled, x: 1520)
//      dan mendorongnya bersama ke Tombol Lantai (btn_tangled_exit, x: 1840).
//    - Peti menindih tombol permanen sehingga seluruh tim bisa masuk ke Pintu Keluar!

module.exports = {
  id       : 14,
  name     : 'Level 14 – Tangled',
  worldW   : 2400,
  worldH   : 600,
  tileSize : 40,
  hasTether: true,
  tether   : {
    maxDistance: 110,
    stiffness  : 350,
  },
  tiles: [
    // 60 kolom per baris (0=udara, 1=solid)
    // 0         1         2         3         4         5
    // 012345678901234567890123456789012345678901234567890123456789
    '111111111111111111111111111111111111111111111111111111111111', // 0 - Plafon Solid Seluruh Level
    '100000000010000000000000000000000000000000000000000010000001', // 1
    '100000000010000000000000000000000000000000000000000010000001', // 2
    '100000000010000000000000000000000000000000000000000010000001', // 3
    '100000000010000000000000000000000000000000000000000010000001', // 4
    '100000000010000000000000000000000000000000000000000010000001', // 5
    '100000000010000000000000000000000000000000000000000010000001', // 6
    '100000000010000000000000000000000000000000000000000000000001', // 7 - Kusen Pintu Gerbang Akhir (col 52 open)
    '100000000010000000000000000000000000000000000000000000000001', // 8 - Lorong Pintu Gerbang Akhir (y: 280-360)
    '100000000010000000000000000000000001111111111111111111111111', // 9 - Lantai Tebing Tinggi Chamber 3 (y: 360)
    '100000000010000000000000000000000001111111111111111111111111', // 10 - Dinding Pemisah Col 10 Solid
    '100000000000000000000000000000000001111111111111111111111111', // 11 - Kusen Pintu Gerbang 1 (col 10 open)
    '100000000000000000000000000000000001111111111111111111111111', // 12 - Lorong Pintu Gerbang 1 (y: 440-520)
    '111111111111111111001100110011111111111111111111111111111111', // 13 - Lantai Utama (y: 520) & Pilar Batu Parkour
    '111111111111111111001100110011111111111111111111111111111111', // 14 - Pondasi Bawah Tanah & Dasar Jurang
  ],

  spawns: [
    { x:  80, y: 480 },
    { x: 120, y: 480 },
    { x: 160, y: 480 },
    { x: 200, y: 480 },
    { x: 240, y: 480 },
  ],

  key : { x: 825, y: 450 },
  door: { x: 2200, y: 288 },
  doorW: 48,
  doorH: 72,

  // Tombol Interaktif Co-op (HANYA digunakan di mana pemain terakhir butuh bantuan jalur)
  buttons: [
    // 1. Tombol Penahan Gerbang 1 (Chamber 1): Diinjak P1 agar gerbang terbuka
    {
      id    : 'btn_tangled_1',
      x     : 340,
      y     : 512,
      w     : 36,
      h     : 8,
      gateId: 'gate_tangled_1',
    },
    // 2. Tombol Latch Pengunci Gerbang 1 (Chamber 1): Diinjak P2 untuk membebaskan P1 yang menahan tombol
    {
      id     : 'btn_tangled_latch_1',
      x      : 432,
      y      : 512,
      w      : 36,
      h      : 8,
      gateId : 'gate_tangled_1',
      isLatch: true,
    },
    // 3. Tombol Gerbang Keluar (Tebing Chamber 3): Ditindih peti berat oleh tim yang mendorong sejajar
    {
      id    : 'btn_tangled_exit',
      x     : 1840,
      y     : 352,
      w     : 40,
      h     : 8,
      gateId: 'gate_tangled_exit',
    },
  ],

  // Gerbang Keamanan Tertutup (Ditempatkan di pintu dinding pemisah kokoh)
  gates: [
    // Gerbang Lorong Chamber 1 (Kusen di col 10, y: 440..520)
    {
      id        : 'gate_tangled_1',
      x         : 400,
      y         : 440,
      w         : 16,
      h         : 80,
      open      : false,
      minPlayers: 2,
    },
    // Gerbang Pintu Keluar Chamber 3 (Kusen di col 52, y: 280..360)
    {
      id  : 'gate_tangled_exit',
      x   : 2080,
      y   : 280,
      w   : 16,
      h   : 80,
      open: false,
    },
  ],

  // Tidak ada jembatan di Chamber 2: Pemain harus murni menyeberangi pilar batu secara mandiri
  bridges: [],

  // Springboard Pelontar Tim ke Tebing Tinggi Chamber 3
  springboards: [
    {
      id         : 'sb_tangled',
      x          : 1330,
      y          : 504,
      w          : 36,
      h          : 16,
      bounceForce: -820,
      forceY     : -820,
    },
  ],

  // Peti Berat Co-op (DDS: butuh dorongan bersama sejajar)
  boxes: [
    {
      id               : 'box_tangled',
      x                : 1520,
      y                : 320,
      w                : 40,
      h                : 40,
      minPushers       : 2,
      minPushersFormula: (pCount) => Math.max(1, Math.min(2, pCount)),
    },
  ],

  // Laser Danau Asam Mematikan di Dasar Jurang
  lasers: [
    {
      id         : 'laser_acid_tangled',
      x          : 720,
      y          : 574,
      w          : 400,
      h          : 18,
      orientation: 'horizontal',
      active     : true,
    },
  ],
};
