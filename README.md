# 🎮 BoxBuds Co-op

Web game 2D platformer multiplayer co-op yang dibuat dengan **HTML5 Canvas**, **Vanilla JavaScript**, **Node.js**, **Express**, dan **Socket.io**.

Pemain harus bekerja sama untuk melompat, mengambil kunci 🔑, dan mencapai pintu EXIT 🚪 bersama-sama untuk memenangkan level.

---

## ✨ Fitur Utama

- **Local Network Multiplayer**: Server listen pada `0.0.0.0`, dapat diakses oleh perangkat lain (PC, laptop, smartphone) dalam satu jaringan Wi-Fi / LAN yang sama.
- **Karakter & Fisika Solid**:
  - Mendukung hingga 5 pemain dengan warna otomatis (Red, Blue, Green, Yellow, Pink).
  - Mekanik tabrakan solid: pemain bisa saling mendorong dan melompat di atas kepala kawan (tumpuk ala puzzle platformer).
- **Sistem Level Skalabel**:
  - Berbasis array tilemap (mudah dimodifikasi dan ditambahkan level baru).
  - Win condition dinamis menyesuaikan jumlah pemain yang terhubung (minimal 2 pemain untuk memulai).
- **Lobby & In-Game Controls**:
  - Layar lobby dengan daftar pemain dan status host.
  - Tombol **Leave Game** untuk pemain dan **End Game** untuk host.

---

## 🚀 Cara Menjalankan

### 1. Prasyarat
Pastikan sudah menginstal [Node.js](https://nodejs.org/).

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Menjalankan Server
```bash
node server.js
```
atau untuk development dengan auto-reload:
```bash
npm run dev
```

### 4. Akses Game
- **Host**: Buka browser di [http://localhost:3000](http://localhost:3000)
- **Pemain Lain di LAN/Wi-Fi**: Buka browser di `http://<IP_KOMPUTER_HOST>:3000` (contoh: `http://192.168.1.10:3000` atau sesuai IP yang ditampilkan di console).

---

## 🎮 Kontrol Permainan

| Tombol | Aksi |
| --- | --- |
| `A` / `←` | Bergerak ke Kiri |
| `D` / `→` | Bergerak ke Kanan |
| `W` / `↑` / `Space` | Melompat |

---

## 📁 Struktur Direktori

```text
Playable/
├── public/
│   ├── index.html       # Antarmuka (Lobby, HUD Game, Layar Menang)
│   ├── style.css        # Desain UI modern & playful
│   └── game.js          # Client-side Socket.io & HTML5 Canvas rendering
├── server.js            # Backend Express, Socket.io, & engine fisika 60 FPS
├── package.json         # Konfigurasi project & dependencies
├── .gitignore
└── README.md
```
