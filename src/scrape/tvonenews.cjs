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
 *  FITUR   : TVOne News Realtime
 *  Fungsi  : Pantau berita terbaru dari tvonenews.com
 *            setiap 5 menit. Kirim notifikasi ke grup
 *            WA saat ada berita baru.
 *  Sumber  : tvonenews.com (scraping HTML)
 * ─────────────────────────────────────────────────────
 */

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const FILE_DATA   = path.join(process.cwd(), 'data', 'tvonenews', 'state.json');
const FILE_LOG    = path.join(process.cwd(), 'data', 'tvonenews', 'log.json');
fs.mkdirSync(path.join(process.cwd(), 'data', 'tvonenews'), { recursive: true });
const FILE_CONFIG = path.join(process.cwd(), 'config.json');
const BASE_URL    = 'https://www.tvonenews.com';
const HEADERS     = {
    'User-Agent'     : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept'         : 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
};

// Max ID yang disimpan di list dedup
const MAX_SEEN = 500;

// ── BACA / SIMPAN DATA ────────────────────────────────────────────────────────

function bacaData() {
    try {
        if (fs.existsSync(FILE_DATA)) return JSON.parse(fs.readFileSync(FILE_DATA, 'utf-8'));
    } catch (_) {}
    return { idTerkirim: [], lastCheckTime: null, maxSeenId: 0 };
}

function simpanData(data) {
    try { fs.writeFileSync(FILE_DATA, JSON.stringify(data, null, 2), 'utf-8'); } catch (_) {}
}

function bacaLog() {
    try {
        if (fs.existsSync(FILE_LOG)) return JSON.parse(fs.readFileSync(FILE_LOG, 'utf-8'));
    } catch (_) {}
    return { terkirim: [] };
}

function simpanLog(log) {
    try { fs.writeFileSync(FILE_LOG, JSON.stringify(log, null, 2), 'utf-8'); } catch (_) {}
}

// ── CONFIG / GRUP ─────────────────────────────────────────────────────────────

function bacaConfig() {
    try {
        if (fs.existsSync(FILE_CONFIG)) return JSON.parse(fs.readFileSync(FILE_CONFIG, 'utf-8'));
    } catch (_) {}
    return {};
}

function simpanConfig(cfg) {
    try { fs.writeFileSync(FILE_CONFIG, JSON.stringify(cfg, null, 2), 'utf-8'); } catch (_) {}
}

function setGroupEnabled(jidGrup, aktif) {
    const cfg = bacaConfig();
    if (!cfg.tvonenews)        cfg.tvonenews        = { groups: {} };
    if (!cfg.tvonenews.groups) cfg.tvonenews.groups = {};
    cfg.tvonenews.groups[jidGrup] = { enabled: aktif, diubahPada: Date.now() };
    simpanConfig(cfg);
}

function getEnabledGroups() {
    const cfg    = bacaConfig();
    const groups = cfg.tvonenews?.groups || {};
    return Object.entries(groups)
        .filter(([, v]) => v.enabled === true)
        .map(([jid]) => jid);
}

// ── HELPER ────────────────────────────────────────────────────────────────────

function stripHtml(teks) {
    return (teks || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ')
        .replace(/&#(\d+);/g, (_, n) => {
            try { return String.fromCodePoint(parseInt(n)); } catch (_) { return ''; }
        })
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function idDariUrl(url) {
    const m = url.match(/\/(\d{4,12})-/);
    return m ? m[1] : null;
}

function kategoriDariUrl(url) {
    const bagian = url.replace(BASE_URL, '').split('/').filter(Boolean);
    // /berita/nasional/439944-xxx  → "Berita › Nasional"
    // /ekonomi/439946-xxx          → "Ekonomi"
    const bersih = bagian.filter(b => !/^\d/.test(b));
    return bersih.map(b => b.charAt(0).toUpperCase() + b.slice(1)).join(' › ');
}

// Hapus suffix ukuran thumbnail → gambar original
// contoh: _375_211.jpg → .jpg ; _488_274.jpg → .jpg
function gambarHD(thumbUrl) {
    if (!thumbUrl) return null;
    return thumbUrl.replace(/_\d+_\d+(\.[a-z]+)$/i, '$1');
}

// ── FETCH DENGAN RETRY ────────────────────────────────────────────────────────

async function fetchDenganRetry(fn, maxRetry = 3, delayMs = 3000) {
    let lastErr;
    for (let i = 0; i < maxRetry; i++) {
        try { return await fn(); }
        catch (e) {
            lastErr = e;
            if (i < maxRetry - 1) await new Promise(r => setTimeout(r, delayMs));
        }
    }
    throw lastErr;
}

async function fetchHtml(url) {
    return fetchDenganRetry(async () => {
        const r = await axios.get(url, { headers: HEADERS, timeout: 20000 });
        return r.data;
    });
}

// ── PARSE DAFTAR ARTIKEL DARI HOMEPAGE ───────────────────────────────────────

function parseArtikelList(html) {
    const artikel = [];
    const seen    = new Set();

    // Helper: proses satu blok HTML untuk ekstrak artikel
    function prosesBlok(blok) {
        // URL artikel (harus ada ID angka, range diperluas ke 4-12 digit)
        const urlM = blok.match(/href="(https:\/\/www\.tvonenews\.com\/[^"]+\/\d{4,12}-[^"]+)"/);
        if (!urlM) return;
        const url   = urlM[1].split('"')[0];
        const artId = idDariUrl(url);
        if (!artId || seen.has(artId)) return;
        seen.add(artId);

        // Judul dari <h2> atau <h3>
        const h2M = blok.match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/);
        if (!h2M) return;
        const judul = stripHtml(h2M[1]);
        if (!judul) return;

        // Thumbnail — coba data-original, data-src, lalu src
        const imgM  =
            blok.match(/data-original="(https?:\/\/(?:thumbs\.)?tvonenews\.com\/[^"]+)"/) ||
            blok.match(/data-src="(https?:\/\/(?:thumbs\.)?tvonenews\.com\/[^"]+)"/) ||
            blok.match(/src="(https?:\/\/(?:thumbs\.)?tvonenews\.com\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/i);
        const thumb = imgM ? imgM[1] : null;

        // Kategori
        const catM     = blok.match(/class="ali-cate[^"]*"[^>]*>([\s\S]{0,150})/);
        const kategori = catM ? stripHtml(catM[1]) : kategoriDariUrl(url);

        artikel.push({ artId, url, judul, thumb, kategori });
    }

    // Strategi 1: blok article-list-row
    const rowRe = /class="article-list-row"([\s\S]{80,3000}?)(?=class="article-list-row"|class="btn btn-more|<\/section>|<\/div>\s*<\/div>\s*<\/section>|$)/g;
    let m;
    while ((m = rowRe.exec(html)) !== null) prosesBlok(m[1]);

    // Strategi 2: blok alt-link (section hero/featured di atas)
    const altRe = /<a[^>]*class="[^"]*alt-link[^"]*"[^>]*href="(https:\/\/www\.tvonenews\.com\/[^"]+\/\d{4,12}-[^"]+)"[^>]*>([\s\S]{0,600}?)<\/a>/g;
    while ((m = altRe.exec(html)) !== null) {
        const url   = m[1];
        const artId = idDariUrl(url);
        if (!artId || seen.has(artId)) continue;
        seen.add(artId);

        // Judul dari aria-label / alt di tag <a>, atau teks dalam blok
        const aTag  = html.slice(Math.max(0, m.index - 10), m.index + 400);
        const ariaM = aTag.match(/aria-label="([^"]{5,200})"/);
        const judul = ariaM ? stripHtml(ariaM[1]) : stripHtml(m[2]).slice(0, 150);
        if (!judul || judul.length < 10) continue;

        const imgM  =
            m[2].match(/data-original="(https?:\/\/(?:thumbs\.)?tvonenews\.com\/[^"]+)"/) ||
            m[2].match(/data-src="(https?:\/\/(?:thumbs\.)?tvonenews\.com\/[^"]+)"/);
        const thumb    = imgM ? imgM[1] : null;
        const kategori = kategoriDariUrl(url);

        artikel.push({ artId, url, judul, thumb, kategori });
    }

    // Strategi 3: fallback total jika masih sedikit
    if (artikel.length < 3) {
        const linkRe = /href="(https:\/\/www\.tvonenews\.com\/[^"]+\/\d{4,12}-[^"]+)"[^>]*>([\s\S]{0,800})(?=href="|$)/g;
        while ((m = linkRe.exec(html)) !== null) {
            const url   = m[1].split('"')[0];
            const artId = idDariUrl(url);
            if (!artId || seen.has(artId)) continue;
            seen.add(artId);
            const h2M  = m[2].match(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/);
            const judul = h2M ? stripHtml(h2M[1]) : stripHtml(m[2]).slice(0, 120);
            if (!judul || judul.length < 10) continue;
            const imgM =
                m[2].match(/data-original="(https?:\/\/(?:thumbs\.)?tvonenews\.com\/[^"]+)"/) ||
                m[2].match(/data-src="(https?:\/\/(?:thumbs\.)?tvonenews\.com\/[^"]+)"/);
            artikel.push({ artId, url, judul, thumb: imgM ? imgM[1] : null, kategori: kategoriDariUrl(url) });
        }
    }

    return artikel;
}

// ── PARSE DETAIL ARTIKEL ──────────────────────────────────────────────────────

function parseDetailArtikel(html, url) {
    // Judul H1
    const judulM = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const judul  = judulM ? stripHtml(judulM[1]) : '';

    // Tanggal terbit: "Rabu, 13 Mei 2026 - 07:26 WIB"
    const dateM   = html.match(/class="detail-date"[^>]*>\s*([\s\S]{5,80}?)\s*</);
    const tanggal = dateM ? stripHtml(dateM[1]) : '';

    // OG image → kualitas terbaik yang disediakan web
    const ogM     = html.match(/property="og:image"[^>]+content="([^"]+)"/);
    const rawCover = ogM ? ogM[1] : null;

    // Fallback: gambar pertama di detail-media
    const mediaM     = html.match(/class="detail-(?:media|img)[^"]*"[\s\S]{0,800}?(?:src|data-original)="(https?:\/\/thumbs\.tvonenews\.com\/[^"]+)"/);
    const rawFallback = mediaM ? mediaM[1] : null;

    // Ambil cover HD (hapus suffix ukuran dari thumbnail)
    const cover = gambarHD(rawCover) || gambarHD(rawFallback) || rawCover || rawFallback;

    // Penulis / reporter — ada di class="detail-author-link"
    const authorLinkM = html.match(/class="detail-author-link"[^>]*>\s*([\s\S]{2,80}?)\s*<\/div>/);
    const penulis     = authorLinkM ? stripHtml(authorLinkM[1]) : '';

    // Kategori dari breadcrumb
    const bcLinks = [...html.matchAll(/class="breadcrumb-step"[^>]+href="https:\/\/www\.tvonenews\.com\/([^"/]+)(?:\/([^"/]+))?[^"]*"[^>]*>([^<]+)<\/a>/g)];
    let kategori = '';
    if (bcLinks.length >= 2) {
        const parts = bcLinks.slice(1).map(x => stripHtml(x[3])).filter(Boolean);
        kategori = parts.join(' › ');
    }
    if (!kategori) kategori = kategoriDariUrl(url);

    // Konten artikel — strip iklan & noise
    const kontenM = html.match(/class="detail-content"[^>]*>([\s\S]{0,25000})/);
    let ringkasan = '';
    if (kontenM) {
        const raw = kontenM[1]
            // Hapus tag script/style
            .replace(/<script[\s\S]*?<\/script>/gi, '')
            .replace(/<style[\s\S]*?<\/style>/gi, '')
            // Hapus div "Baca Juga" (class rancak-bacajuga dan variannya)
            .replace(/<div[^>]*rancak-bacajuga[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '')
            .replace(/<div[^>]*(?:baca-?juga|read-?also|related)[^>]*>[\s\S]*?<\/div>/gi, '')
            // Hapus div iklan/ads
            .replace(/<div[^>]*(?:iklan|ads|advert)[^>]*>[\s\S]*?<\/div>/gi, '')
            // Hapus blok "Artikel ini sudah tayang..."
            .replace(/<[^>]+>\s*Artikel ini sudah tayang[\s\S]*?<\/[^>]+>/gi, '')
            // Hapus tag <aside>, <figure> sepenuhnya
            .replace(/<aside[\s\S]*?<\/aside>/gi, '')
            .replace(/<figure[\s\S]*?<\/figure>/gi, '');

        let teks = stripHtml(raw)
            // Hapus sisa noise teks
            .replace(/ADVERTISEMENT/gi, '')
            .replace(/GULIR UNTUK LANJUT BACA/gi, '')
            .replace(/Artikel ini sudah tayang[^.]*\./gi, '')
            .replace(/Judul Artikel\s*:[^\n.]*[.\n]/gi, '')
            .replace(/Link Artikel\s*:[^\n.]*[.\n]/gi, '')
            .replace(/Oleh\s*:\s*Reporter[^\n.]*[.\n]/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();

        const BATAS = 1500;
        if (teks.length > BATAS) {
            const cut       = teks.slice(0, BATAS);
            const lastTitik = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('! '), cut.lastIndexOf('? '));
            ringkasan = lastTitik > 600
                ? cut.slice(0, lastTitik + 1).trimEnd()
                : cut.slice(0, cut.lastIndexOf(' ')).trimEnd() + '...';
        } else {
            ringkasan = teks;
        }
    }

    // Fallback: meta description
    if (!ringkasan) {
        const descM = html.match(/name="description"[^>]+content="([^"]{10,400})"/);
        ringkasan = descM ? descM[1] : '';
    }

    return { judul, tanggal, cover, penulis, kategori, ringkasan, url };
}

// ── DEDUP ─────────────────────────────────────────────────────────────────────

function sudahDikirim(id) {
    return (bacaData().idTerkirim || []).includes(String(id));
}

function tandaiSudahKirim(id) {
    const data = bacaData();
    if (!data.idTerkirim) data.idTerkirim = [];
    if (!data.idTerkirim.includes(String(id))) {
        data.idTerkirim.unshift(String(id));
        if (data.idTerkirim.length > MAX_SEEN) data.idTerkirim = data.idTerkirim.slice(0, MAX_SEEN);
        simpanData(data);
    }
}

function tandaiDanLog(item, grupList) {
    tandaiSudahKirim(item.artId);
    try {
        const log = bacaLog();
        if (!Array.isArray(log.terkirim)) log.terkirim = [];
        if (!log.terkirim.some(e => String(e.artId) === String(item.artId))) {
            log.terkirim.unshift({
                artId     : String(item.artId),
                judul     : item.judul || '-',
                kategori  : item.kategori || '',
                tanggal   : item.tanggal || null,
                penulis   : item.penulis || '',
                waktuKirim: new Date().toISOString(),
                grupCount : grupList.length,
                grupList,
                cover     : item.cover || null,
                url       : item.url,
            });
            if (log.terkirim.length > 300) log.terkirim = log.terkirim.slice(0, 300);
            simpanLog(log);
        }
    } catch (e) {
        console.warn('[TVOneNews] Gagal simpan log:', e?.message);
    }
}

function getRecentLog(jumlah = 20) {
    return (bacaLog().terkirim || []).slice(0, jumlah);
}

// ── CARI BERITA BARU (REALTIME) ───────────────────────────────────────────────

async function cariBeritaBaru() {
    const now  = Date.now();
    const data = bacaData();

    const prevMaxId = parseInt(data.maxSeenId || 0, 10);
    const isFirstRun = !data.lastCheckTime;
    data.lastCheckTime = now;
    if (!data.idTerkirim) data.idTerkirim = [];

    let htmlHome = '';
    try {
        htmlHome = await fetchHtml(BASE_URL);
    } catch (e) {
        console.error('[TVOneNews] ❌ Gagal fetch homepage:', e?.message);
        return [];
    }

    const artikelList = parseArtikelList(htmlHome);

    // Hitung maxSeenId dari SEMUA URL artikel di halaman (termasuk yg tidak diparse)
    // Kumpulkan SEMUA ID artikel dari seluruh halaman (termasuk yg tidak diparse)
    const semuaUrlHits = [...htmlHome.matchAll(/href="(https:\/\/www\.tvonenews\.com\/[^"]+\/(\d{4,12})-[^"]+)"/g)];
    const semuaUrlMap  = new Map(); // id → url
    for (const hit of semuaUrlHits) {
        const id = parseInt(hit[2], 10);
        if (!isNaN(id) && !semuaUrlMap.has(id)) semuaUrlMap.set(id, hit[1]);
    }

    // maxSeenId TIDAK PERNAH turun
    const maxIdHalaman  = semuaUrlMap.size ? Math.max(...semuaUrlMap.keys()) : prevMaxId;
    const maxIdSekarang = Math.max(prevMaxId, maxIdHalaman);

    // Tandai semua artikel halaman sebagai sudah dilihat & simpan
    data.maxSeenId = maxIdSekarang;
    simpanData(data);
    for (const art of artikelList) tandaiSudahKirim(art.artId);

    if (isFirstRun || prevMaxId === 0) {
        return [];
    }

    // Artikel baru = semua ID > prevMaxId yang ada di halaman sekarang
    const idBaru = [...semuaUrlMap.keys()].filter(id => id > prevMaxId).sort((a, b) => a - b);

    if (!idBaru.length) return [];

    // Gabungkan dengan data parser jika ada, fallback ke fetch detail
    const artikelByID = new Map(artikelList.map(a => [parseInt(a.artId, 10), a]));

    const baru = [];
    for (const id of idBaru) {
        const url  = semuaUrlMap.get(id);
        const base = artikelByID.get(id) || { artId: String(id), url, judul: '', thumb: null, kategori: kategoriDariUrl(url) };
        try {
            const htmlDetail = await fetchHtml(url);
            const detail     = parseDetailArtikel(htmlDetail, url);
            baru.push({
                ...base,
                ...detail,
                artId: String(id),
                cover: detail.cover || gambarHD(base.thumb) || base.thumb,
            });
        } catch (e) {
            console.warn(`[TVOneNews] ❌ Detail gagal (${id}):`, e?.message);
            baru.push({ ...base, cover: gambarHD(base.thumb) || base.thumb, tanggal: '', penulis: '', ringkasan: '' });
        }
    }

    return baru;
}

// ── DOWNLOAD GAMBAR SEBAGAI BUFFER ────────────────────────────────────────────

async function downloadImageBuffer(url) {
    if (!url) return null;
    try {
        const r = await axios.get(url, {
            headers     : { ...HEADERS, Accept: 'image/*' },
            responseType: 'arraybuffer',
            timeout     : 20000,
        });
        return Buffer.from(r.data);
    } catch (e) {
        console.warn('[TVOneNews] ⚠️ Gagal download gambar:', e?.message);
        return null;
    }
}

// ── FORMAT CAPTION ────────────────────────────────────────────────────────────

const SEP  = '━━━━━━━━━━━━━━━━━━';
const SEP2 = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';

function buatCaption(item) {
    const { judul, kategori, tanggal, penulis, ringkasan, url } = item;

    const sekarang    = new Date();
    const opsiHari    = { timeZone: 'Asia/Jakarta', weekday: 'long' };
    const opsiTgl     = { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric' };
    const opsiJam     = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false };
    const namaHari    = sekarang.toLocaleDateString('id-ID', opsiHari);
    const tglLengkap  = sekarang.toLocaleDateString('id-ID', opsiTgl);
    const jamMenit    = sekarang.toLocaleTimeString('id-ID', opsiJam).replace('.', ':');
    const headerWaktu = `${namaHari}, ${tglLengkap} · ${jamMenit} WIB`;

    const infoRows = [];
    if (kategori) infoRows.push(`├ 🗂️ *Rubrik*  : ${kategori}`);
    if (tanggal)  infoRows.push(`├ 📅 *Terbit*  : ${tanggal}`);
    if (penulis)  infoRows.push(`╰ ✍️ *Penulis* : ${penulis}`);

    const ringkasanBlock = ringkasan
        ? ringkasan.split('\n').map(l => `> ${l.trim()}`).filter(l => l !== '>').join('\n')
        : '';

    return (
        `📰 *BERITA TERBARU — TVONE NEWS*\n` +
        `${SEP}\n` +
        `📅 _${headerWaktu}_\n` +
        `${SEP}\n\n` +
        `*${judul}*\n\n` +
        (ringkasanBlock ? `📖 *Ringkasan*\n${ringkasanBlock}\n\n` : '') +
        `${SEP}\n` +
        `📋 *Info Berita*\n` +
        `${SEP2}\n` +
        (infoRows.length ? infoRows.join('\n') + '\n' : '') +
        `${SEP}\n` +
        `🔗 *Baca Selengkapnya*\n` +
        `${url}`
    );
}

// ── SIMULASI (TEST) ───────────────────────────────────────────────────────────

async function simulasi() {
    const html        = await fetchHtml(BASE_URL);
    const artikelList = parseArtikelList(html);
    if (!artikelList.length) throw new Error('Tidak ada artikel dari TVOne News');

    // Ambil artikel pertama (terbaru)
    const art        = artikelList[0];
    const htmlDetail = await fetchHtml(art.url);
    const detail     = parseDetailArtikel(htmlDetail, art.url);

    const item = {
        ...art,
        ...detail,
        cover: detail.cover || gambarHD(art.thumb) || art.thumb,
    };

    const caption   = buatCaption(item);
    const urlGambar = item.cover || null;
    const imgBuffer = await downloadImageBuffer(urlGambar);
    return { caption, urlGambar, imgBuffer, item };
}

// ── EXPORT ────────────────────────────────────────────────────────────────────

module.exports = {
    getEnabledGroups,
    setGroupEnabled,
    cariBeritaBaru,
    buatCaption,
    downloadImageBuffer,
    tandaiSudahKirim,
    tandaiDanLog,
    getRecentLog,
    simulasi,
};
