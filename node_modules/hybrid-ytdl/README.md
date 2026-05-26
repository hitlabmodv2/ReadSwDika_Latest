# hybrid-ytdl
Hybrid YouTube Downloader berbasis multiple API yang otomatis switch jika salah satu server down.  
Mendukung download **audio & video** dengan opsi **bitrate & resolusi**, serta bisa **memilih API secara manual**.

---

## 📌 Instalasi
```bash
npm install hybrid-ytdl
```

---

## 💼 Sumber API
| API | Nama | Dukungan | Fetch? |
|---|---|---|---|
| **API 1** | CloudkuImages | Audio & Video | ✅ |
| **API 2** | NVL Group | Audio & Video | ❌ |
| **API 3** | CaliphDev | Audio & Video | ✅ |
| **API 4** | SiputzX | Audio & Video | ✅ |
| **API 5** | SuraWeb | Audio | ❌ |

**Catatan:**  
✅ **API 2 & API 5 langsung return URL tanpa fetch JSON**, jadi lebih cepat.  
✅ **API lain perlu fetch JSON dulu untuk dapatkan URL downloadnya**.  

---

## **💡 Fitur**
- 🔄 **Otomatis pindah API jika server gagal**
- 🎵 **Download Audio** (bitrate custom: 128, 192, 320kbps)
- 🎥 **Download Video** (resolusi custom: 360p, 720p, 1080p)
- 🛠 **Bisa pilih API manual (1-5) atau otomatis**
- 🚀 **Menggunakan 5 API berbeda untuk kecepatan & backup**
- 💼 **Mendukung metadata video seperti judul, durasi, thumbnail, dll.**

---

## **🐝 Cara Penggunaan**

### 🔍 **Mendapatkan Informasi Video**
```javascript
const { getVideoInfo } = require('hybrid-ytdl');

(async () => {
    let info = await getVideoInfo("https://youtube.com/watch?v=kglEsR7bqAY");
    console.log(info);
})();
```
📈 **Output Contoh**
```json
{
  "status": true,
  "title": "Story Teaser: La vaguelette | Genshin Impact",
  "creator": "Genshin Impact",
  "duration": 159,
  "thumbnail": "https://i.ytimg.com/vi/kglEsR7bqAY/hq720.jpg",
  "views": 5674285,
  "uploaded": "3 bulan lalu",
  "url": "https://youtube.com/watch?v=kglEsR7bqAY"
}
```

---

### 🎵 **Download Audio (MP3)**
```javascript
const { downloadAudio } = require('hybrid-ytdl');

(async () => {
    let audio = await downloadAudio("https://youtube.com/watch?v=kglEsR7bqAY", "320", "api2"); // Pakai API 2 & bitrate 320kbps
    console.log(audio);
})();
```
📈 **Output Contoh**
```json
{
  "status": true,
  "downloadUrl": "https://ytdownloader.nvlgroup.my.id/audio?url=kglEsR7bqAY&bitrate=320",
  "source": "API 2: Nauval Group"
}
```
📅 **Catatan:**
- Jika tidak ada bitrate yang diinput, otomatis pakai **128kbps**.
- Jika bitrate custom (192, 320, dll.), otomatis pakai **API 2**.
- Bisa pilih API manual (**`api1`, `api2`, ..., `api5`**), atau kosong untuk otomatis.

---

### 🎥 **Download Video (MP4)**
```javascript
const { downloadVideo } = require('hybrid-ytdl');

(async () => {
    let video = await downloadVideo("https://youtube.com/watch?v=kglEsR7bqAY", "1080", "api2"); // Pakai API 2 & resolusi 1080p
    console.log(video);
})();
```
📈 **Output Contoh**
```json
{
  "status": true,
  "downloadUrl": "https://ytdownloader.nvlgroup.my.id/download?url=kglEsR7bqAY&resolution=1080",
  "source": "API 2: Nauval Group"
}
```
📅 **Catatan:**
- Jika tidak ada resolusi yang diinput, otomatis pakai **720p**.
- Jika resolusi custom (360, 1080, dll.), otomatis pakai **API 2**.
- Bisa pilih API manual (**`api1`, `api2`, ..., `api5`**), atau kosong untuk otomatis.

---

## 🔧 **Logika Pemilihan API**
| Opsi | API yang dipakai |
|---|---|
| **Bitrate/Resolusi Default** | Semua API bisa digunakan |
| **Bitrate/Resolusi Custom** | Hanya **API 2: Nauval Group & API 1: Cloudkuimages** yang dipakai |
| **Pilih API Manual** | Hanya API yang dipilih akan digunakan |
| **Otomatis** | API akan berpindah jika server gagal |

---

## 👤 **Support By:**
- AlfiDev  
- Naufal  
- CaliphDev  
- SiputzX  
- SuraWeb  
- FlowFalcon  

---

## 📜 **Lisensi**
MIT License

---

2025 **hybrid-ytdl**

