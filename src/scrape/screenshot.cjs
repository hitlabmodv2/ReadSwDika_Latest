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
const axios = require('axios');
const cheerio = require('cheerio');

/**
 * Ambil screenshot website menggunakan layanan gratis microlink.io
 * @param {string} url - URL yang akan di-screenshot
 * @returns {Promise<Buffer>} - Buffer gambar screenshot
 */
async function screenshotWeb(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    const encodedUrl = encodeURIComponent(url);
    const apiUrl = `https://api.microlink.io/?url=${encodedUrl}&screenshot=true&meta=false`;

    const metaRes = await axios.get(apiUrl, {
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    const ssUrl = metaRes.data?.data?.screenshot?.url;
    if (!ssUrl) throw new Error('Tidak dapat mengambil screenshot, coba lagi');

    const imgRes = await axios.get(ssUrl, {
        responseType: 'arraybuffer',
        timeout: 30000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
    });

    if (!imgRes.data || imgRes.data.byteLength < 500) {
        throw new Error('Gambar screenshot kosong, coba URL lain');
    }

    return Buffer.from(imgRes.data);
}

/**
 * Scrape konten teks dari sebuah website
 * @param {string} url - URL yang akan di-scrape
 * @returns {Promise<Object>} - Objek berisi info scraped
 */
async function scrapeWeb(url) {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
    }

    const response = await axios.get(url, {
        timeout: 20000,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xhtml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8'
        },
        maxRedirects: 5
    });

    const html = response.data;
    const $ = cheerio.load(html);

    $('script, style, nav, footer, iframe, noscript, .ads, #ads, .advertisement').remove();

    const title = $('title').text().trim() || $('h1').first().text().trim() || 'Tidak ada judul';

    const description =
        $('meta[name="description"]').attr('content') ||
        $('meta[property="og:description"]').attr('content') ||
        '';

    const ogImage =
        $('meta[property="og:image"]').attr('content') ||
        $('meta[name="twitter:image"]').attr('content') ||
        '';

    const links = [];
    $('a[href]').each((i, el) => {
        if (i >= 10) return false;
        const href = $(el).attr('href');
        const text = $(el).text().trim();
        if (text && href && !href.startsWith('#') && !href.startsWith('javascript')) {
            links.push({ text: text.substring(0, 60), href });
        }
    });

    const headings = [];
    $('h1, h2, h3').each((i, el) => {
        if (i >= 8) return false;
        const text = $(el).text().trim();
        if (text) headings.push(text.substring(0, 80));
    });

    const paragraphs = [];
    $('p').each((i, el) => {
        if (i >= 5) return false;
        const text = $(el).text().trim();
        if (text && text.length > 30) paragraphs.push(text.substring(0, 150));
    });

    const statusCode = response.status;

    return {
        url,
        title,
        description: description.substring(0, 200),
        ogImage,
        headings,
        paragraphs,
        links,
        statusCode
    };
}

module.exports = { screenshotWeb, scrapeWeb };
