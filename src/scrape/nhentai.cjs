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

const axios = require('axios');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');

const BASE = 'https://nhentai.to';
const CDN_LIST = ['https://zrocdn.xyz', 'https://i.nhentai.net', 'https://i2.nhentai.net', 'https://i3.nhentai.net'];
const EXT_MAP = { j: 'jpg', p: 'png', g: 'gif' };

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://nhentai.to/',
};

async function fetchHtml(url) {
    const res = await axios.get(url, { headers: HEADERS, timeout: 20000, maxRedirects: 5 });
    return res.data;
}

function parseGalleryJson(html) {
    const start = html.indexOf('N.gallery({');
    if (start === -1) throw new Error('Data gallery tidak ditemukan di halaman');
    const braceStart = html.indexOf('{', start);
    let depth = 0, i = braceStart;
    while (i < html.length) {
        if (html[i] === '{') depth++;
        else if (html[i] === '}') { depth--; if (depth === 0) break; }
        i++;
    }
    const raw = html.slice(braceStart, i + 1);
    const clean = raw.replace(/,(\s*[}\]])/g, '$1');
    return JSON.parse(clean);
}

function detectCdnExt(html) {
    const m = html.match(/data-src="https?:\/\/[^/]+\/galleries\/\d+\/1t\.(\w+)"/);
    return m ? m[1] : null;
}

function detectCoverUrl(html) {
    const m = html.match(/data-src="(https?:\/\/[^"]+\/galleries\/\d+\/cover\.[^"]+)"/);
    return m ? m[1] : null;
}

function scrapeExtraInfo(html) {
    const likeMatch = html.match(/like-count[^>]*>(\d+)/);
    const likes = likeMatch ? parseInt(likeMatch[1]) : 0;

    const favMatch = html.match(/Favorite \((\d+)\)/);
    const favorites = favMatch ? parseInt(favMatch[1]) : 0;

    const fallbackMatch = html.match(/data-fallbacks="([^"]+)"/);
    let cdnExtFromFallback = null;
    if (fallbackMatch) {
        const decoded = fallbackMatch[1].replace(/&quot;/g, '"').replace(/\\\//g, '/');
        const m = decoded.match(/\/galleries\/\d+\/1\.(\w+)/);
        if (m) cdnExtFromFallback = m[1];
    }

    const coverUrl = detectCoverUrl(html);

    return { likes, favorites, cdnExtFromFallback, coverUrl };
}

function formatDate(unixTs) {
    if (!unixTs) return '-';
    const d = new Date(unixTs * 1000);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}

function buildGalleryFromData(data, urlId, cdnExt, extra) {
    const titleEnglish = data.title?.english || '';
    const titleJapanese = data.title?.japanese || '';
    const titlePretty = data.title?.pretty || '';
    const title = titleEnglish || titleJapanese || titlePretty || `Gallery #${urlId}`;

    const allTags = data.tags || [];
    const byType = (type) => allTags.filter(t => t.type === type).map(t => t.name);
    const tags = byType('tag');
    const artists = byType('artist');
    const groups = byType('group');
    const parodies = byType('parody');
    const characters = byType('character');
    const categories = byType('category');
    const langArr = byType('language');
    const language = langArr.join(', ') || null;

    const resolvedExt = extra?.cdnExtFromFallback || cdnExt || null;

    const rawPages = data.images?.pages;
    let pagesArr = [];
    if (Array.isArray(rawPages)) {
        pagesArr = rawPages;
    } else if (rawPages && typeof rawPages === 'object') {
        const keys = Object.keys(rawPages).map(Number).sort((a, b) => a - b);
        pagesArr = keys.map(k => rawPages[k]);
    }
    const pages = pagesArr.map((p, i) => ({
        index: i + 1,
        ext: resolvedExt || EXT_MAP[p.t] || 'jpg',
        width: p.w || 1280,
        height: p.h || 1840,
    }));

    return {
        id: urlId || String(data.id),
        mediaId: data.media_id,
        title,
        titleEnglish,
        titleJapanese,
        titlePretty,
        numPages: data.num_pages || pages.length,
        pages,
        tags,
        artists,
        groups,
        parodies,
        characters,
        categories,
        language,
        likes: extra?.likes || 0,
        favorites: extra?.favorites || 0,
        uploadDate: data.upload_date ? formatDate(data.upload_date) : '-',
        coverUrl: extra?.coverUrl || null,
    };
}

function parseSearchCards(html) {
    const ids = [...html.matchAll(/href="\/g\/(\d+)\/"/g)].map(x => x[1]);
    const titles = [...html.matchAll(/class="caption"[^>]*>([\s\S]*?)<\/div>/g)].map(x => x[1].replace(/<[^>]+>/g, '').trim());
    const results = ids.map((id, i) => ({ id, title: titles[i] || '(no title)' }));
    return [...new Map(results.map(r => [r.id, r])).values()];
}

async function nhentaiSearch(query, page = 1) {
    const html = await fetchHtml(`${BASE}/search/?q=${encodeURIComponent(query)}&page=${page}`);
    return parseSearchCards(html);
}

async function nhentaiGallery(id) {
    const html = await fetchHtml(`${BASE}/g/${id}/`);
    const data = parseGalleryJson(html);
    const cdnExt = detectCdnExt(html);
    const extra = scrapeExtraInfo(html);
    return buildGalleryFromData(data, String(id), cdnExt, extra);
}

async function nhentaiRandom() {
    const html = await fetchHtml(`${BASE}/go`);
    const ids = [...new Set([...html.matchAll(/href="\/g\/(\d+)\/"/g)].map(x => x[1]))];
    if (!ids.length) throw new Error('Tidak ada gallery di halaman /go');
    const picked = ids[Math.floor(Math.random() * ids.length)];
    return nhentaiGallery(picked);
}

async function nhentaiCover(gallery) {
    if (!gallery.coverUrl) return null;
    const tryUrls = [gallery.coverUrl];
    const base = gallery.coverUrl.replace(/\.[^.]+$/, '');
    for (const ext of ['webp', 'jpg', 'png']) {
        const u = `${base}.${ext}`;
        if (!tryUrls.includes(u)) tryUrls.push(u);
    }
    for (const url of tryUrls) {
        try {
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: { ...HEADERS, Accept: 'image/*' },
            });
            if (res.status === 200 && res.data.byteLength > 500) {
                return await sharp(Buffer.from(res.data)).jpeg({ quality: 90 }).toBuffer();
            }
        } catch { }
    }
    return null;
}

async function downloadImage(mediaId, pageNum, hintExt) {
    const tryExts = hintExt
        ? [hintExt, ...['webp', 'jpg', 'png'].filter(e => e !== hintExt)]
        : ['webp', 'jpg', 'png'];
    for (const cdn of CDN_LIST) {
        for (const ext of tryExts) {
            const url = `${cdn}/galleries/${mediaId}/${pageNum}.${ext}`;
            try {
                const res = await axios.get(url, {
                    responseType: 'arraybuffer',
                    timeout: 25000,
                    headers: { ...HEADERS, Accept: 'image/*' },
                });
                if (res.status === 200 && res.data.byteLength > 500) {
                    return Buffer.from(res.data);
                }
            } catch {
                // try next
            }
        }
    }
    throw new Error(`Gagal download halaman ${pageNum} dari semua CDN`);
}

async function batchDownload(mediaId, pages, concurrency = 3, onProgress) {
    const results = new Array(pages.length);
    let done = 0;
    for (let i = 0; i < pages.length; i += concurrency) {
        const batch = pages.slice(i, i + concurrency);
        const bufs = await Promise.all(batch.map((p, bi) =>
            downloadImage(mediaId, p.index, p.ext).then(buf => {
                done++;
                if (onProgress) onProgress(done, pages.length);
                return buf;
            })
        ));
        for (let j = 0; j < bufs.length; j++) results[i + j] = bufs[j];
    }
    return results;
}

async function nhentaiPdf(gallery, maxPages = 20, onProgress) {
    const pages = gallery.pages.slice(0, maxPages);
    const rawBufs = await batchDownload(gallery.mediaId, pages, 3, onProgress);

    const jpegBufs = await Promise.all(rawBufs.map(async buf => {
        try { return await sharp(buf).jpeg({ quality: 85 }).toBuffer(); }
        catch { return buf; }
    }));

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        pages.forEach((page, i) => {
            doc.addPage({ size: [page.width, page.height], margin: 0 });
            try { doc.image(jpegBufs[i], 0, 0, { width: page.width, height: page.height }); }
            catch { doc.fontSize(12).text(`[Error hal. ${page.index}]`, 10, 10); }
        });
        doc.end();
    });
}

function makeProgressBar(done, total) {
    const pct = Math.round((done / total) * 100);
    const filled = Math.round((done / total) * 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    return { pct, bar };
}

function formatGalleryInfo(gallery, pfx = '.') {
    const tagList = gallery.tags.slice(0, 10).join(', ') || '-';
    const artistLine = gallery.artists.length ? gallery.artists.join(', ') : '-';
    const groupLine = gallery.groups.length ? gallery.groups.join(', ') : '-';
    const parodyLine = gallery.parodies.length ? gallery.parodies.join(', ') : '-';
    const charLine = gallery.characters.length ? gallery.characters.slice(0, 5).join(', ') : '-';
    const catLine = gallery.categories.length ? gallery.categories.join(', ') : '-';
    const langLine = gallery.language
        ? gallery.language.split(', ').map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ')
        : '-';

    let lines = `╭─「 📖 *NHENTAI* 」\n│\n`;
    lines += `│ 📌 *ID*       : ${gallery.id}\n`;

    if (gallery.titleEnglish) {
        lines += `│ 📝 *EN*       :\n│ _${gallery.titleEnglish.slice(0, 90)}_\n`;
    }
    if (gallery.titleJapanese) {
        lines += `│ 🗾 *JP*       :\n│ ${gallery.titleJapanese.slice(0, 90)}\n`;
    }

    lines += `│\n`;
    lines += `│ 🎨 *Artist*   : ${artistLine}\n`;
    if (groupLine !== '-') lines += `│ 👥 *Group*    : ${groupLine}\n`;
    if (parodyLine !== '-') lines += `│ 📺 *Parody*   : ${parodyLine}\n`;
    if (charLine !== '-') lines += `│ 👤 *Karakter* : ${charLine}\n`;
    lines += `│ 📚 *Kategori* : ${catLine}\n`;
    lines += `│ 🌐 *Bahasa*   : ${langLine}\n`;
    lines += `│\n`;
    lines += `│ 📄 *Halaman*  : ${gallery.numPages}\n`;
    lines += `│ ❤️ *Likes*    : ${gallery.likes.toLocaleString()}`;
    if (gallery.favorites > 0) lines += ` | ⭐ *Fav* : ${gallery.favorites.toLocaleString()}`;
    lines += `\n`;
    lines += `│ 📅 *Upload*   : ${gallery.uploadDate}\n`;
    lines += `│\n`;
    lines += `│ 🏷️ *Tags:*\n│ ${tagList}\n`;
    lines += `│\n`;
    lines += `│ 💡 Download PDF:\n│ ${pfx}nhget ${gallery.id}\n`;
    lines += `╰──────────────────────`;
    return lines;
}

function formatSearchResults(results, query) {
    if (!results.length) return `❌ Tidak ada hasil untuk: _${query}_`;
    let text = `╭─「 🔍 *NHENTAI SEARCH* 」\n│\n│ Hasil untuk: _${query}_\n│\n`;
    results.slice(0, 10).forEach((r, i) => {
        text += `│ *${i + 1}.* [${r.id}] ${r.title.slice(0, 60)}${r.title.length > 60 ? '…' : ''}\n`;
    });
    text += `│\n│ 💡 Ketik *.nhget <id>* untuk download PDF\n╰──────────────────────`;
    return text;
}

module.exports = { nhentaiSearch, nhentaiGallery, nhentaiRandom, nhentaiPdf, nhentaiCover, formatGalleryInfo, formatSearchResults, makeProgressBar };
