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
const cheerio = require('cheerio');
const sharp = require('sharp');
const PDFDocument = require('pdfkit');

const BASE = 'https://komiktap.info';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
    'Referer': `${BASE}/`,
};

async function fetchHtml(url) {
    const res = await axios.get(url, {
        headers: HEADERS,
        timeout: 20000,
        maxRedirects: 5,
    });
    return res.data;
}

async function komiktapSearch(query) {
    const html = await fetchHtml(`${BASE}/?s=${encodeURIComponent(query)}`);
    const $ = cheerio.load(html);
    const results = [];

    $('.bsx').each((i, el) => {
        const a = $(el).find('a').first();
        const href = a.attr('href') || '';
        const title = (a.attr('title') || $(el).find('.tt').text() || '').trim();
        const cover = $(el).find('img').first().attr('src') || '';
        const status = $(el).find('[class*="status"]').first().text().trim();
        const type = $(el).find('[class*="type"]').first().text().trim();
        const rating = $(el).find('[style*="width"]').first().attr('style') || '';
        const ratingVal = (rating.match(/width:(\d+)%/) || [])[1] || null;
        const lastChap = $(el).find('.epxs').first().text().trim();

        if (href && title) {
            results.push({ title, url: href, cover, status, type, rating: ratingVal ? `${ratingVal}%` : null, lastChap });
        }
    });

    return results;
}

async function komiktapDetail(url) {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    const title = $('h1.entry-title').first().text().trim() || $('h1').first().text().trim();
    const altTitle = $('.alternative').first().text().replace(/^alternative\s*/i, '').trim();
    const cover = $('div.thumb img').first().attr('src') || $('div[itemprop="image"] img').first().attr('src') || '';

    const info = {};
    $('table.infotable tr').each((i, el) => {
        const tds = $(el).find('td');
        if (tds.length >= 2) {
            const key = $(tds[0]).text().trim();
            const val = $(tds[1]).text().replace(/\s+/g, ' ').trim();
            if (key && val) info[key] = val;
        }
    });

    const genres = [];
    $('a[rel="tag"]').each((i, el) => {
        const g = $(el).text().trim();
        if (g && !genres.includes(g)) genres.push(g);
    });

    const synopsis = $('.entry-content p, .synops p').filter((i, el) => {
        const txt = $(el).text().trim();
        return txt.length > 30;
    }).first().text().trim();

    const chapters = [];
    $('li[data-num]').each((i, el) => {
        const num = $(el).attr('data-num') || '';
        const chUrl = $(el).find('a').first().attr('href') || '';
        const chName = $(el).find('.chapternum').text().trim();
        const chDate = $(el).find('.chapterdate').text().trim();
        if (chUrl) chapters.push({ num, name: chName || `Chapter ${num}`, url: chUrl, date: chDate });
    });

    chapters.reverse();

    return { title, altTitle, cover, info, genres, synopsis, chapters, url };
}

async function komiktapChapterImages(chapterUrl) {
    const html = await fetchHtml(chapterUrl);
    const match = html.match(/ts_reader\.run\(({[\s\S]+?})\);/);
    if (!match) throw new Error('Tidak bisa menemukan data gambar di chapter ini');

    let data;
    try { data = JSON.parse(match[1]); } catch (e) { throw new Error('Gagal parse data gambar chapter'); }

    const sources = data.sources || [];
    if (!sources.length) throw new Error('Tidak ada sumber gambar ditemukan');

    const images = sources[0].images || [];
    if (!images.length) throw new Error('Daftar gambar kosong');

    return images;
}

async function downloadImage(url) {
    const res = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout: 25000,
        headers: {
            ...HEADERS,
            Accept: 'image/*',
            Referer: `${BASE}/`,
        },
    });
    if (res.status !== 200 || res.data.byteLength < 200) throw new Error(`Gambar kosong: ${url}`);
    return Buffer.from(res.data);
}

async function batchDownload(imageUrls, concurrency = 3, onProgress) {
    const results = new Array(imageUrls.length);
    let done = 0;

    for (let i = 0; i < imageUrls.length; i += concurrency) {
        const batch = imageUrls.slice(i, i + concurrency);
        const bufs = await Promise.all(
            batch.map((url, bi) =>
                downloadImage(url).then(buf => {
                    done++;
                    if (onProgress) onProgress(done, imageUrls.length);
                    return buf;
                }).catch(() => {
                    done++;
                    if (onProgress) onProgress(done, imageUrls.length);
                    return null;
                })
            )
        );
        for (let j = 0; j < bufs.length; j++) results[i + j] = bufs[j];
    }
    return results;
}

async function komiktapPdf(chapterUrl, maxPages = 20, onProgress) {
    const images = await komiktapChapterImages(chapterUrl);
    const limited = images.slice(0, maxPages);

    const rawBufs = await batchDownload(limited, 3, onProgress);

    const processedBufs = await Promise.all(rawBufs.map(async (buf, i) => {
        if (!buf) return { buf: null, width: 1280, height: 1800 };
        try {
            const meta = await sharp(buf).metadata();
            const jpeg = await sharp(buf).jpeg({ quality: 85 }).toBuffer();
            return { buf: jpeg, width: meta.width || 1280, height: meta.height || 1800 };
        } catch {
            return { buf: null, width: 1280, height: 1800 };
        }
    }));

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ autoFirstPage: false, margin: 0 });
        const chunks = [];
        doc.on('data', c => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        processedBufs.forEach((page, i) => {
            doc.addPage({ size: [page.width, page.height], margin: 0 });
            if (page.buf) {
                try { doc.image(page.buf, 0, 0, { width: page.width, height: page.height }); }
                catch { doc.fontSize(12).text(`[Error halaman ${i + 1}]`, 10, 10); }
            } else {
                doc.fontSize(12).text(`[Gagal load halaman ${i + 1}]`, 10, 10);
            }
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

function formatSearchResults(results, query) {
    if (!results.length) return `❌ Tidak ada hasil untuk: _${query}_`;
    let text = `╭─「 🔍 *KOMIKTAP SEARCH* 」\n│\n│ Hasil: _${query}_\n│\n`;
    results.slice(0, 10).forEach((r, i) => {
        const status = r.status ? ` [${r.status}]` : '';
        const type = r.type ? ` • ${r.type}` : '';
        const rating = r.rating ? ` ⭐${r.rating}` : '';
        text += `│ *${i + 1}.* ${r.title.slice(0, 55)}${r.title.length > 55 ? '…' : ''}\n`;
        text += `│     ${status}${type}${rating}\n`;
    });
    text += `│\n│ 💡 Ketik *.komik <judul>* untuk detail\n╰──────────────────────`;
    return text;
}

function formatDetailText(detail, pfx = '.') {
    const { title, altTitle, info, genres, synopsis, chapters } = detail;

    const genreList = genres.slice(0, 8).join(', ') || '-';
    const status = info['Status'] || info['status'] || '-';
    const type = info['Type'] || info['Tipe'] || '-';
    const author = info['Author'] || info['Penulis'] || '-';
    const artist = info['Artist'] || '-';
    const released = info['Released'] || info['Rilis'] || '-';
    const updated = info['Updated'] || info['Diperbarui'] || '-';
    const totalCh = chapters.length;
    const latestCh = chapters.length ? chapters[chapters.length - 1].name : '-';
    const firstCh = chapters.length ? chapters[0].name : '-';

    let text = `╭─「 📖 *KOMIKTAP* 」\n│\n`;
    text += `│ 📌 *Judul*   : ${title}\n`;
    if (altTitle) text += `│ 📝 *Alt*     : ${altTitle.slice(0, 60)}\n`;
    text += `│\n`;
    text += `│ 📺 *Tipe*    : ${type}\n`;
    text += `│ ✅ *Status*  : ${status}\n`;
    if (author !== '-') text += `│ ✍️ *Author*  : ${author}\n`;
    if (artist !== '-') text += `│ 🎨 *Artist*  : ${artist}\n`;
    if (released !== '-') text += `│ 📅 *Rilis*   : ${released}\n`;
    if (updated !== '-') text += `│ 🔄 *Update*  : ${updated}\n`;
    text += `│\n`;
    text += `│ 📚 *Chapter* : ${totalCh} chapter\n`;
    text += `│ 📖 *Pertama* : ${firstCh}\n`;
    text += `│ 🆕 *Terbaru* : ${latestCh}\n`;
    text += `│\n`;
    text += `│ 🏷️ *Genre*   : ${genreList}\n`;

    if (synopsis) {
        text += `│\n│ 📃 *Sinopsis:*\n│ _${synopsis.slice(0, 250)}${synopsis.length > 250 ? '...' : ''}_\n`;
    }

    if (chapters.length > 0) {
        text += `│\n│ 💡 Download PDF:\n│ ${pfx}komikget <url chapter>\n`;
        text += `│ Contoh:\n│ ${pfx}komikget ${chapters[chapters.length - 1].url}\n`;
    }

    text += `╰──────────────────────`;
    return text;
}

async function komiktapLatestUpdates() {
    const html = await fetchHtml(`${BASE}/manga/?orderby=modified`);
    const $ = cheerio.load(html);
    const items = [];

    // MangaReader theme: .listupd .bs .bsx
    $('.listupd .bsx, .utao .uta').each((i, el) => {
        if (items.length >= 20) return false;
        const a = $(el).find('a').first();
        const href = a.attr('href') || '';
        const title = (a.attr('title') || $(el).find('.tt, h4, h3').first().text() || '').trim();
        const cover = $(el).find('img').first().attr('src') || '';
        const status = $(el).find('[class*="status"]').first().text().trim();
        const type = $(el).find('[class*="type"]').first().text().trim();
        const lastChap = $(el).find('.epxs, .lch a').first().text().trim();
        if (href && title) items.push({ title, url: href, cover, status, type, lastChap });
    });

    // Fallback: homepage .bsx cards
    if (!items.length) {
        $('.bsx').each((i, el) => {
            if (items.length >= 20) return false;
            const a = $(el).find('a').first();
            const href = a.attr('href') || '';
            const title = (a.attr('title') || $(el).find('.tt').text() || '').trim();
            const cover = $(el).find('img').first().attr('src') || '';
            const status = $(el).find('[class*="status"]').first().text().trim();
            const type = $(el).find('[class*="type"]').first().text().trim();
            const lastChap = $(el).find('.epxs').first().text().trim();
            if (href && title) items.push({ title, url: href, cover, status, type, lastChap });
        });
    }

    return items;
}

module.exports = {
    komiktapSearch,
    komiktapDetail,
    komiktapChapterImages,
    komiktapPdf,
    komiktapLatestUpdates,
    makeProgressBar,
    formatSearchResults,
    formatDetailText,
};
