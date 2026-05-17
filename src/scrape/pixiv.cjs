'use strict';

const axios = require('axios');
const { gemini } = require('./gemini.cjs');

const AI_PROMPT = `Analisis ilustrasi anime/manga ini.
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
        console.error('[Pixiv] AI gagal:', e.message);
        return null;
    }
}

const BASE = 'https://www.pixiv.net';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9,ja;q=0.8',
    'Referer': 'https://www.pixiv.net/',
    'Origin': 'https://www.pixiv.net',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
};

async function pixivSearch(query, { safe = true, page = 1 } = {}) {
    if (!query || !String(query).trim()) throw new Error('Query diperlukan.');
    const encoded = encodeURIComponent(String(query).trim());
    const mode = safe ? 'safe' : 'all';
    const url = `${BASE}/ajax/search/illustrations/${encoded}?word=${encoded}&order=date_d&mode=${mode}&p=${page}&s_mode=s_tag_full&type=illust&lang=en`;

    const { data } = await axios.get(url, { headers: HEADERS, timeout: 15000 });

    if (data?.error) throw new Error(data.message || 'Pixiv API error');

    let results = data?.body?.illust?.data || [];

    if (!results.length) {
        const url2 = `${BASE}/ajax/search/illustrations/${encoded}?word=${encoded}&order=date_d&mode=${mode}&p=${page}&s_mode=s_tag&type=illust&lang=en`;
        const { data: data2 } = await axios.get(url2, { headers: HEADERS, timeout: 15000 });
        results = data2?.body?.illust?.data || [];
    }

    if (!results.length) throw new Error('Tidak ada hasil ditemukan untuk query tersebut.');

    if (safe) results = results.filter(r => r.xRestrict === 0);
    if (!results.length) throw new Error('Tidak ada hasil aman (safe) yang ditemukan. Coba query lain.');

    return results;
}

async function pixivDetail(id) {
    const { data } = await axios.get(`${BASE}/ajax/illust/${id}`, {
        headers: HEADERS,
        timeout: 12000
    });
    if (data?.error) throw new Error(data.message || 'Gagal mengambil detail karya.');
    return data?.body || null;
}

async function pixivDownloadImage(imageUrl) {
    const { data } = await axios.get(imageUrl, {
        headers: {
            ...HEADERS,
            'Referer': 'https://www.pixiv.net/',
        },
        responseType: 'arraybuffer',
        timeout: 30000
    });
    return Buffer.from(data);
}

function buildImageUrl(thumbUrl, quality = 'regular') {
    if (!thumbUrl) return null;
    const sizes = {
        small: 'c/360x360_70/img-master',
        regular: 'c/600x1200_90/img-master',
        large: 'img-master',
    };
    const sizeKey = sizes[quality] || sizes.regular;
    return thumbUrl
        .replace(/https:\/\/i\.pximg\.net\/[^/]+\/img-master/, `https://i.pximg.net/${sizeKey}/img-master`)
        .replace(/c\/\d+x\d+[^/]*\/img-master/, sizeKey);
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
    try {
        detail = await pixivDetail(pick.id);
        imgUrl = detail?.urls?.regular || detail?.urls?.small || detail?.urls?.thumb;
    } catch (_) {}

    if (!imgUrl) {
        imgUrl = buildImageUrl(pick.url, 'regular') || pick.url;
    }

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
        pageUrl: `https://www.pixiv.net/artworks/${pick.id}`,
        buffer,
    };
}

async function pixivFetch(query, { safe = true, index = 0 } = {}) {
    const results = await pixivSearch(query, { safe });
    const pick = results[index % results.length];
    const data = await fetchOnePick(pick);
    data.totalResults = results.length;
    data.aiInfo = await analyzeIllustration(data.buffer);
    return data;
}

async function pixivFetchMultiple(query, { safe = true, count = 3 } = {}) {
    const max = Math.min(Math.max(1, count), 10);
    const results = await pixivSearch(query, { safe });

    const picks = shufflePickN(results, Math.min(max, results.length));

    const settled = await Promise.allSettled(picks.map(p => fetchOnePick(p)));

    const successful = settled
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);

    if (!successful.length) throw new Error('Gagal mengunduh semua gambar dari Pixiv.');

    const aiResults = await Promise.all(successful.map(s => analyzeIllustration(s.buffer)));
    successful.forEach((s, i) => { s.aiInfo = aiResults[i]; });

    return successful;
}

function formatPixivCaption(data, { index = null, total = null } = {}) {
    const numPrefix = (index !== null && total !== null)
        ? `🖼️ *${index + 1} dari ${total}*\n`
        : '';
    const lines = [
        `${numPrefix}🎨 *${data.title}*`,
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

module.exports = { pixivFetch, pixivFetchMultiple, pixivSearch, formatPixivCaption };
