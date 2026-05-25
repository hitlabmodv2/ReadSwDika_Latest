/**
 * ───────────────────────────────
 *  Base Script : Bang Dika Ardnt
 *  Recode By   : Bang Wilykun
 *  WhatsApp    : 6289688206739
 *  Telegram    : @Wilykun1994
 * ───────────────────────────────
 *  Script ini khusus donasi/VIP
 *  Support dari kalian bikin saya
 *  makin semangat update fitur,
 *  fix bug, dan rawat script ini.
 *
 *  Dilarang menjual ulang script ini
 *  Tanpa izin resmi dari developer.
 *  Jika ketahuan = NO UPDATE / NO FIX
 *
 *  Hargai karya, gunakan dengan bijak.
 *  Terima kasih sudah support.
 * ───────────────────────────────
 */
'use strict';

/**
 * ─────────────────────────────────────────────────────
 *  FITUR   : Info Wibu Realtime
 *  Fungsi  : Pantau jadwal tayang anime dari AniList
 *            setiap 5 menit. Langsung kirim notifikasi
 *            ke grup WA saat ada episode baru tayang.
 *  Sumber  : AniList GraphQL API (gratis, tanpa login)
 * ─────────────────────────────────────────────────────
 */

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

// File dedup episode yang sudah dikirim (bukan pengaturan grup)
const FILE_DATA  = path.join(process.cwd(), 'data', 'infowibu', 'state.json');
fs.mkdirSync(path.join(process.cwd(), 'data', 'infowibu'), { recursive: true });
// File konfigurasi utama bot — pengaturan grup disimpan di sini
const FILE_CONFIG = path.join(process.cwd(), 'config.json');

// Alamat API AniList
const URL_ANILIST = 'https://graphql.anilist.co';

// ── FUNGSI BACA & SIMPAN DATA DEDUP ──────────────────────────────────────────

// Hanya menyimpan daftar ID episode yang sudah dikirim (dedup)
function bacaData() {
    try {
        if (fs.existsSync(FILE_DATA)) {
            return JSON.parse(fs.readFileSync(FILE_DATA, 'utf-8'));
        }
    } catch (_) {}
    return { idTerkirim: [] };
}

function simpanData(data) {
    try {
        fs.writeFileSync(FILE_DATA, JSON.stringify(data, null, 2), 'utf-8');
    } catch (_) {}
}

// ── BACA & SIMPAN CONFIG.JSON ─────────────────────────────────────────────────

function bacaConfig() {
    try {
        if (fs.existsSync(FILE_CONFIG)) {
            return JSON.parse(fs.readFileSync(FILE_CONFIG, 'utf-8'));
        }
    } catch (_) {}
    return {};
}

function simpanConfig(cfg) {
    try {
        fs.writeFileSync(FILE_CONFIG, JSON.stringify(cfg, null, 2), 'utf-8');
    } catch (_) {}
}

// ── PENGATURAN GRUP (DISIMPAN DI CONFIG.JSON) ─────────────────────────────────

// Aktifkan atau nonaktifkan infowibu di sebuah grup
function aturGrup(jidGrup, aktif) {
    const cfg = bacaConfig();
    if (!cfg.infowibu)              cfg.infowibu         = { enabled: true, groups: {} };
    if (!cfg.infowibu.groups)       cfg.infowibu.groups  = {};
    cfg.infowibu.groups[jidGrup]    = { enabled: aktif, diubahPada: Date.now() };
    simpanConfig(cfg);
}

// Cek apakah infowibu aktif di grup tertentu
function cekGrupAktif(jidGrup) {
    const cfg = bacaConfig();
    return !!(cfg.infowibu?.groups?.[jidGrup]?.enabled);
}

// Ambil daftar semua grup yang sudah diaktifkan
function daftarGrupAktif() {
    const cfg = bacaConfig();
    return Object.entries(cfg.infowibu?.groups || {})
        .filter(([, v]) => v.enabled)
        .map(([jid]) => jid);
}

// Ambil semua pengaturan grup (aktif maupun tidak) dari config.json
function semuaPengaturanGrup() {
    return bacaConfig().infowibu?.groups || {};
}

// ── PENCEGAH KIRIMAN DUPLIKAT ─────────────────────────────────────────────────

// Tandai episode sudah pernah dikirim supaya tidak dikirim dua kali
function tandaiSudahKirim(idUnik) {
    const data = bacaData();
    if (!data.idTerkirim) data.idTerkirim = [];
    // Simpan maksimal 500 ID terakhir
    data.idTerkirim = [String(idUnik), ...data.idTerkirim].slice(0, 500);
    simpanData(data);
}

// Cek apakah episode ini sudah pernah dikirim
function sudahPernahKirim(idUnik) {
    const data = bacaData();
    return (data.idTerkirim || []).includes(String(idUnik));
}

// Simpan waktu terakhir cek jadwal tayang
function simpanWaktuCek() {
    const data = bacaData();
    data.waktuCekTerakhir = Math.floor(Date.now() / 1000);
    simpanData(data);
}

// ── QUERY REALTIME: CEK JADWAL TAYANG ────────────────────────────────────────

// Query ini ambil episode yang tayang dalam rentang waktu tertentu
const QUERY_JADWAL_TAYANG = `
query ($dari: Int, $sampai: Int) {
  Page(perPage: 50) {
    airingSchedules(airingAt_greater: $dari, airingAt_lesser: $sampai, notYetAired: false) {
      episode
      airingAt
      media {
        id
        title { romaji native english }
        synonyms
        description(asHtml: false)
        episodes
        duration
        format
        source
        hashtag
        averageScore
        meanScore
        popularity
        favourites
        genres
        coverImage { extraLarge large }
        bannerImage
        siteUrl
        studios { nodes { name isAnimationStudio } }
        trailer { id site thumbnail }
        countryOfOrigin
        season
        seasonYear
        seasonInt
        status
        startDate { year month day }
        nextAiringEpisode { episode airingAt timeUntilAiring }
      }
    }
  }
}`;

// Ambil daftar episode yang baru saja tayang dalam rentang waktu (detik Unix)
async function cekEpisodeBaruTayang(dariDetik, sampaiDetik) {
    const { data } = await axios.post(
        URL_ANILIST,
        {
            query: QUERY_JADWAL_TAYANG,
            variables: { dari: dariDetik, sampai: sampaiDetik },
        },
        {
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            timeout: 15000,
        }
    );
    return data?.data?.Page?.airingSchedules || [];
}

// ── QUERY TRENDING: FALLBACK / SIMULASI ──────────────────────────────────────

// Query anime trending (dipakai untuk simulasi & fallback)
const QUERY_ANIME_TRENDING = `
query ($halaman: Int, $jumlah: Int) {
  Page(page: $halaman, perPage: $jumlah) {
    media(sort: TRENDING_DESC, type: ANIME, status: RELEASING) {
      id
      title { romaji native english }
      synonyms
      description(asHtml: false)
      episodes
      duration
      format
      source
      hashtag
      status
      season
      seasonYear
      averageScore
      meanScore
      popularity
      favourites
      genres
      coverImage { extraLarge large }
      bannerImage
      siteUrl
      studios { nodes { name isAnimationStudio } }
      trailer { id site thumbnail }
      countryOfOrigin
      startDate { year month day }
      nextAiringEpisode { episode airingAt timeUntilAiring }
    }
  }
}`;

async function ambilAnimeTrending(halaman = 1, jumlah = 10) {
    const { data } = await axios.post(
        URL_ANILIST,
        { query: QUERY_ANIME_TRENDING, variables: { halaman, jumlah } },
        {
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            timeout: 15000,
        }
    );
    return data?.data?.Page?.media || [];
}

// ── CARI EPISODE BARU YANG BELUM PERNAH DIKIRIM ──────────────────────────────

// Digunakan scheduler realtime — cek episode yang tayang 5 menit terakhir
async function cariEpisodeBaru(rentangMenit = 5) {
    const sekarang  = Math.floor(Date.now() / 1000);
    const dariDetik = sekarang - (rentangMenit * 60); // mundur N menit
    const jadwal    = await cekEpisodeBaruTayang(dariDetik, sekarang);

    const hasilBaru = [];
    for (const item of jadwal) {
        // Buat ID unik dari kombinasi ID anime + nomor episode
        const idUnik = `ep-${item.media?.id}-${item.episode}`;
        if (sudahPernahKirim(idUnik)) continue; // Lewati yang sudah dikirim
        if (!item.media) continue;
        hasilBaru.push({ episode: item.episode, tayangPada: item.airingAt, anime: item.media, idUnik });
    }

    return hasilBaru;
}

// ── TERJEMAHAN OTOMATIS KE BAHASA INDONESIA ──────────────────────────────────

// Terjemahkan teks ke Bahasa Indonesia menggunakan Google Translate gratis
async function terjemahkan(teks) {
    if (!teks || !teks.trim()) return teks;
    try {
        const url    = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=id&dt=t&q=${encodeURIComponent(teks)}`;
        const { data } = await axios.get(url, { timeout: 8000 });
        // Hasil terjemahan ada di data[0] berupa array array
        if (Array.isArray(data) && Array.isArray(data[0])) {
            return data[0].map(seg => seg?.[0] || '').join('').trim() || teks;
        }
    } catch (_) {}
    // Kalau terjemahan gagal, kembalikan teks asli
    return teks;
}

// Bersihkan teks deskripsi dari tag HTML & spasi berlebih
function bersihkanDeskripsi(teks, maks = 250) {
    let hasil = (teks || '')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
        .slice(0, maks);
    if ((teks || '').replace(/<[^>]+>/g, '').trim().length > maks) hasil += '...';
    return hasil;
}

// ── PETA MUSIM & HELPER GENRE ─────────────────────────────────────────────────


const PETA_MUSIM = {
    'SPRING' : 'Musim Semi',
    'SUMMER' : 'Musim Panas',
    'FALL'   : 'Musim Gugur',
    'WINTER' : 'Musim Dingin',
};

function terjemahkanGenre(daftarGenre) {
    return (daftarGenre || []).slice(0, 4).join(', ') || '-';
}

// Terjemahkan nama musim ke Bahasa Indonesia
function terjemahkanMusim(season, year) {
    if (!season) return '-';
    const namaMusim = PETA_MUSIM[String(season).toUpperCase()] || kapitalisasi(season);
    return year ? `${namaMusim} ${year}` : namaMusim;
}

// Terjemahkan status tayang anime ke Bahasa Indonesia
const PETA_STATUS = {
    'RELEASING'        : 'Sedang Tayang',
    'FINISHED'         : 'Tamat',
    'NOT_YET_RELEASED' : 'Belum Tayang',
    'CANCELLED'        : 'Dibatalkan',
    'HIATUS'           : 'Hiatus',
};
function terjemahkanStatus(status) {
    return PETA_STATUS[String(status || '').toUpperCase()] || status || '-';
}

// Terjemahkan format anime ke Bahasa Indonesia
const PETA_FORMAT = {
    'TV'       : 'TV',
    'TV_SHORT' : 'TV Short',
    'MOVIE'    : 'Film',
    'SPECIAL'  : 'Special',
    'OVA'      : 'OVA',
    'ONA'      : 'ONA',
    'MUSIC'    : 'Video Musik',
    'MANGA'    : 'Manga',
    'NOVEL'    : 'Novel',
    'ONE_SHOT' : 'One Shot',
};
function terjemahkanFormat(format) {
    return PETA_FORMAT[String(format || '').toUpperCase()] || format || '-';
}

// Terjemahkan sumber materi adaptasi ke Bahasa Indonesia
const PETA_SUMBER = {
    'ORIGINAL'      : 'Original',
    'MANGA'         : 'Manga',
    'LIGHT_NOVEL'   : 'Novel Ringan',
    'VISUAL_NOVEL'  : 'Visual Novel',
    'VIDEO_GAME'    : 'Video Game',
    'OTHER'         : 'Lainnya',
    'NOVEL'         : 'Novel',
    'DOUJINSHI'     : 'Doujinshi',
    'ANIME'         : 'Anime',
    'WEB_NOVEL'     : 'Web Novel',
    'LIVE_ACTION'   : 'Live Action',
    'GAME'          : 'Game',
    'COMIC'         : 'Komik',
    'MULTIMEDIA_PROJECT' : 'Multimedia',
};
function terjemahkanSumber(source) {
    return PETA_SUMBER[String(source || '').toUpperCase()] || source || '-';
}

// Format tanggal mulai tayang ke Bahasa Indonesia
function formatTanggalMulai(startDate) {
    if (!startDate?.year) return '-';
    const { year, month, day } = startDate;
    if (!month) return String(year);
    try {
        const tgl = new Date(year, month - 1, day || 1);
        return tgl.toLocaleDateString('id-ID', { day: day ? 'numeric' : undefined, month: 'short', year: 'numeric' });
    } catch (_) {
        return `${day || ''} ${month}/${year}`.trim();
    }
}

// Ubah detik tersisa menjadi format "Xh Ym" atau "Xd Yh Zm"
function formatSisaWaktu(detik) {
    if (!detik || detik <= 0) return null;
    const hari  = Math.floor(detik / 86400);
    const jam   = Math.floor((detik % 86400) / 3600);
    const menit = Math.floor((detik % 3600) / 60);
    if (hari > 0) return `${hari}h ${jam}j ${menit}m`;
    if (jam > 0)  return `${jam}j ${menit}m`;
    return `${menit}m`;
}

// Buat progress bar episode — contoh: [▓▓▓▓▓░░░░░]
function buatProgressBar(sekarang, total, panjang = 10) {
    if (!total || total <= 0) return '';
    const isi    = Math.round((sekarang / total) * panjang);
    const kosong = panjang - isi;
    const bar    = '▓'.repeat(Math.max(0, isi)) + '░'.repeat(Math.max(0, kosong));
    return `[${bar}]`;
}

// ── FORMAT CAPTION REALTIME (NOTIF EPISODE BARU) ──────────────────────────────

// Separator garis tebal & tipis untuk WhatsApp
const SEP  = '━━━━━━━━━━━━━━━━━━';
const SEP2 = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';

// Buat baris info dengan ├ / ╰ otomatis — item kosong/null dilewati
function buatBarisInfo(items) {
    const valid = items.filter(([, val]) => val !== null && val !== undefined && val !== '' && val !== '-');
    return valid.map(([label, val], i) => {
        const prefix = i === valid.length - 1 ? '╰' : '├';
        return `${prefix} ${label} : ${val}`;
    }).join('\n');
}

// Format tanggal tayang berikutnya: ringkas untuk HP
// Contoh: "Min, 17 Mei 23.00"
function formatTanggalTayang(detikUnix) {
    const wkt = new Date(detikUnix * 1000);
    const tgl = wkt.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' });
    const jam = wkt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
    return `${tgl} ${jam}`;
}

// Fungsi ini async karena perlu terjemah sinopsis ke Bahasa Indonesia
async function buatCaptionEpisode(item) {
    const a      = item.anime;
    const judul  = a.title?.romaji || a.title?.english || a.title?.native || '?';
    const musim  = terjemahkanMusim(a.season, a.seasonYear);
    const { studio, produsen } = pisahkanStudioProdusen(a.studios);

    // Progress episode
    const totalEps   = a.episodes || 0;
    const epSekarang = item.episode;
    const progresBar = totalEps > 0 ? buatProgressBar(epSekarang, totalEps) : null;

    // Countdown ep berikutnya — format ringkas
    let epBerikutnya = '';
    if (a.nextAiringEpisode) {
        const nEp     = a.nextAiringEpisode.episode;
        const tglJam  = formatTanggalTayang(a.nextAiringEpisode.airingAt);
        const sisaWkt = formatSisaWaktu(a.nextAiringEpisode.timeUntilAiring);
        epBerikutnya  = `📅 Ep ${nEp} • ${tglJam}${sisaWkt ? ` _( ${sisaWkt} lagi)_` : ''}`;
    }

    // Info anime
    const statusIndo   = terjemahkanStatus(a.status);
    const formatAnime  = terjemahkanFormat(a.format);
    const sumber       = terjemahkanSumber(a.source);
    const tanggalMulai = formatTanggalMulai(a.startDate);
    const durasi       = a.duration ? `${a.duration} mnt/eps` : '';
    const popularitas  = a.popularity ? a.popularity.toLocaleString('id-ID') : '-';
    const favorit      = a.favourites ? a.favourites.toLocaleString('id-ID') : '-';
    const hashtag      = a.hashtag || '';
    const semuaGenre   = (a.genres || []).slice(0, 4).join(', ') || '-';
    const urlTrailer   = ambilUrlTrailer(a.trailer);
    const negara       = labelNegara(a.countryOfOrigin);
    const formatFull   = negara ? `${formatAnime} (${negara})` : formatAnime;

    // Judul native & inggris
    const judulNative  = a.title?.native  ? `_${a.title.native}_` : '';
    const judulInggris = a.title?.english && a.title.english !== judul ? `_${a.title.english}_` : '';
    const barisTambahan = [judulNative, judulInggris].filter(Boolean).join('\n');

    // Semua sinonim — trim spasi, maks 7
    const sinonimList = (a.synonyms || [])
        .map(s => (s || '').trim())
        .filter(s => s.length > 0 && s.length <= 100)
        .slice(0, 7)
        .map(s => `≡ _${s}_`)
        .join('\n');

    // Sinopsis
    const deskripsiAsli = bersihkanDeskripsi(a.description, 350);
    const deskripsi     = await terjemahkan(deskripsiAsli);
    const sinopsisBlock = deskripsi.split('\n').map(b => `> ${b}`).join('\n');

    const waktuKirim = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    // Baris progress episode
    const barisEpHead = totalEps > 0
        ? `📺 *Ep ${epSekarang}/${totalEps}* _(${Math.round((epSekarang / totalEps) * 100)}%)_`
        : `📺 *Ep ${epSekarang}*`;
    const barisEpBar  = progresBar ? `\`${progresBar}\`` : '';

    const skorTeks = a.averageScore && a.meanScore
        ? `${a.averageScore}%  📊 ${a.meanScore}%`
        : a.averageScore ? `${a.averageScore}%`
        : a.meanScore    ? `📊 ${a.meanScore}%`
        : null;

    const seksi1 = buatBarisInfo([
        ['🗂️ *Format*  ', formatFull],
        ['⏱️ *Durasi*  ', durasi || null],
        ['📦 *Episode* ', totalEps > 0 ? `${totalEps} eps` : null],
        ['📚 *Sumber*  ', sumber !== '-' ? `_${sumber}_` : null],
        ['🗓️ *Mulai*   ', tanggalMulai !== '-' ? tanggalMulai : null],
        ['🌸 *Musim*   ', musim !== '-' ? `_${musim}_` : null],
        ['📡 *Status*  ', statusIndo !== '-' ? `_${statusIndo}_` : null],
        ['🏢 *Studio*  ', studio !== '-' ? `_${studio}_` : null],
        ['🏭 *Produser*', produsen !== '-' ? `_${produsen}_` : null],
    ]);

    const seksi2 = buatBarisInfo([
        ['⭐ *Skor*    ', skorTeks],
        ['👥 *Populer* ', popularitas !== '-' ? popularitas : null],
        ['❤️ *Favorit* ', favorit !== '-' ? favorit : null],
        ['🎭 *Genre*   ', semuaGenre !== '-' ? `_${semuaGenre}_` : null],
        ['🏷️ *Hashtag* ', hashtag || null],
    ]);

    return (
        `🔴 *REALTIME INFO WIBU!*\n` +
        `${SEP}\n\n` +
        `🎌 *${judul}*\n` +
        `${barisTambahan ? barisTambahan + '\n' : ''}` +
        `${sinonimList ? sinonimList + '\n' : ''}` +
        `\n${barisEpHead}\n` +
        `${barisEpBar ? barisEpBar + '\n' : ''}` +
        `${epBerikutnya ? epBerikutnya + '\n' : ''}` +
        `\n📖 *Sinopsis*\n` +
        `${sinopsisBlock}\n\n` +
        `${SEP}\n` +
        `📋 *Info Anime*\n` +
        `${SEP2}\n` +
        `${seksi1}\n` +
        `${SEP2}\n` +
        `${seksi2}\n` +
        `${SEP}\n` +
        `${urlTrailer ? `🎬 *PV*   : ${urlTrailer}\n` : ''}` +
        `🔗 *Link*  : anilist.co/anime/${a.id || ''}\n` +
        `🕐 _${waktuKirim} WIB_`
    );
}

// Format caption untuk trending (simulasi & fallback) — juga async
async function buatCaption(post, opsi = {}) {
    const a      = post.anime;
    const judul  = a.title?.romaji || a.title?.english || a.title?.native || '?';
    const musim  = terjemahkanMusim(a.season, a.seasonYear);
    const { studio, produsen } = pisahkanStudioProdusen(a.studios);

    const formatAnime  = terjemahkanFormat(a.format);
    const sumber       = terjemahkanSumber(a.source);
    const statusIndo   = terjemahkanStatus(a.status);
    const tanggalMulai = formatTanggalMulai(a.startDate);
    const durasi       = a.duration ? `${a.duration} mnt/eps` : '';
    const popularitas  = a.popularity ? a.popularity.toLocaleString('id-ID') : '-';
    const favorit      = a.favourites ? a.favourites.toLocaleString('id-ID') : '-';
    const hashtag      = a.hashtag || '';
    const semuaGenre   = (a.genres || []).slice(0, 4).join(', ') || '-';
    const totalEps     = a.episodes ? `${a.episodes} eps` : '?';
    const urlTrailer   = ambilUrlTrailer(a.trailer);
    const negara       = labelNegara(a.countryOfOrigin);
    const formatFull   = negara ? `${formatAnime} (${negara})` : formatAnime;

    const judulNative  = a.title?.native  ? `_${a.title.native}_`  : '';
    const judulInggris = a.title?.english && a.title.english !== judul ? `_${a.title.english}_` : '';
    const barisTambahan = [judulNative, judulInggris].filter(Boolean).join('\n');

    const sinonimList = (a.synonyms || [])
        .map(s => (s || '').trim())
        .filter(s => s.length > 0 && s.length <= 100)
        .slice(0, 7)
        .map(s => `≡ _${s}_`)
        .join('\n');

    let epBerikutnya = '';
    if (a.nextAiringEpisode) {
        const nEp     = a.nextAiringEpisode.episode;
        const tglJam  = formatTanggalTayang(a.nextAiringEpisode.airingAt);
        const sisaWkt = formatSisaWaktu(a.nextAiringEpisode.timeUntilAiring);
        epBerikutnya  = `📅 Ep ${nEp} • ${tglJam}${sisaWkt ? ` _( ${sisaWkt} lagi)_` : ''}`;
    }

    const deskripsiAsli = bersihkanDeskripsi(a.description, 350);
    const deskripsi     = await terjemahkan(deskripsiAsli);
    const waktuKirim    = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
    const sinopsisBlock = deskripsi.split('\n').map(b => `> ${b}`).join('\n');

    const skorTeks = a.averageScore && a.meanScore
        ? `${a.averageScore}%  📊 ${a.meanScore}%`
        : a.averageScore ? `${a.averageScore}%`
        : a.meanScore    ? `📊 ${a.meanScore}%`
        : null;

    const seksi1 = buatBarisInfo([
        ['🗂️ *Format*  ', formatFull],
        ['⏱️ *Durasi*  ', durasi || null],
        ['📦 *Episode* ', a.episodes ? `${a.episodes} eps` : null],
        ['📚 *Sumber*  ', sumber !== '-' ? `_${sumber}_` : null],
        ['🗓️ *Mulai*   ', tanggalMulai !== '-' ? tanggalMulai : null],
        ['🌸 *Musim*   ', musim !== '-' ? `_${musim}_` : null],
        ['📡 *Status*  ', statusIndo !== '-' ? `_${statusIndo}_` : null],
        ['🏢 *Studio*  ', studio !== '-' ? `_${studio}_` : null],
        ['🏭 *Produser*', produsen !== '-' ? `_${produsen}_` : null],
    ]);

    const seksi2 = buatBarisInfo([
        ['⭐ *Skor*    ', skorTeks],
        ['👥 *Populer* ', popularitas !== '-' ? popularitas : null],
        ['❤️ *Favorit* ', favorit !== '-' ? favorit : null],
        ['🎭 *Genre*   ', semuaGenre !== '-' ? `_${semuaGenre}_` : null],
        ['🏷️ *Hashtag* ', hashtag || null],
    ]);

    return (
        `📢 *INFO WIBU*\n` +
        `${SEP}\n\n` +
        `🎌 *${judul}*\n` +
        `${barisTambahan ? barisTambahan + '\n' : ''}` +
        `${sinonimList ? sinonimList + '\n' : ''}` +
        `\n📺 *Total:* ${totalEps}\n` +
        `${epBerikutnya ? epBerikutnya + '\n' : ''}` +
        `\n📖 *Sinopsis*\n` +
        `${sinopsisBlock}\n\n` +
        `${SEP}\n` +
        `📋 *Info Anime*\n` +
        `${SEP2}\n` +
        `${seksi1}\n` +
        `${SEP2}\n` +
        `${seksi2}\n` +
        `${SEP}\n` +
        `${urlTrailer ? `🎬 *PV*   : ${urlTrailer}\n` : ''}` +
        `🔗 *Link*  : anilist.co/anime/${a.id || ''}\n` +
        `🕐 _${waktuKirim} WIB_`
    );
}

// ── FUNGSI BANTU ──────────────────────────────────────────────────────────────

function kapitalisasi(str) {
    return String(str || '').toLowerCase().replace(/^\w/, c => c.toUpperCase());
}

// Ambil URL gambar terbaik (cover portrait lebih cocok di WhatsApp, banner terlalu lebar)
function ambilUrlGambar(post) {
    const a = post.anime || post;
    return a.coverImage?.extraLarge || a.coverImage?.large || a.bannerImage || null;
}

// Buat URL trailer/PV dari data trailer AniList
function ambilUrlTrailer(trailer) {
    if (!trailer?.id) return null;
    const site = (trailer.site || '').toLowerCase();
    if (site === 'youtube')     return `https://www.youtube.com/watch?v=${trailer.id}`;
    if (site === 'dailymotion') return `https://www.dailymotion.com/video/${trailer.id}`;
    return null;
}

// Terjemahkan kode negara asal ke label bahasa Indonesia
const PETA_NEGARA = {
    'JP': '',
    'CN': 'Chinese',
    'KR': 'Korean',
    'TW': 'Taiwanese',
};
function labelNegara(countryOfOrigin) {
    return PETA_NEGARA[String(countryOfOrigin || '').toUpperCase()] || '';
}

// Pisahkan studio animasi dan produser dari daftar studios AniList
function pisahkanStudioProdusen(studios) {
    const nodes    = studios?.nodes || [];
    const studioList   = nodes.filter(n => n.isAnimationStudio).map(n => n.name);
    const produsenList = nodes.filter(n => !n.isAnimationStudio).map(n => n.name).slice(0, 4);
    return {
        studio  : studioList.join(', ') || '-',
        produsen: produsenList.join(', ') || '-',
    };
}

// ── SIMULASI / TES KIRIM ──────────────────────────────────────────────────────

// Simulasi realtime: cek jadwal tayang 24 jam ke belakang supaya pasti ada data
async function simulasi() {
    // Coba cek jadwal 24 jam ke belakang untuk simulasi
    const sekarang  = Math.floor(Date.now() / 1000);
    const dariDetik = sekarang - (24 * 60 * 60); // 24 jam ke belakang
    const jadwal    = await cekEpisodeBaruTayang(dariDetik, sekarang);

    if (jadwal.length > 0) {
        // Pakai episode terbaru yang ditemukan
        const item   = jadwal[jadwal.length - 1];
        const post   = { episode: item.episode, tayangPada: item.airingAt, anime: item.media, idUnik: `ep-${item.media?.id}-${item.episode}` };
        return {
            caption  : await buatCaptionEpisode(post),
            urlGambar: ambilUrlGambar(post),
            judul    : item.media?.title?.romaji || item.media?.title?.english || '?',
            idUnik   : post.idUnik,
            tipe     : 'realtime-episode',
        };
    }

    // Fallback ke trending kalau tidak ada jadwal
    const daftar = await ambilAnimeTrending(1, 5);
    if (!daftar.length) throw new Error('Tidak ada data anime dari AniList. Coba lagi nanti.');
    const anime = daftar[0];
    const post  = { sumber: 'anilist', anime, idUnik: `al-${anime.id}` };
    return {
        caption  : await buatCaption(post, { realtime: true }),
        urlGambar: ambilUrlGambar(post),
        judul    : anime.title?.romaji || anime.title?.english || '?',
        idUnik   : post.idUnik,
        tipe     : 'trending-fallback',
    };
}

// ── EKSPOR FUNGSI ─────────────────────────────────────────────────────────────

module.exports = {
    bacaData,
    simpanData,
    aturGrup,
    cekGrupAktif,
    daftarGrupAktif,
    semuaPengaturanGrup,
    tandaiSudahKirim,
    sudahPernahKirim,
    simpanWaktuCek,
    cekEpisodeBaruTayang,
    ambilAnimeTrending,
    cariEpisodeBaru,
    buatCaptionEpisode,
    buatCaption,
    ambilUrlGambar,
    simulasi,

    // Alias nama lama supaya bagian lain bot tidak error
    setGroupEnabled    : aturGrup,
    isGroupEnabled     : cekGrupAktif,
    getEnabledGroups   : daftarGrupAktif,
    getAllGroupSettings : semuaPengaturanGrup,
    markSent           : tandaiSudahKirim,
    alreadySent        : sudahPernahKirim,
    fetchTrendingAnime : ambilAnimeTrending,
    fetchFreshPost     : async () => {
        const hasil = await module.exports.cariEpisodeBaru(360); // fallback 6 jam
        return hasil?.[0] ? { anime: hasil[0].anime, uid: hasil[0].idUnik, ...hasil[0] } : null;
    },
    formatCaption      : buatCaption,
    getCoverUrl        : ambilUrlGambar,
    simulate           : simulasi,
};
