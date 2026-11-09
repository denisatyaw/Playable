'use strict';

// ── LEVEL 21: Lunar Drift (Gravitasi Bulan & Medan Terbalik) ───────────────────
// Dimensi: 2400 x 600 px (60 Kolom x 15 Baris, Tile: 40px)
// Mekanik Utama:
// 1. Gravitasi Bulan (Moon Gravity):
//    - Gravitasi rendah (gravity: 440 px/s² vs normal 1800 px/s²).
//    - Pemain melompat tinggi dan melayang anggun di udara (~1.8 detik).
//    - Kontrol melayang menuntut kehati-hatian agar tidak melayang ke jebakan langit!
// 2. Tether (Tali Kematian - Max 135 px):
//    - Seluruh pemain diikat rantai fisik.
//    - Saat melayang, tarikan tali saling mempengaruhi lintasan kawan di udara.
// 3. Medan Gravitasi Terbalik (Gravity Inversion Zones):
//    - Area bercahaya ungu neon di mana gravitasi berbalik arah ke langit-langit (dir: -1).
//    - Pemain berjalan terbalik di plafon dan melompat ke arah bawah.
//
// 🏛️ ARSITEKTUR RUANG TERTUTUP & PUZZLE KEKOMPAKAN (3 CHAMBER):
// 1. CHAMBER 1 – Kawah Bulan & Bahaya Melayang (Lunar Craters & High Float):
//    - Melompati kawah bulan dengan pilar-pilar batu.
//    - Terdapat laser maut melayang di ketinggian y: 120. Pemain harus mengontrol
//      lompatan bulan agar tidak melayang terlalu tinggi menyentuh laser langit!
// 2. CHAMBER 2 – Koridor Terbalik & Kunci Simetris (Inversion Tunnel & Mirrored Lock):
//    - Terowongan tertutup (tinggi 120 px) dengan medan anti-gravitasi di bagian atas.
//    - Satu pemain melompat masuk ke medan dan berjalan terbalik di langit-langit,
//      sementara pemain rekannya berjalan normal di lantai!
//    - Keduanya harus berjalan beriringan (terikat tali 135px) dan menginjak:
//      * Tombol Plafon (btn_lunar_ceil, x: 1160) oleh pemain terbalik.
//      * Tombol Lantai (btn_lunar_floor, x: 1160) oleh pemain normal.
//      Secara BERSAMAAN untuk membuka gerbang lorong!
// 3. CHAMBER 3 – Belay Tali Angkasa & Kunci Bulan (Counterweight Chasm & The Moon Key):
//    - Kolom anti-gravitasi raksasa melintang menuju langit-langit berduri laser (y: 50).
//    - KUNCI melayang di ketinggian y: 160.
//    - Jika pemain masuk sendirian, ia akan terlontar menabrak laser langit dan mati.
//    - Rekan di lantai normal (y: 520) bertindak sebagai JANGKAR PENAHAN (Counterweight Anchor),
//      menahan tali agar pemain yang melayang bisa meraih kunci dengan aman tanpa tersedot ke laser!
//    - Tim membuka gerbang akhir menuju Pintu Keluar Luar Angkasa!

module.exports = {
  id           : 21,
  name         : 'Level 21 – Lunar Drift',
  worldW       : 2400,
  worldH       : 600,
  tileSize     : 40,
  gravity      : 440,   // Gravitasi Bulan (sangat melayang & lambat)
  jumpVelocity : -400,  // Lompatan tinggi bulan
  hasTether    : true,
  tether       : {
    maxDistance: 135,
    stiffness  : 320,
  },
  pitDesignIntentional: true,

  tiles: [
    // 60 kolom per baris (0=udara, 1=solid)
    // 0         1         2         3         4         5
    // 012345678901234567890123456789012345678901234567890123456789
    '111111111111111111111111111111111111111111111111111111111111', // 0 - Plafon Solid Seluruh Level
    '100000000000000001000000000000000000000000000000000010000001', // 1
    '100000000000000001000000000000000000000000000000000010000001', // 2
    '100000000000000001000000000000000000000000000000000010000001', // 3
    '100000000000000001000000000000000000000000000000000010000001', // 4
    '100000000000000001111111111111111111000000000000000010000001', // 5 - Plafon Terowongan Chamber 2 (Cols 19-37)
    '100000000000000001111111111111111111000000000000000010000001', // 6 - Plafon Solid Terowongan (y: 280)
    '100000000000000000000000000000000000000000000000000010000001', // 7 - Interior Terowongan (y: 280-320)
    '100000000000000000000000000000000000000000000000000010000001', // 8 - Interior Terowongan (y: 320-360)
    '100000000000000000000000000000000000000000000000000010000001', // 9 - Interior Terowongan (y: 360-400)
    '100000000000000001111111111111111111100000000000000010000001', // 10 - Lantai Terowongan Chamber 2 (y: 400)
    '100000000000000000111111111111111111100000000000000000000001', // 11 - Kusen Gerbang Akhir (col 53 open)
    '100000000000000000111111111111111111100000000000000000000001', // 12 - Lorong Gerbang Akhir (y: 440-520)
    '111111110010010011111111111111111111111111111111111111111111', // 13 - Lantai Utama (y: 520) & Pilar Kawah
    '111111110010010011111111111111111111111111111111111111111111', // 14 - Dasar Kawah & Pondasi
  ],

  spawns: [
    { x:  80, y: 480 },
    { x: 120, y: 480 },
    { x: 160, y: 480 },
    { x: 200, y: 480 },
    { x: 240, y: 480 },
  ],

  key : { x: 1860, y: 160 },
  door: { x: 2260, y: 448 },
  doorW: 48,
  doorH: 72,

  // ⚡ Medan Gravitasi Terbalik (Gravity Inversion Zones)
  gravityZones: [
    // 1. Zona Atas Terowongan Chamber 2: Menarik pemain ke langit-langit
    {
      id   : 'gz_tunnel',
      x    : 800,
      y    : 280,
      w    : 660,
      h    : 60,
      dir  : -1,
      label: 'KORIDOR ANTI-GRAVITASI',
    },
    // 2. Kolom Angkasa Chamber 3: Kolom vertikal raksasa penarik ke arah kunci
    {
      id   : 'gz_chasm',
      x    : 1720,
      y    : 0,
      w    : 280,
      h    : 440,
      dir  : -1,
      label: 'KOLOM ANGKASA',
    },
  ],

  // Tombol Interaktif Co-op
  buttons: [
    // 1. Tombol Plafon (Chamber 2): Diinjak pemain terbalik di langit-langit terowongan
    {
      id       : 'btn_lunar_ceil',
      x        : 1160,
      y        : 280,
      w        : 36,
      h        : 8,
      isCeiling: true,
      gateId   : 'gate_lunar_tunnel',
    },
    // 2. Tombol Lantai (Chamber 2): Diinjak pemain normal di lantai terowongan
    {
      id    : 'btn_lunar_floor',
      x     : 1160,
      y     : 392,
      w     : 36,
      h     : 8,
      gateId: 'gate_lunar_tunnel',
    },
    // 3. Tombol Latch Terowongan (Chamber 2): Mengunci gerbang terowongan terbuka permanen
    {
      id     : 'btn_lunar_latch',
      x      : 1380,
      y      : 392,
      w      : 36,
      h      : 8,
      isLatch: true,
      gateId : 'gate_lunar_tunnel',
    },
    // 4. Tombol Penahan Gerbang Akhir (Chamber 3): Diinjak di lantai sebelum pintu
    {
      id    : 'btn_lunar_exit',
      x     : 2040,
      y     : 512,
      w     : 36,
      h     : 8,
      gateId: 'gate_lunar_exit',
    },
    // 5. Tombol Latch Gerbang Akhir (Chamber 3): Mengunci pintu keluar terbuka permanen
    {
      id     : 'btn_lunar_exit_latch',
      x      : 2160,
      y      : 512,
      w      : 36,
      h      : 8,
      isLatch: true,
      gateId : 'gate_lunar_exit',
    },
  ],

  // Gerbang Keamanan
  gates: [
    // Gerbang Pembatas Terowongan Chamber 2 (y: 280..400)
    {
      id          : 'gate_lunar_tunnel',
      x           : 1320,
      y           : 280,
      w           : 16,
      h           : 120,
      open        : false,
      minPlayers  : 2,
      holdDuration: 4.5, // Durasi 4.5 detik agar 2 pemain sempat berjalan melintas bersama
    },
    // Gerbang Pintu Keluar Akhir Chamber 3 (y: 440..520)
    {
      id          : 'gate_lunar_exit',
      x           : 2120,
      y           : 440,
      w           : 16,
      h           : 80,
      open        : false,
      minPlayers  : 2,
      holdDuration: 4.5,
    },
  ],

  // Rintangan Laser Melayang
  lasers: [
    // 1. Laser Dasar Kawah Bulan (Chamber 1)
    {
      id         : 'laser_crater',
      x          : 320,
      y          : 574,
      w          : 320,
      h          : 18,
      orientation: 'horizontal',
      active     : true,
    },
    // 2. Laser Mengambang Langit-Langit (Chamber 1: Menghukum lompatan liar tanpa kontrol)
    {
      id         : 'laser_high_ceil',
      x          : 400,
      y          : 120,
      w          : 200,
      h          : 16,
      orientation: 'horizontal',
      active     : true,
    },
    // 3. Laser Maut Plafon Angkasa (Chamber 3: Memerlukan jangkar tim agar tidak tersedot)
    {
      id         : 'laser_chasm_ceil',
      x          : 1720,
      y          : 50,
      w          : 280,
      h          : 18,
      orientation: 'horizontal',
      active     : true,
    },
  ],
};

