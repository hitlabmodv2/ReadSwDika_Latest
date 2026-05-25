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

const BASE    = 'https://alqanime.net';
const JINA    = 'https://r.jina.ai';

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'text/plain, */*',
    'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
};

async function fetchMarkdown(url) {
    const res = await axios.get(`${JINA}/${url}`, {
        headers: HEADERS,
        timeout: 30000,
    });
    return res.data;
}

function parseAnimeCards(md) {
    const results = [];
    const seen = new Set();
    const regex = /!\[Image \d+: ([^\]]+)\]\((https:\/\/alqanime\.net\/wp-content[^)]+)\)[^\[\n]*## ([^\]]+)\]\((https:\/\/alqanime\.net\/[^/"]+\/)[^\)\n]*\)/g;
    let m;
    while ((m = regex.exec(md)) !== null) {
        const url  = m[4];
        if (url.includes('wp-content') || url.includes('?') || seen.has(url)) continue;
        seen.add(url);
        const title     = m[3].trim();
        const thumbnail = m[2];
        const altText   = m[1];
        const scoreM    = altText.match(/([\d.]+)$/);
        const score     = scoreM ? scoreM[1] : '';
        const typeM     = altText.match(/^(Completed|Ongoing)/i);
        const status    = typeM ? typeM[1] : '';
        results.push({ title, thumbnail, url, score, status });
    }
    return results;
}

function parseDownloadLinks(md) {
    const episodes = [];
    const dlSection = md.match(/## Download [^\n]+\n([\s\S]*?)(?:### Series Terkait|### Komentar|### Rekomendasi|$)/);
    if (!dlSection) return episodes;

    const dlContent = dlSection[1];
    const epBlocks  = dlContent.split(/(?=### Episode )/);

    for (const block of epBlocks) {
        const epMatch = block.match(/### Episode\s+([^\n]+)/);
        if (!epMatch) continue;

        const epLabel = epMatch[1].trim();
        const links   = {};

        // Parse per-resolution links: 360p[Host](url)[Host2](url2)
        const resRegex = /(360p|480p|720p|1080p)/gi;
        const lines    = block.split('\n').filter(l => /360p|480p|720p|1080p/i.test(l));

        for (const line of lines) {
            const resM = line.match(/^(360p|480p|720p|1080p)/i);
            if (!resM) continue;
            const res   = resM[1].toLowerCase();
            const hosts = [];
            const lRe   = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g;
            let lm;
            while ((lm = lRe.exec(line)) !== null) {
                hosts.push({ host: lm[1], url: lm[2] });
            }
            if (hosts.length) links[res] = hosts;
        }

        // Batch link (episode sebelumnya)
        const batchM = block.match(/360p.*1080p\[([^\]]+)\]\((https?:\/\/[^)]+)\)/);
        if (batchM) links['batch'] = [{ host: batchM[1], url: batchM[2] }];

        if (Object.keys(links).length) {
            episodes.push({ episode: epLabel, links });
        }
    }

    return episodes;
}

function parseDetail(md) {
    const titleM  = md.match(/^# ([^\n]+)/m);
    const title   = titleM ? titleM[1].replace(/ - Alqanime$/, '').trim() : '';

    // Poster 200x300 (bukan logo header)
    const thumbM  = md.match(/!\[Image \d+[^\]]*\]\((https:\/\/alqanime\.net\/wp-content\/uploads\/[^)]*-200x300[^)]*)\)/);
    // Fallback ke gambar besar pertama jika tidak ada 200x300
    const thumbFB = md.match(/!\[Image \d+[^\]]*\]\((https:\/\/alqanime\.net\/wp-content\/uploads\/(?!.*Header)[^)]+\.(?:jpg|png|webp))\)/);
    const thumbnail = thumbM ? thumbM[1] : (thumbFB ? thumbFB[1] : '');

    const info = {};
    for (const field of [
        'Status','Studio','Dirilis','Durasi','Musim','Tipe','Episode',
        'Subtitle','Credit','Score',
        'Casts','Diposting oleh','Diposting pada','Diperbarui pada',
    ]) {
        const re  = new RegExp(`\\*\\*${field.replace(/ /g,'\\s+')}:\\*\\*\\s*([^\\*\\n]+)`);
        const hit = md.match(re);
        if (hit) {
            info[field] = hit[1].trim()
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/^_+|_+$/g, '')
                .replace(/\s{2,}/g, ' ')
                .trim();
        }
    }
    const scoreM = md.match(/Score\s+([\d.]+)/);
    if (scoreM && !info.Score) info.Score = scoreM[1];

    // Judul alternatif (English / Kanji) — baris kosong sebelum **Status:**
    const altM = md.match(/\n\n([^\n#*!\[<\\]{3,})\n\n\*\*Status:/);
    if (altM) info.judulAlt = altM[1].trim();

    // Ambil sinopsis — hanya paragraf pertama sebelum baris notice/emoji
    const synM    = md.match(/## Sinopsis[^\n]*\n\n([^#]+)/);
    let sinopsis = '';
    if (synM) {
        const raw = synM[1].trim();
        // Potong di baris yang ada icon notice (✴, !, gambar)
        const cutIdx = raw.search(/\n\s*(?:✴|!|#+\s)/);
        sinopsis = (cutIdx > 0 ? raw.slice(0, cutIdx) : raw)
            .replace(/\r\n/g, '\n')           // normalkan CRLF
            .replace(/\n{3,}/g, '\n\n')        // 3+ newline → 2 (satu baris kosong)
            .replace(/([^\n])\n([^\n])/g, '$1 $2') // newline tunggal dalam paragraf → spasi
            .trim();
    }

    // Ambil genre hanya dari konten post, sebelum sidebar genre list
    const postContent = md.split(/### Sukai Kami|### Rekomendasi|### Komentar/)[0];
    const genres = [];
    const genRe  = /\[([^\]]+)\]\(https:\/\/alqanime\.net\/tag\/[^)]+\)/g;
    let gm;
    while ((gm = genRe.exec(postContent)) !== null) {
        if (!genres.includes(gm[1])) genres.push(gm[1]);
    }

    const episodes = parseDownloadLinks(md);

    return { title, thumbnail, info, sinopsis, genres, episodes };
}

async function searchAlqanime(query) {
    const md = await fetchMarkdown(`${BASE}/?s=${encodeURIComponent(query)}`);
    return parseAnimeCards(md);
}

async function getDetailAlqanime(urlOrSlug) {
    const url = urlOrSlug.startsWith('http') ? urlOrSlug : `${BASE}/${urlOrSlug}/`;
    const md  = await fetchMarkdown(url);
    return parseDetail(md);
}

async function getLatestAlqanime() {
    const md = await fetchMarkdown(BASE);
    return parseAnimeCards(md);
}

async function getRilisanTerbaru() {
    const md = await fetchMarkdown(BASE);
    // Potong hanya seksi "Rilisan Terbaru" sampai seksi berikutnya
    const sectionM = md.match(/###\s*Rilisan Terbaru\s*\n([\s\S]*?)(?=###\s|\n##\s|$)/i);
    if (!sectionM) return parseAnimeCards(md); // fallback ke semua cards
    return parseAnimeCards(sectionM[1]);
}

module.exports = { searchAlqanime, getDetailAlqanime, getLatestAlqanime, getRilisanTerbaru };
