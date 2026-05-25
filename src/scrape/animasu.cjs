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
 *  FITUR   : Animasu Sub Indo Realtime
 *  Fungsi  : Pantau episode Sub Indo terbaru dari
 *            v1.animasu.app via WP REST API.
 *            Kirim notifikasi ke grup WA saat ada
 *            episode baru yang sudah di-sub Indo.
 *  Sumber  : animasu.app WP REST API + HTML scraping
 * ─────────────────────────────────────────────────────
 */

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const FILE_DATA   = path.join(process.cwd(), 'data', 'animasu', 'state.json');
const FILE_LOG    = path.join(process.cwd(), 'data', 'animasu', 'log.json');
fs.mkdirSync(path.join(process.cwd(), 'data', 'animasu'), { recursive: true });
const FILE_CONFIG = path.join(process.cwd(), 'config.json');
const BASE_URL    = 'https://v1.animasu.app';
const API_POSTS   = `${BASE_URL}/wp-json/wp/v2/posts`;
const HEADERS     = { 'User-Agent': 'Mozilla/5.0 (compatible; WilyBot/1.0)' };

// Buffer waktu (ms) yang ditambahkan ke lastCheckTime saat menghitung batas usia post
// Mencegah post yang terbit tepat di batas window terlewat akibat latensi jaringan
const BUFFER_MS = 3 * 60 * 1000; // 3 menit
// Berapa lama (ms) post gagal-fetch akan dicoba ulang sebelum diabaikan permanen
const RETRY_TTL_MS = 30 * 60 * 1000; // 30 menit
// Jangkauan awal (ms) saat belum ada lastCheckTime (misal: bot baru start)
const INIT_WINDOW_MS = 30 * 60 * 1000; // 30 menit

// ── BACA / SIMPAN DATA ────────────────────────────────────────────────────────

function bacaData() {
    try {
        if (fs.existsSync(FILE_DATA)) return JSON.parse(fs.readFileSync(FILE_DATA, 'utf-8'));
    } catch (_) {}
    return { idTerkirim: [], idGagal: [], lastCheckTime: null };
}

function simpanData(data) {
    try { fs.writeFileSync(FILE_DATA, JSON.stringify(data, null, 2), 'utf-8'); } catch (_) {}
}

// ── BACA / SIMPAN LOG PENGIRIMAN ─────────────────────────────────────────────

function bacaLog() {
    try {
        if (fs.existsSync(FILE_LOG)) return JSON.parse(fs.readFileSync(FILE_LOG, 'utf-8'));
    } catch (_) {}
    return { terkirim: [] };
}

function simpanLog(log) {
    try { fs.writeFileSync(FILE_LOG, JSON.stringify(log, null, 2), 'utf-8'); } catch (_) {}
}

// ── BACA / SIMPAN CONFIG ──────────────────────────────────────────────────────

function bacaConfig() {
    try {
        if (fs.existsSync(FILE_CONFIG)) return JSON.parse(fs.readFileSync(FILE_CONFIG, 'utf-8'));
    } catch (_) {}
    return {};
}

function simpanConfig(cfg) {
    try { fs.writeFileSync(FILE_CONFIG, JSON.stringify(cfg, null, 2), 'utf-8'); } catch (_) {}
}

// ── PENGATURAN GRUP ───────────────────────────────────────────────────────────

function getEnabledGroups() {
    const cfg    = bacaConfig();
    const groups = cfg?.animasu?.groups || {};
    return Object.entries(groups)
        .filter(([, v]) => v?.enabled === true)
        .map(([jid]) => jid);
}

function setGroupEnabled(jid, enabled) {
    const cfg = bacaConfig();
    if (!cfg.animasu)        cfg.animasu        = { groups: {} };
    if (!cfg.animasu.groups) cfg.animasu.groups = {};
    cfg.animasu.groups[jid] = { enabled, diubahPada: Date.now() };
    simpanConfig(cfg);
}

// ── HTML HELPER ───────────────────────────────────────────────────────────────

function stripHtml(str) {
    return (str || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#8217;/g, "\u2019")
        .replace(/&#8216;/g, "\u2018")
        .replace(/&#8220;/g, '\u201C')
        .replace(/&#8221;/g, '\u201D')
        .replace(/&#x1F525;/gi, '🔥')
        .replace(/&#x2714;/gi, '✔️')
        .replace(/&#[0-9]+;/g, s => {
            try { return String.fromCodePoint(parseInt(s.slice(2, -1))); } catch (_) { return ''; }
        })
        .replace(/\s+/g, ' ')
        .trim();
}

// ── PARSE HALAMAN DETAIL ANIME ─────────────────────────────────────────────────

function parseDetailPage(html, animeUrl) {
    const judulMatch = html.match(/<h1[^>]*itemprop="headline"[^>]*>([\s\S]*?)<\/h1>/i);
    const judul = judulMatch
        ? stripHtml(judulMatch[1]).replace(/\s*Sub\s*Indo\s*$/i, '').trim()
        : '';

    const alterMatch = html.match(/<span class="alter">([\s\S]*?)<\/span>/i);
    const judulAlt = alterMatch ? stripHtml(alterMatch[1]) : '';

    const coverMatch = html.match(/<div class="thumb"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i);
    const coverRaw   = coverMatch ? coverMatch[1].split('?')[0] : '';
    const cover      = coverRaw.replace(/^https?:\/\/i\d+\.wp\.com\//, 'https://');

    const speMatch = html.match(/<div class="spe">([\s\S]*?)<\/div>/i);
    const speHtml  = speMatch ? speMatch[1] : '';

    function ambilField(label) {
        const re = new RegExp(`<b>${label}:<\\/b>\\s*([\\s\\S]*?)(?=<\\/span>|<span\\b)`, 'i');
        const m  = speHtml.match(re);
        return m ? stripHtml(m[1]) : '';
    }

    const genre  = ambilField('Genre').replace(/\s*,\s*/g, ', ');
    const status = ambilField('Status').replace(/🔥|✔️|⏳/g, '').trim();
    const rilis  = ambilField('Rilis');
    const jenis  = ambilField('Jenis');
    const durasi = ambilField('Durasi');
    const studio = ambilField('Studio');
    const musim  = ambilField('Musim');

    const ratingMatch = html.match(/<strong>Rating\s+([0-9.]+)<\/strong>/i);
    const rating = ratingMatch ? ratingMatch[1] : '';

    const sinopsisMatch = html.match(/<span class="desc"[^>]*>([\s\S]*?)<\/span>\s*<\/div>/i);
    const sinopsis = sinopsisMatch
        ? stripHtml(sinopsisMatch[1]).replace(/\s{2,}/g, ' ').trim()
        : '';

    const epMatch    = html.match(/<span class="lchx"><a href="([^"]+)">Episode\s+(\d+)<\/a><\/span>/i);
    const latestEpUrl = epMatch ? epMatch[1] : '';
    const latestEpNum = epMatch ? parseInt(epMatch[2]) : 0;

    const allEps = [...html.matchAll(/<span class="lchx"><a href="[^"]+">Episode\s+(\d+)<\/a><\/span>/gi)];
    const totalEp = allEps.length;

    const totalSeriRaw = ambilField('Episode');
    const totalSeriMatch = totalSeriRaw.match(/(\d+)/);
    const totalSeri = totalSeriMatch ? parseInt(totalSeriMatch[1]) : 0;

    const trailerMatch = html.match(/bixbox trailer[\s\S]*?<iframe[^>]+src="https:\/\/www\.youtube\.com\/embed\/([^"?/]+)/i);
    const trailerUrl   = trailerMatch ? `https://www.youtube.com/watch?v=${trailerMatch[1]}` : '';

    const batchDownload = parseBatchDownload(html);

    return {
        judul, judulAlt, cover, genre, status, rilis, jenis,
        durasi, studio, musim, rating, sinopsis,
        latestEpNum, latestEpUrl, totalEp, totalSeri, trailerUrl,
        batchDownload,
        url: animeUrl,
    };
}

function parseBatchDownload(html) {
    const batchTitleM = html.match(/<div class="sorattlx"[^>]*>\s*<h3>([\s\S]*?Download\s+Batch[\s\S]*?)<\/h3>/i);
    if (!batchTitleM) return null;

    const title = stripHtml(batchTitleM[1]).trim();
    const startIdx = batchTitleM.index;
    const afterBatch = html.slice(startIdx);

    let section = afterBatch;
    const nextSoraddlxIdx = afterBatch.indexOf('<div class="soraddlx', 20);
    if (nextSoraddlxIdx !== -1) section = afterBatch.slice(0, nextSoraddlxIdx);

    const resolutions = [];
    const urlDivRe = /<div class="soraurlx">([\s\S]*?)<\/div>/gi;
    let m;
    while ((m = urlDivRe.exec(section)) !== null) {
        const inner = m[1];
        const resM  = inner.match(/<strong>([\s\S]*?)<\/strong>/i);
        if (!resM) continue;
        const res   = stripHtml(resM[1]).trim();
        const links = [];
        const linkRe = /<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
        let lm;
        while ((lm = linkRe.exec(inner)) !== null) {
            const href  = lm[1].trim();
            const label = stripHtml(lm[2]).trim();
            if (href && label && href !== '#') links.push({ label, url: href });
        }
        if (links.length) resolutions.push({ res, links });
    }

    if (!resolutions.length) return null;
    return { title, resolutions };
}

// ── FETCH ─────────────────────────────────────────────────────────────────────

async function fetchDenganRetry(fn, maxRetry = 3, delayMs = 3000) {
    let lastErr;
    for (let i = 0; i < maxRetry; i++) {
        try {
            return await fn();
        } catch (e) {
            lastErr = e;
            if (i < maxRetry - 1) await new Promise(r => setTimeout(r, delayMs));
        }
    }
    throw lastErr;
}

async function fetchHtml(url) {
    return fetchDenganRetry(async () => {
        const r = await axios.get(url, { headers: HEADERS, timeout: 30000 });
        return r.data;
    });
}

async function fetchRecentPosts(count = 20) {
    const url = `${API_POSTS}?per_page=${count}&_embed=wp%3Aterm&_fields=id,date,date_gmt,slug,title,link`;
    return fetchDenganRetry(async () => {
        const r = await axios.get(url, { headers: HEADERS, timeout: 30000 });
        return r.data;
    });
}

// Ambil URL anime yang benar dari halaman episode (fallback saat slug 404)
async function fetchAnimeUrlFromEpisodePage(postLink) {
    try {
        const html = await axios.get(postLink, { headers: HEADERS, timeout: 20000 }).then(r => r.data);
        const m = html.match(/href="(https:\/\/v1\.animasu\.app\/anime\/[^"]+)"/);
        return m ? m[1].replace(/\/$/, '') + '/' : null;
    } catch (_) {
        return null;
    }
}

// ── PARSE SLUG & EPISODE DARI POST ────────────────────────────────────────────

function animeSlugDariPost(post) {
    try {
        const cats = post._embedded?.['wp:term']?.[0] || [];
        if (cats.length > 0 && cats[0].slug) return cats[0].slug;
    } catch (_) {}
    return (post.slug || '')
        .replace(/^nonton-/, '')
        .replace(/-episode-\d+.*$/, '');
}

function nomorEpisodeDariPost(post) {
    const m = (post.title?.rendered || '').match(/Episode\s+(\d+)/i);
    return m ? parseInt(m[1]) : 0;
}

// ── DEDUP ─────────────────────────────────────────────────────────────────────

function sudahDikirim(id) {
    const data = bacaData();
    return (data.idTerkirim || []).includes(String(id));
}

function tandaiSudahKirim(id) {
    const data = bacaData();
    if (!data.idTerkirim) data.idTerkirim = [];
    if (!data.idTerkirim.includes(String(id))) {
        data.idTerkirim.unshift(String(id));
        if (data.idTerkirim.length > 300) data.idTerkirim = data.idTerkirim.slice(0, 300);
        simpanData(data);
    }
}

// Tandai sudah dikirim DAN catat ke log pengiriman
function tandaiDanLog(item, grupList) {
    tandaiSudahKirim(item.postId);

    try {
        const log = bacaLog();
        if (!Array.isArray(log.terkirim)) log.terkirim = [];

        // Hindari duplikat di log
        const sudahAda = log.terkirim.some(e => String(e.postId) === String(item.postId));
        if (!sudahAda) {
            log.terkirim.unshift({
                postId     : String(item.postId),
                judul      : item.judul || item.animeSlug || '-',
                epNum      : item.epNum || 0,
                animeSlug  : item.animeSlug || '',
                waktuPost  : item.postDate || null,
                waktuKirim : new Date().toISOString(),
                grupCount  : grupList.length,
                grupList   : grupList,
                cover      : item.cover || null,
                url        : item.url || null,
            });
            if (log.terkirim.length > 300) log.terkirim = log.terkirim.slice(0, 300);
            simpanLog(log);
        }
    } catch (e) {
        console.warn('[Animasu] Gagal simpan log:', e?.message);
    }
}

// Ambil log pengiriman terbaru (untuk command)
function getRecentLog(jumlah = 20) {
    const log = bacaLog();
    return (log.terkirim || []).slice(0, jumlah);
}

// ── CARI EPISODE BARU (REALTIME FIXED) ────────────────────────────────────────
//
// Perubahan dari versi sebelumnya:
// 1. Menggunakan lastCheckTime (disimpan di animasu.json) sebagai batas usia post,
//    bukan fixed 8 menit. Sehingga tidak ada post yang terlewat meski bot restart.
// 2. idGagal: post yang gagal fetch detail disimpan dan dicoba ulang check berikutnya
//    selama maks RETRY_TTL_MS (30 menit) sebelum diabaikan permanen.
// 3. Fetch 20 post (dari 15) untuk jangkauan lebih luas.

async function cariEpisodeBaru() {
    const now  = Date.now();
    const data = bacaData();

    // ── Hitung batas waktu ─────────────────────────────────────────────────────
    // Pakai lastCheckTime - BUFFER_MS sebagai batas bawah
    // Jika belum ada (bot baru start), pakai INIT_WINDOW_MS ke belakang
    const lastCheck = data.lastCheckTime || (now - INIT_WINDOW_MS);
    const batas     = lastCheck - BUFFER_MS;

    // Simpan waktu check sekarang SEBELUM proses (agar check berikutnya punya referensi)
    data.lastCheckTime = now;
    if (!data.idTerkirim) data.idTerkirim = [];
    if (!data.idGagal)    data.idGagal    = [];
    simpanData(data);

    const baru    = [];
    const idGagalBaru = [];

    // ── Retry post yang sebelumnya gagal fetch detail ─────────────────────────
    for (const gagal of data.idGagal) {
        if (sudahDikirim(gagal.id)) continue;

        const usiaGagal = now - new Date(gagal.pertamaGagal).getTime();
        if (usiaGagal > RETRY_TTL_MS) {
            // Sudah terlalu lama → abaikan permanen
            console.log(`[Animasu] ⏭️ Retry timeout: post ${gagal.id} "${gagal.slug}" diabaikan`);
            tandaiSudahKirim(gagal.id);
            continue;
        }

        try {
            let animeUrl = `${BASE_URL}/anime/${gagal.slug}/`;
            let html;
            try {
                html = await fetchHtml(animeUrl);
            } catch (e404) {
                // Fallback: cari URL anime dari halaman episode
                if (gagal.postLink) {
                    const realUrl = await fetchAnimeUrlFromEpisodePage(gagal.postLink);
                    if (realUrl && realUrl !== animeUrl) {
                        console.log(`[Animasu] 🔄 Fallback URL: ${realUrl}`);
                        animeUrl = realUrl;
                        html = await fetchHtml(animeUrl);
                    } else throw e404;
                } else throw e404;
            }
            const detail = parseDetailPage(html, animeUrl);
            console.log(`[Animasu] 🔄 Retry berhasil: "${gagal.slug}" ep ${gagal.epNum}`);
            baru.push({
                postId    : gagal.id,
                postDate  : gagal.postDate,
                epNum     : gagal.epNum,
                animeSlug : gagal.slug,
                ...detail,
            });
        } catch (e) {
            console.warn(`[Animasu] 🔄 Retry masih gagal "${gagal.slug}":`, e?.message);
            idGagalBaru.push(gagal); // masukkan lagi ke antrian retry
        }
    }

    // ── Fetch & proses post terbaru dari API ──────────────────────────────────
    let posts = [];
    try {
        posts = await fetchRecentPosts(20);
    } catch (e) {
        console.error('[Animasu] ❌ Gagal fetch API posts:', e?.message);
    }

    for (const post of posts) {
        if (sudahDikirim(post.id)) continue;

        // Waktu publikasi post (UTC)
        const waktuPost = post.date_gmt
            ? new Date(post.date_gmt + 'Z').getTime()
            : new Date(post.date).getTime() - 7 * 3600 * 1000;

        if (waktuPost < batas) {
            // Post terlalu lama (sebelum check terakhir) — tandai tanpa kirim
            const usiaMenit = Math.round((now - waktuPost) / 60000);
            console.log(`[Animasu] ⏭️ Lewati lama: post ${post.id} "${post.slug}" (${usiaMenit}m lalu)`);
            tandaiSudahKirim(post.id);
            continue;
        }

        const animeSlug = animeSlugDariPost(post);
        const epNum     = nomorEpisodeDariPost(post);
        if (!animeSlug) {
            console.warn(`[Animasu] ⚠️ Slug kosong untuk post ${post.id}, dilewati`);
            tandaiSudahKirim(post.id);
            continue;
        }

        try {
            let animeUrl = `${BASE_URL}/anime/${animeSlug}/`;
            let html;
            try {
                html = await fetchHtml(animeUrl);
            } catch (e404) {
                // Fallback: cari URL anime yang benar dari halaman episode
                if (post.link) {
                    const realUrl = await fetchAnimeUrlFromEpisodePage(post.link);
                    if (realUrl && realUrl !== animeUrl) {
                        console.log(`[Animasu] 🔍 Fallback URL ditemukan: ${realUrl}`);
                        animeUrl = realUrl;
                        html = await fetchHtml(animeUrl);
                    } else throw e404;
                } else throw e404;
            }
            const detail = parseDetailPage(html, animeUrl);
            baru.push({
                postId    : post.id,
                postDate  : post.date,
                epNum,
                animeSlug,
                ...detail,
            });
        } catch (e) {
            console.warn(`[Animasu] ❌ Gagal fetch detail "${animeSlug}":`, e?.message);
            // Masukkan ke antrian retry — JANGAN langsung tandai sudahDikirim
            idGagalBaru.push({
                id          : String(post.id),
                slug        : animeSlug,
                epNum,
                postDate    : post.date,
                postLink    : post.link || null,
                pertamaGagal: new Date().toISOString(),
            });
        }
    }

    // Simpan antrian retry terbaru
    const dataFinal = bacaData();
    dataFinal.idGagal = idGagalBaru;
    simpanData(dataFinal);

    return baru;
}

// ── SIMULASI (TEST) ───────────────────────────────────────────────────────────

async function simulasi(slugOverride = null) {
    let animeSlug, epNum, postId, postDate, postLink;

    if (slugOverride) {
        animeSlug = slugOverride;
        epNum     = 0;
        postId    = 'sim-' + Date.now();
        postDate  = new Date().toISOString();
        postLink  = null;
    } else {
        const posts = await fetchRecentPosts(1);
        if (!posts.length) throw new Error('Tidak ada post terbaru dari Animasu');
        const post = posts[0];
        animeSlug  = animeSlugDariPost(post);
        epNum      = nomorEpisodeDariPost(post);
        postId     = post.id;
        postDate   = post.date;
        postLink   = post.link || null;
    }

    let animeUrl = `${BASE_URL}/anime/${animeSlug}/`;
    let html;
    try {
        html = await fetchHtml(animeUrl);
    } catch (e404) {
        if (postLink) {
            const realUrl = await fetchAnimeUrlFromEpisodePage(postLink);
            if (realUrl && realUrl !== animeUrl) {
                animeUrl = realUrl;
                html = await fetchHtml(animeUrl);
            } else throw e404;
        } else throw e404;
    }
    const detail  = parseDetailPage(html, animeUrl);
    const data    = { postId, postDate, epNum, animeSlug, ...detail };
    const caption = buatCaption(data);
    return { caption, urlGambar: data.cover || null, batchDownload: detail.batchDownload || null };
}

// ── FORMAT CAPTION ────────────────────────────────────────────────────────────

const SEP  = '━━━━━━━━━━━━━━━━━━';
const SEP2 = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';

function buatBarisInfo(items) {
    const valid = items.filter(([, val]) => val !== null && val !== undefined && val !== '' && val !== '-');
    return valid.map(([label, val], i) => {
        const prefix = i === valid.length - 1 ? '╰' : '├';
        return `${prefix} ${label} : ${val}`;
    }).join('\n');
}

function potongSinopsis(teks, maks = 350) {
    if (!teks || teks.length <= maks) return teks || '-';
    const potong    = teks.slice(0, maks);
    const lastSpace = potong.lastIndexOf(' ');
    return (lastSpace > 0 ? potong.slice(0, lastSpace) : potong) + '...';
}

function buatCaption(data) {
    const {
        judul, judulAlt, epNum, latestEpNum, latestEpUrl, totalEp, totalSeri,
        genre, status, rilis, jenis, durasi, studio, musim, rating,
        sinopsis, trailerUrl, url, batchDownload,
    } = data;

    const ep  = epNum || latestEpNum || '?';
    const sinopsisBlock = potongSinopsis(sinopsis).split('\n').map(b => `> ${b}`).join('\n');

    const sekarang   = new Date();
    const opsiHari   = { timeZone: 'Asia/Jakarta', weekday: 'long' };
    const opsiTgl    = { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric' };
    const opsiJam    = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false };
    const namaHari   = sekarang.toLocaleDateString('id-ID', opsiHari);
    const tglLengkap = sekarang.toLocaleDateString('id-ID', opsiTgl);
    const jamMenit   = sekarang.toLocaleTimeString('id-ID', opsiJam).replace('.', ':');
    const headerWaktu = `${namaHari}, ${tglLengkap} · ${jamMenit} WIB`;

    const sedangTayang = (status || '').toLowerCase().includes('tayang') &&
                         !(status || '').toLowerCase().includes('selesai');

    const epHeader = totalSeri ? `${ep}/${totalSeri}` : String(ep);

    let epInfo = null;
    if (totalSeri) {
        epInfo = sedangTayang
            ? `${ep}/${totalSeri}  _(${totalEp} tersedia)_`
            : `${ep}/${totalSeri}`;
    } else if (totalEp) {
        epInfo = sedangTayang ? `${totalEp} ep tersedia` : `${totalEp} ep`;
    }

    const seksi1 = buatBarisInfo([
        ['🗂️ *Jenis*   ', jenis  || null],
        ['⏱️ *Durasi*  ', durasi || null],
        ['📦 *Episode* ', epInfo],
        ['🗓️ *Rilis*   ', rilis  || null],
        ['🌸 *Musim*   ', musim  || null],
        ['📡 *Status*  ', status || null],
        ['🏢 *Studio*  ', studio || null],
    ]);

    const seksi2 = buatBarisInfo([
        ['⭐ *Rating*  ', rating ? `${rating}/10` : null],
        ['🎭 *Genre*   ', genre  ? `_${genre}_`  : null],
    ]);

    let batchBlok = '';
    if (batchDownload?.resolutions?.length) {
        batchBlok += `\n${SEP}\n`;
        batchBlok += `📦 *BATCH TERSEDIA!*\n`;
        batchBlok += `${SEP2}\n`;
        for (const r of batchDownload.resolutions) {
            const mirrors = r.links.map(l => l.label).join(' · ');
            batchBlok += `├ [${r.res}] ${mirrors}\n`;
        }
        const firstLink = batchDownload.resolutions[0]?.links[0];
        if (firstLink) {
            batchBlok += `╰ 🔗 Download: ${firstLink.url}\n`;
        }
    }

    return (
        `🟢 *SUB INDO SUDAH TAYANG!*\n` +
        `${SEP}\n` +
        `📅 _${headerWaktu}_\n` +
        `${SEP}\n\n` +
        `🎌 *${judul}*\n` +
        `${judulAlt ? `_${judulAlt}_\n` : ''}` +
        `\n📺 *Episode ${epHeader}*\n` +
        `\n📖 *Sinopsis*\n` +
        `${sinopsisBlock}\n\n` +
        `${SEP}\n` +
        `📋 *Info Anime*\n` +
        `${SEP2}\n` +
        `${seksi1}\n` +
        `${SEP2}\n` +
        `${seksi2}\n` +
        `${SEP}\n` +
        `${trailerUrl ? `🎬 *PV*     : ${trailerUrl}\n` : ''}` +
        `▶️ *Tonton*  : ${latestEpUrl || url}\n` +
        `🔗 *Anime*   : ${url}` +
        batchBlok
    );
}

function ambilUrlGambar(data) {
    return data?.cover || null;
}

// ── STATUS: DAFTAR ANIME SEDANG TAYANG + SISA EPISODE ────────────────────────

async function getAiringStatus(jumlahPost = 40) {
    const posts = await fetchRecentPosts(jumlahPost);

    const map = new Map();
    for (const post of posts) {
        const slug  = animeSlugDariPost(post);
        const epNum = nomorEpisodeDariPost(post);
        if (!slug) continue;
        if (!map.has(slug) || epNum > map.get(slug).epNum) {
            map.set(slug, { slug, epNum, postDate: post.date, postLink: post.link || null });
        }
    }

    const slugList = [...map.values()];

    const BATCH = 6;
    const results = [];
    for (let i = 0; i < slugList.length; i += BATCH) {
        const chunk   = slugList.slice(i, i + BATCH);
        const settled = await Promise.allSettled(
            chunk.map(async ({ slug, epNum, postDate, postLink }) => {
                let animeUrl = `${BASE_URL}/anime/${slug}/`;
                let html;
                try {
                    html = await fetchHtml(animeUrl);
                } catch (e404) {
                    if (postLink) {
                        const realUrl = await fetchAnimeUrlFromEpisodePage(postLink);
                        if (realUrl && realUrl !== animeUrl) {
                            animeUrl = realUrl;
                            html = await fetchHtml(animeUrl);
                        } else throw e404;
                    } else throw e404;
                }
                const detail   = parseDetailPage(html, animeUrl);
                const sisaEp   = (detail.totalSeri && epNum)
                    ? Math.max(0, detail.totalSeri - epNum)
                    : null;
                return {
                    judul         : detail.judul || slug,
                    musim         : detail.musim || '-',
                    status        : detail.status || '-',
                    epTerbaru     : epNum || detail.latestEpNum || 0,
                    totalSeri     : detail.totalSeri || 0,
                    sisaEp,
                    url           : animeUrl,
                    latestEpUrl   : detail.latestEpUrl || animeUrl,
                    genre         : detail.genre || '',
                    batchDownload : detail.batchDownload || null,
                    postDate,
                };
            })
        );
        for (const s of settled) {
            if (s.status === 'fulfilled') results.push(s.value);
        }
        if (i + BATCH < slugList.length) await new Promise(r => setTimeout(r, 500));
    }

    results.sort((a, b) => {
        if (a.sisaEp === null && b.sisaEp === null) return 0;
        if (a.sisaEp === null) return 1;
        if (b.sisaEp === null) return -1;
        return b.sisaEp - a.sisaEp;
    });

    return results;
}

// ── EXPORT ────────────────────────────────────────────────────────────────────

module.exports = {
    getEnabledGroups,
    setGroupEnabled,
    cariEpisodeBaru,
    buatCaption,
    ambilUrlGambar,
    tandaiSudahKirim,
    tandaiDanLog,
    getRecentLog,
    simulasi,
    getAiringStatus,
};
