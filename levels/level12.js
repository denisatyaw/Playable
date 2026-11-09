'use strict';

// ── LEVEL 12: The Balance (Seesaw Co-op & Multi-Stage Tilt Physics) ───────────
// Dimensi: 2600 x 600 px (65 Kolom x 15 Baris, Tile: 40px)
// Fitur Utama: 3 Timbangan Raksasa (Triple Seesaw Challenge) + Peti Beban (Counterweight Box).
// - Tidak ada tombol jembatan bantuan: Seluruh tim harus menyeberang murni
//   menggunakan hukum fisika timbangan, koordinasi beban, dan lompatan kompak!
//
// ⚖️ 3 TAHAP TANTANGAN TIMBANGAN & VARIASI PUZZLE:
// 1. TAHAP 1 – Timbangan Lembah Angin (Seesaw 1, x: 500 - 940):
//    - Timbangan awal melintasi jurang pertama menuju Pulau Peti Beban.
//    - Torsi sangat responsif; tim harus saling menjaga beban agar papan tetap seimbang.
// 2. TAHAP 2 – Jurang Laser Bahaya & Peti Beban (Seesaw 2, x: 1180 - 1620):
//    - Di Pulau Tengah 1 (x: 960 - 1160), terdapat Peti Beban Batu (x: 1040).
//    - Pemain dapat mendorong peti ke atas Timbangan 2 untuk menjadi pemberat stabil (counterweight),
//      membantu menahan papan saat tim melangkah di atas jurang laser maut!
// 3. TAHAP 3 – Timbangan Pengungkit Kunci Emas (Seesaw 3, x: 1820 - 2260):
//    - KUNCI EMAS melayang tinggi di angkasa (x: 2220, y: 260).
//    - Tim di sisi kiri menekan timbangan ke bawah sehingga ujung kanan terungkit tinggi.
//    - Rekan melompat dari ujung kanan yang terangkat untuk meraih Kunci Emas di udara!
//    - Tim menyeimbangkan kembali timbangan agar seluruh rekan mendarat di Tebing Gerbang Kuil (x: 2280 - 2600).

module.exports = {
  id      : 12,
  name    : 'Level 12 – The Balance',
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
    '00000000000000000000000000000000000000000000000000000000000000000', // 5
    '00000000000000000000000000000000000000000000000000000000000000000', // 6
    '00000000000000000000000000000000000000000000000000000000000000000', // 7
    '00000000000000000000000000000000000000000000000000000000000000000', // 8
    '00000000000000000000000000000000000000000000000000000000000000000', // 9
    '00000000000000000000000000000000000000000000000000000000000000000', // 10
    '00000000000000000000000000000000000000000000000000000000000000000', // 11
    '11111111111100000110000011111000001100000111100000110000011111111', // 12 - Tebing Awal (0-11), Pivot 1 (17-18), Pilar Peti (24-28), Pivot 2 (34-35), Pilar 2 (41-44), Pivot 3 (50-51), Tebing Akhir (57-64)
    '11111111111100000110000011111000001100000111100000110000011111111', // 13 - Pondasi Pilar & Batu Pivot
    '11111111111100000110000011111000001100000111100000110000011111111', // 14
  ],
  spawns: [
    { x:  80, y: 420 },
    { x: 130, y: 420 },
    { x: 180, y: 420 },
    { x: 230, y: 420 },
    { x: 280, y: 420 },
  ],
  // 3 Timbangan Raksasa Bertingkat
  seesaws: [
    // 1. Timbangan Tahap 1: Tebing Awal -> Pulau Peti
    {
      id       : 'seesaw_balance_1',
      pivotX   : 720,
      pivotY   : 480,
      length   : 440,
      thickness: 16,
      maxAngle : 0.35,
    },
    // 2. Timbangan Tahap 2: Pulau Peti -> Pilar Menara
    {
      id       : 'seesaw_balance_2',
      pivotX   : 1400,
      pivotY   : 480,
      length   : 440,
      thickness: 16,
      maxAngle : 0.38,
    },
    // 3. Timbangan Tahap 3: Pilar Menara -> Tebing Kuil (Pengungkit Kunci Langit)
    {
      id       : 'seesaw_balance_3',
      pivotX   : 2040,
      pivotY   : 480,
      length   : 440,
      thickness: 16,
      maxAngle : 0.40,
    },
  ],
  // Peti Batu Pemberat (Counterweight Box di Pulau 1)
  boxes: [
    {
      id        : 'box_balance_weight',
      x         : 1040,
      y         : 436,
      w         : 44,
      h         : 44,
      minPushers: 1,
    },
  ],
  // Laser Bahaya di Jurang Tahap 2
  lasers: [
    {
      id         : 'laser_seesaw_hazard',
      x          : 1160,
      y          : 574,
      w          : 480,
      h          : 18,
      orientation: 'horizontal',
      active     : true,
    },
  ],
  key : { x: 2220, y: 260 },
  door: { x: 2460, y: 408 },
  doorW: 48,
  doorH: 72,
  buttons     : [],
  bridges     : [],
  gates       : [],
  springboards: [],
};
