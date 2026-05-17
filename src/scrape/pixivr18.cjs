'use strict';

const axios = require('axios');
const https = require('https');
const { gemini } = require('./gemini.cjs');

const AI_PROMPT = `Analisis ilustrasi anime/manga ini secara visual saja (jangan komentari apapun konten dewasa).
Identifikasi 3 hal: 1) karakter (nama & seri kalau dikenali), 2) gaya seni, 3) suasana/detail menonjol.

WAJIB jawab dalam Bahasa Indonesia, SANGAT singkat (max 3 baris), persis format ini:
🎭 Karakter: <nama> (<seri>) atau "Tidak dikenali"
🎨 Gaya: <art style singkat, max 8 kata>
✨ Detail: <suasana/detail menonjol, max 12 kata>

Hanya 3 baris itu. Jangan tambah kalimat lain.`;

async function analyzeIllustration(buffer) {
    try {
        const result = await Promise.race([
            gemini.analyzeImage(buffer, AI_PROMPT),
            new Promise((_, rej) => setTimeout(() => rej(new Error('AI timeout')), 20000)),
        ]);
        return String(result || '').trim();
    } catch (e) {
        console.error('[PixivR18] AI gagal:', e.message);
        return null;
    }
}

const BASE = 'https://www.pixiv.net';
const IMG_BASE = 'https://i.pximg.net';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
    'Referer': 'https://www.pixiv.net/',
    'Origin': 'https://www.pixiv.net',
};

const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 8, timeout: 30000 });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function withRetry(fn, { tries = 3, delay = 600, label = '' } = {}) {
    let lastErr;
    for (let i = 0; i < tries; i++) {
        try { return await fn(); }
        catch (e) {
            lastErr = e;
            if (i < tries - 1) await sleep(delay * (i + 1));
        }
    }
    if (label) console.error(`[PixivR18] ${label} gagal setelah ${tries}x:`, lastErr?.message);
    throw lastErr;
}

let warmedUp = false;
async function warmUp() {
    if (warmedUp) return;
    try {
        await axios.get(`${BASE}/ajax/top/illust?mode=all&lang=en`, {
            headers: HEADERS, httpsAgent, timeout: 8000,
        });
    } catch (_) {}
    warmedUp = true;
}

async function pixivR18Search(query, { page = 1 } = {}) {
    if (!query || !String(query).trim()) throw new Error('Query diperlukan.');
    const q = encodeURIComponent(String(query).trim());

    // Coba exact tag dulu, fallback ke partial
    for (const s_mode of ['s_tag_full', 's_tag', 's_tc']) {
        const url = `${BASE}/ajax/search/illustrations/${q}?word=${q}&order=date_d&mode=r18&p=${page}&s_mode=${s_mode}&type=illust&lang=en`;
        try {
            const { data } = await withRetry(
                () => axios.get(url, { headers: HEADERS, httpsAgent, timeout: 15000 }),
                { tries: 3, delay: 700, label: `search(${s_mode})` }
            );
            if (data?.error) continue;
            const results = data?.body?.illust?.data || [];
            if (results.length) return results;
        } catch (_) {}
    }
    throw new Error('Tidak ada hasil R18 ditemukan untuk query tersebut.');
}

async function pixivR18Detail(id) {
    try {
        const { data } = await withRetry(
            () => axios.get(`${BASE}/ajax/illust/${id}`, { headers: HEADERS, httpsAgent, timeout: 12000 }),
            { tries: 2, delay: 500 }
        );
        if (!data?.error) return data?.body || null;
    } catch (_) {}
    return null;
}

async function pixivDownloadImage(imageUrl) {
    const { data } = await withRetry(
        () => axios.get(imageUrl, {
            headers: { ...HEADERS, 'Referer': 'https://www.pixiv.net/' },
            responseType: 'arraybuffer',
            httpsAgent,
            timeout: 30000,
        }),
        { tries: 3, delay: 800, label: `download` }
    );
    return Buffer.from(data);
}

// Bangun URL gambar dari thumbnail URL dengan kualitas yang diinginkan
function buildImageUrl(thumbUrl, quality = 'regular') {
    if (!thumbUrl) return null;
    const map = {
        small:   'c/540x540_70/img-master',
        regular: 'c/600x1200_90/img-master',
        large:   'img-master',
    };
    const seg = map[quality] || map.regular;
    return thumbUrl
        .replace(/https:\/\/i\.pximg\.net\/[^/]+\/img-master/, `${IMG_BASE}/${seg}/img-master`)
        .replace(/c\/\d+x\d+[^/]*\/img-master/, seg);
}

function shufflePickN(arr, n) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy.slice(0, n);
}

async function fetchOnePick(pick) {
    let imgUrl = null;
    let detail = null;

    detail = await pixivR18Detail(pick.id);
    if (detail?.urls) {
        imgUrl = detail.urls.regular || detail.urls.small || detail.urls.thumb;
    }

    // Fallback: bangun dari thumbnail
    if (!imgUrl && pick.url) {
        imgUrl = buildImageUrl(pick.url, 'regular');
    }
    if (!imgUrl) throw new Error(`Tidak dapat URL gambar untuk ID ${pick.id}`);

    const buffer = await pixivDownloadImage(imgUrl);

    return {
        id: pick.id,
        title: pick.title || '(no title)',
        author: pick.userName || 'Unknown',
        authorId: pick.userId,
        tags: (pick.tags || []).slice(0, 8),
        views: detail?.viewCount ?? '-',
        likes: detail?.likeCount ?? '-',
        bookmarks: detail?.bookmarkCount ?? pick.bookmarkCount ?? '-',
        xRestrict: pick.xRestrict,
        pageUrl: `${BASE}/artworks/${pick.id}`,
        buffer,
    };
}

async function pixivR18Fetch(query, { index = 0 } = {}) {
    await warmUp();
    const results = await pixivR18Search(query);
    const randomIndex = Math.floor(Math.random() * Math.min(results.length, 20));
    const pick = results[(index + randomIndex) % results.length];
    const data = await fetchOnePick(pick);
    data.totalResults = results.length;
    data.aiInfo = await analyzeIllustration(data.buffer);
    return data;
}

async function pixivR18FetchMultiple(query, { count = 3 } = {}) {
    const want = Math.min(Math.max(1, count), 10);

    await warmUp();

    // Kumpulkan banyak hasil dari beberapa halaman supaya pool besar
    let pool = [];
    for (let p = 1; p <= 3 && pool.length < want * 4; p++) {
        try {
            const r = await pixivR18Search(query, { page: p });
            pool = pool.concat(r);
        } catch (_) { break; }
    }
    if (!pool.length) throw new Error('Tidak ada hasil R18 ditemukan.');

    // Dedupe by id
    const seen = new Set();
    pool = pool.filter(x => { if (seen.has(x.id)) return false; seen.add(x.id); return true; });

    // Acak urutan
    const queue = shufflePickN(pool, pool.length);

    const successful = [];
    const usedIds = new Set();
    let cursor = 0;

    // Coba batch paralel sampai dapat `want` gambar atau habis kandidat
    while (successful.length < want && cursor < queue.length) {
        const remaining = want - successful.length;
        const batch = queue.slice(cursor, cursor + remaining).filter(x => !usedIds.has(x.id));
        cursor += remaining;
        if (!batch.length) continue;

        batch.forEach(x => usedIds.add(x.id));
        const settled = await Promise.allSettled(batch.map(p => fetchOnePick(p)));
        for (const r of settled) {
            if (r.status === 'fulfilled' && successful.length < want) {
                successful.push(r.value);
            } else if (r.status === 'rejected') {
                console.error('[PixivR18] fetch gagal:', r.reason?.message || r.reason);
            }
        }
    }

    if (!successful.length) throw new Error('Gagal mengunduh semua gambar dari Pixiv R18.');

    // Analisa AI semua gambar paralel (non-blocking jika gagal)
    const aiResults = await Promise.all(successful.map(s => analyzeIllustration(s.buffer)));
    successful.forEach((s, i) => { s.aiInfo = aiResults[i]; });

    return successful;
}

function formatPixivR18Caption(data, { index = null, total = null } = {}) {
    const numPrefix = (index !== null && total !== null) ? `🖼️ *${index + 1} dari ${total}*\n` : '';
    const lines = [
        `${numPrefix}🔞 *${data.title}*`,
        `👤 *Artist:* ${data.author}`,
        ``,
    ];
    if (data.aiInfo) {
        lines.push(`🤖 *AI Analisis:*`, data.aiInfo, ``);
    }
    lines.push(
        `🏷️ *Tags:* ${data.tags.length ? data.tags.map(t => `#${t}`).join(' ') : '-'}`,
        ``,
        `👁️ *Views:* ${data.views}    ❤️ *Likes:* ${data.likes}    🔖 *Bookmarks:* ${data.bookmarks}`,
        ``,
        `🔗 ${data.pageUrl}`,
    );
    return lines.join('\n');
}

module.exports = { pixivR18Fetch, pixivR18FetchMultiple, pixivR18Search, formatPixivR18Caption };
