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
import axios from 'axios';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const IMAGE_SEARCH_VERBOSE_LOGS = process.env.WILY_VERBOSE_LOGS === 'true' || process.env.BOT_DEBUG_LOG === 'true';
const imageSearchLog = (...args) => {
    if (IMAGE_SEARCH_VERBOSE_LOGS) console.log(...args);
};
const imageSearchError = (...args) => {
    if (IMAGE_SEARCH_VERBOSE_LOGS) console.error(...args);
};

// ── Normalisasi query ──
function normalizeQuery(query) {
    let q = query.trim();
    q = q.replace(/\b(\w{3,})(nya)\b/gi, '$1');
    q = q.replace(/\b(\w{3,})(lah|kah|pun)\b/gi, '$1');
    q = q.replace(/\s+/g, ' ').trim();
    return q;
}

// ── Gemmy Gemini: ambil token Firebase ──
let gemmyToken = null;
let gemmyTokenExpiry = 0;

async function getGemmyToken() {
    if (gemmyToken && Date.now() < gemmyTokenExpiry - 300000) return gemmyToken;
    const { data } = await axios.post(
        'https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key=AIzaSyAxof8_SbpDcww38NEQRhNh0Pzvbphh-IQ',
        { clientType: 'CLIENT_TYPE_ANDROID' },
        {
            headers: {
                'accept-encoding': 'gzip',
                'accept-language': 'in-ID, en-US',
                'connection': 'Keep-Alive',
                'content-type': 'application/json',
                'user-agent': 'Dalvik/2.1.0 (Linux; U; Android 10; SM-J700F Build/QQ3A.200805.001)',
                'x-android-cert': '037CD2976D308B4EFD63EC63C48DC6E7AB7E5AF2',
                'x-android-package': 'com.jetkite.gemmy',
                'x-client-version': 'Android/Fallback/X24000001/FirebaseCore-Android',
                'x-firebase-appcheck': 'eyJlcnJvciI6IlVOS05PV05fRVJST1IifQ==',
                'x-firebase-client': 'H4sIAAAAAAAAAKtWykhNLCpJSk0sKVayio7VUSpLLSrOzM9TslIyUqoFAFyivEQfAAAA',
                'x-firebase-gmpid': '1:652803432695:android:c4341db6033e62814f33f2',
            },
        }
    );
    if (!data.idToken) throw new Error('Gemmy: gagal ambil token');
    gemmyToken = data.idToken;
    gemmyTokenExpiry = Date.now() + 3600 * 1000;
    return gemmyToken;
}

// ── Gemmy Gemini: chat ──
async function gemmyChat(contents, model = 'gemini-flash-latest') {
    const authToken = await getGemmyToken();
    const { data } = await axios.post(
        'https://asia-northeast3-gemmy-ai-bdc03.cloudfunctions.net/gemini',
        {
            model,
            stream: false,
            request: {
                contents,
                generationConfig: { maxOutputTokens: 256 },
            },
        },
        {
            headers: {
                'accept-encoding': 'gzip',
                'authorization': `Bearer ${authToken}`,
                'content-type': 'application/json; charset=UTF-8',
                'user-agent': 'okhttp/5.3.2',
            },
            timeout: 8000,
        }
    );
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemmy: respons kosong');
    return text;
}

// ── Gemmy: terjemahkan ke query Inggris yang akurat ──
// Hanya digunakan jika query mengandung huruf non-ASCII atau bahasa Indonesia
function isIndonesian(query) {
    const idWords = /\b(gambar|foto|kucing|anjing|bunga|pohon|ikan|burung|mobil|motor|rumah|indah|cantik|lucu|bagus|merah|biru|hijau|hitam|putih|besar|kecil|mawar|melati|harimau|gajah|monyet|singa|kuda|sapi|kambing|ayam|bebek|kodok|ular|buaya|rusa|beruang)\b/i;
    const nonEnglishChars = /[^\x00-\x7F]/;
    return idWords.test(query) || nonEnglishChars.test(query);
}

async function enhanceQueryWithGemmy(userQuery) {
    try {
        // Kalau sudah dalam bahasa Inggris dan cukup spesifik, skip enhancement
        if (!isIndonesian(userQuery) && userQuery.split(' ').length >= 2) {
            return userQuery;
        }

        const prompt = `Translate this image search request into a precise English search query for image search engines.
Rules:
- Return ONLY the English search query, no explanation, no quotes
- Be specific and descriptive (e.g., colors, species name, location)
- Keep it under 8 words
- If it's already specific in English, return as-is

Request: "${userQuery}"`;

        const result = await gemmyChat([{ role: 'user', parts: [{ text: prompt }] }]);
        const enhanced = result.trim().replace(/^["']|["']$/g, '').trim();
        if (enhanced && enhanced.length > 2 && enhanced.length < 150) {
            imageSearchLog(`[Gemmy] Query enhanced: "${userQuery}" → "${enhanced}"`);
            return enhanced;
        }
        return userQuery;
    } catch (e) {
        imageSearchLog(`[Gemmy] Query enhance gagal, pakai asli: ${e.message}`);
        return userQuery;
    }
}

async function downloadImageBuffer(url, timeout = 10000) {
    const { data } = await axios.get(url, {
        responseType: 'arraybuffer',
        timeout,
        headers: {
            'User-Agent': UA,
            'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
            'Referer': 'https://www.google.com/',
        },
        maxRedirects: 5,
    });
    return Buffer.from(data);
}

// ── Sumber 1: DuckDuckGo Images (JSON API — paling akurat & stabil) ──
async function searchDuckDuckGo(query, count = 10) {
    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
        };

        const { data: tokenData } = await axios.get('https://duckduckgo.com/', {
            params: { q: query, iax: 'images', ia: 'images' },
            headers,
            timeout: 12000,
        });

        const vqdMatch = tokenData.match(/vqd=([0-9-]+)/);
        if (!vqdMatch) {
            imageSearchLog(`[ImageSearch] DDG: gagal ambil vqd token`);
            return [];
        }
        const vqd = vqdMatch[1];

        const { data } = await axios.get('https://duckduckgo.com/i.js', {
            params: {
                q: query,
                vqd,
                f: ',,,,,',
                p: 1,
                o: 'json',
                l: 'en-us',
            },
            headers: {
                ...headers,
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'Referer': `https://duckduckgo.com/?q=${encodeURIComponent(query)}&iax=images&ia=images`,
                'X-Requested-With': 'XMLHttpRequest',
            },
            timeout: 12000,
        });

        const results = (data.results || []).slice(0, count).map(r => ({
            image: r.image || r.url,
            title: r.title || query,
        })).filter(r => r.image && r.image.startsWith('http'));

        imageSearchLog(`[ImageSearch] DDG: ${results.length} hasil`);
        return results;
    } catch (e) {
        imageSearchError(`[ImageSearch] DDG error: ${e.message}`);
        return [];
    }
}

// ── Sumber 2: Bing Images ──
async function searchBing(query, count = 10) {
    try {
        const { data } = await axios.get('https://www.bing.com/images/async', {
            params: { q: query, first: 1, count: count * 3, mmasync: 1, adlt: 'off' },
            headers: {
                'User-Agent': UA,
                'Accept': 'text/html,application/xhtml+xml,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.bing.com/images/search?q=' + encodeURIComponent(query),
                'Cookie': 'SRCHHPGUSR=ADLT=DEMOTE; _EDGE_S=ui=en-us; MUID=',
            },
            timeout: 12000,
        });

        const results = [];
        const seen = new Set();

        // Pattern untuk berbagai format Bing (2024-2025)
        const patterns = [
            /murl&quot;:&quot;(https?:\/\/[^&"]+)&quot;/g,
            /"murl":"(https?:\/\/[^"\\]+)"/g,
            /murl\\u0022:\\u0022(https?:\/\/[^\\]+)\\u0022/g,
            /"mediaurl":"(https?:\/\/[^"]+)"/g,
        ];

        for (const re of patterns) {
            let m;
            while ((m = re.exec(data)) !== null && results.length < count * 2) {
                try {
                    let url = decodeURIComponent(m[1].replace(/\\u002f/gi, '/'));
                    url = url.replace(/&amp;/g, '&');
                    if (url.startsWith('http') && !seen.has(url) && !url.includes('bing.com') && !url.includes('microsoft.com')) {
                        seen.add(url);
                        results.push({ image: url, title: query });
                    }
                } catch (_) {}
            }
            if (results.length >= count) break;
        }

        imageSearchLog(`[ImageSearch] Bing: ${results.length} hasil`);
        return results.slice(0, count);
    } catch (e) {
        imageSearchError(`[ImageSearch] Bing error: ${e.message}`);
        return [];
    }
}

// ── Sumber 3: Google Images ──
async function searchGoogle(query, count = 10) {
    try {
        const { data } = await axios.get('https://www.google.com/search', {
            params: { q: query, tbm: 'isch', hl: 'en', safe: 'off', num: 30 },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://www.google.com/',
            },
            timeout: 12000,
        });

        const results = [];
        const seen = new Set();

        const patterns = [
            /\["(https?:\/\/(?!encrypted-tbn)[^"\\]{10,}\.(?:jpg|jpeg|png|webp|gif)(?:\?[^"\\]{0,200})?)",\d+,\d+\]/g,
            /"ou":"(https?:\/\/[^"]+)"/g,
        ];

        for (const re of patterns) {
            let m;
            while ((m = re.exec(data)) !== null && results.length < count) {
                const url = m[1];
                if (url && url.startsWith('http') && !seen.has(url) && !url.includes('google') && !url.includes('gstatic')) {
                    seen.add(url);
                    results.push({ image: url, title: query });
                }
            }
            if (results.length >= count) break;
        }

        imageSearchLog(`[ImageSearch] Google: ${results.length} hasil`);
        return results;
    } catch (e) {
        imageSearchError(`[ImageSearch] Google error: ${e.message}`);
        return [];
    }
}

// ── Sumber 4: Openverse API (Creative Commons) ──
async function searchOpenverse(query, count = 6) {
    try {
        const { data } = await axios.get('https://api.openverse.org/v1/images/', {
            params: { q: query, page_size: count, license_type: 'all' },
            headers: { 'User-Agent': UA },
            timeout: 8000,
        });
        const results = (data.results || []).map(r => ({ image: r.url, title: r.title || query }));
        imageSearchLog(`[ImageSearch] Openverse: ${results.length} hasil`);
        return results;
    } catch (e) {
        imageSearchError(`[ImageSearch] Openverse error: ${e.message}`);
        return [];
    }
}

// ── Sumber 5: Wikipedia thumbnail ──
async function searchWikipedia(query) {
    try {
        const { data } = await axios.get('https://en.wikipedia.org/w/api.php', {
            params: {
                action: 'query',
                generator: 'search',
                gsrsearch: query,
                prop: 'pageimages',
                pithumbsize: 1000,
                format: 'json',
                gsrnamespace: 0,
                gsrlimit: 8,
            },
            headers: { 'User-Agent': UA },
            timeout: 8000,
        });
        const pages = Object.values(data.query?.pages || {});
        const results = pages.filter(p => p.thumbnail?.source).map(p => ({
            image: p.thumbnail.source,
            title: p.title || query,
        }));
        imageSearchLog(`[ImageSearch] Wikipedia: ${results.length} hasil`);
        return results;
    } catch (e) {
        imageSearchError(`[ImageSearch] Wikipedia error: ${e.message}`);
        return [];
    }
}

// ── Sumber 6: Wikimedia Commons ──
async function searchWikimedia(query) {
    try {
        const { data } = await axios.get('https://commons.wikimedia.org/w/api.php', {
            params: {
                action: 'query',
                generator: 'search',
                gsrsearch: `${query} filetype:jpg|png|jpeg|webp`,
                gsrnamespace: 6,
                prop: 'imageinfo',
                iiprop: 'url|size|mime',
                iiurlwidth: 800,
                format: 'json',
                gsrlimit: 8,
            },
            headers: { 'User-Agent': UA },
            timeout: 8000,
        });
        const pages = Object.values(data.query?.pages || {});
        const results = pages
            .filter(p => p.imageinfo?.[0]?.thumburl)
            .map(p => ({
                image: p.imageinfo[0].thumburl,
                title: p.title?.replace('File:', '') || query,
            }));
        imageSearchLog(`[ImageSearch] Wikimedia: ${results.length} hasil`);
        return results;
    } catch (e) {
        imageSearchError(`[ImageSearch] Wikimedia error: ${e.message}`);
        return [];
    }
}

// ── Download satu gambar valid dari daftar ──
async function tryDownloadOne(results) {
    for (const r of results) {
        try {
            if (!r.image || r.image.length < 10) continue;
            const buf = await downloadImageBuffer(r.image, 10000);
            if (buf && buf.length > 5000) return { buffer: buf, url: r.image, title: r.title };
        } catch (_) {}
    }
    return null;
}

// ── Download N gambar berbeda dari daftar ──
async function tryDownloadMany(results, count = 1) {
    const found = [];
    const usedUrls = new Set();
    for (const r of results) {
        if (found.length >= count) break;
        try {
            if (!r.image || r.image.length < 10 || usedUrls.has(r.image)) continue;
            const buf = await downloadImageBuffer(r.image, 10000);
            if (buf && buf.length > 5000) {
                found.push({ buffer: buf, url: r.image, title: r.title });
                usedUrls.add(r.image);
            }
        } catch (_) {}
    }
    return found;
}

// ── Cari 1 gambar (DuckDuckGo utama → Bing → Google → fallback lain) ──
export async function searchAndGetImage(query) {
    const q = normalizeQuery(query);

    // Enhance query ke Inggris (hanya jika perlu)
    const enhancedQ = await enhanceQueryWithGemmy(q);

    console.log(`[ImageSearch] Cari: "${enhancedQ}"${enhancedQ !== q ? ` (asli: "${q}")` : ''}`);

    // Sumber 1: DuckDuckGo (JSON API — paling akurat)
    const ddgRes = await searchDuckDuckGo(enhancedQ, 12);
    if (ddgRes.length > 0) {
        const found = await tryDownloadOne(ddgRes);
        if (found) {
            console.log(`[ImageSearch] ✅ DDG berhasil: ${found.url}`);
            return found;
        }
    }

    // Sumber 2: Bing
    console.log(`[ImageSearch] DDG gagal/kosong, coba Bing...`);
    const bingRes = await searchBing(enhancedQ, 12);
    if (bingRes.length > 0) {
        const found = await tryDownloadOne(bingRes);
        if (found) {
            console.log(`[ImageSearch] ✅ Bing berhasil: ${found.url}`);
            return found;
        }
    }

    // Sumber 3-6: Paralel fallback
    console.log(`[ImageSearch] Bing gagal, coba fallback paralel...`);
    const [googleRes, openverseRes, wikiRes, wikimediaRes] = await Promise.all([
        searchGoogle(enhancedQ, 10),
        searchOpenverse(enhancedQ, 6),
        searchWikipedia(enhancedQ),
        searchWikimedia(enhancedQ),
    ]);

    const allResults = [...googleRes, ...openverseRes, ...wikiRes, ...wikimediaRes];
    console.log(`[ImageSearch] Total kandidat fallback: ${allResults.length}`);

    if (allResults.length > 0) {
        const found = await tryDownloadOne(allResults);
        if (found) {
            console.log(`[ImageSearch] ✅ Fallback berhasil: ${found.url}`);
            return found;
        }
    }

    // Coba ulang dengan query asli (jika berbeda dari enhanced)
    if (enhancedQ !== q) {
        console.log(`[ImageSearch] Coba ulang dengan query asli: "${q}"`);
        const ddgRes2 = await searchDuckDuckGo(q, 10);
        const found2 = await tryDownloadOne(ddgRes2);
        if (found2) {
            console.log(`[ImageSearch] ✅ DDG (asli) berhasil: ${found2.url}`);
            return found2;
        }
        const bingRes2 = await searchBing(q, 10);
        const found3 = await tryDownloadOne(bingRes2);
        if (found3) {
            console.log(`[ImageSearch] ✅ Bing (asli) berhasil: ${found3.url}`);
            return found3;
        }
    }

    console.error(`[ImageSearch] ❌ Semua sumber gagal untuk query: "${enhancedQ}"`);
    throw new Error('Semua sumber gambar gagal. Coba kata kunci yang lebih spesifik ya!');
}

// ── Cari N gambar sekaligus ──
export async function searchAndGetImages(query, count = 1) {
    if (count <= 1) {
        const single = await searchAndGetImage(query);
        return [single];
    }

    const q = normalizeQuery(query);
    const enhancedQ = await enhanceQueryWithGemmy(q);
    console.log(`[ImageSearch] Cari ${count} gambar: "${enhancedQ}"`);

    // Ambil dari semua sumber paralel sekaligus untuk multi-image
    const [ddgRes, bingRes, googleRes, openverseRes, wikiRes, wikimediaRes] = await Promise.all([
        searchDuckDuckGo(enhancedQ, count * 5),
        searchBing(enhancedQ, count * 4),
        searchGoogle(enhancedQ, count * 3),
        searchOpenverse(enhancedQ, count * 2),
        searchWikipedia(enhancedQ),
        searchWikimedia(enhancedQ),
    ]);

    // DDG dan Bing di depan karena paling akurat
    const allResults = [...ddgRes, ...bingRes, ...googleRes, ...openverseRes, ...wikiRes, ...wikimediaRes];
    console.log(`[ImageSearch] Total kandidat (multi): ${allResults.length}`);

    if (allResults.length === 0) {
        throw new Error('Tidak ada hasil gambar ditemukan. Coba kata kunci lain ya!');
    }

    const found = await tryDownloadMany(allResults, count);
    if (found.length === 0) {
        throw new Error('Gagal download gambar. Coba kata kunci lain ya!');
    }

    console.log(`[ImageSearch] ✅ Berhasil ${found.length}/${count} gambar untuk: "${enhancedQ}"`);
    return found;
}

// ── Parse marker [GAMBAR: query] dari teks AI ──
// ── Kata kunci yang menandakan AI pakai [GAMBAR:] untuk reaksi/emosi sendiri
// Marker ini harus diblokir — reaksi emosi harus pakai [REPLY-STIKER:] bukan [GAMBAR:]
const REACTION_IMAGE_BLOCKLIST = [
    'reaction', 'meme', 'anime girl', 'manga', 'manga panel', 'comic panel',
    'gak peduli', 'tidak peduli', 'confused', 'confused anime', 'angry anime',
    'sad anime', 'happy anime', 'anime reaction', 'anime expression',
    'chibi reaction', 'blush anime', 'surprised anime', 'blushing',
    'smug anime', 'pout', 'pouting', 'facepalm', 'frustrated anime',
    'embarrassed anime', 'shocked anime', 'crying anime', 'laughing anime',
    'nervous anime', 'scared anime', 'disgusted anime', 'tired anime',
    'annoyed anime', 'thinking anime', 'skeptical anime', 'cute reaction',
    'kawaii reaction', 'anime meme', 'sticker', 'expression anime',
    'character reaction', 'light novel reaction', 'manga reaction',
    'apa coba', 'apaan', 'reaction image', 'emote', 'emoticon anime',
    'anime face', 'chibi expression', 'chibi emotion', 'waifu reaction',
];

function isReactionImageQuery(query) {
    const lower = query.toLowerCase().trim();
    return REACTION_IMAGE_BLOCKLIST.some(kw => lower.includes(kw));
}

export async function extractImagesFromText(text) {
    const images = [];
    let cleanText = text;

    // Tahap 1: marker [GAMBAR: query]
    const markerRegex = /\[GAMBAR:\s*([^\]]{1,200})\]/gi;
    const markerMatches = [...text.matchAll(markerRegex)];

    if (markerMatches.length > 0) {
        for (const match of markerMatches) {
            const fullMarker = match[0];
            const query = match[1].trim();
            cleanText = cleanText.split(fullMarker).join('');

            // ── Blokir kalau query adalah reaksi/emosi — harus pakai [REPLY-STIKER:] ──
            if (isReactionImageQuery(query)) {
                imageSearchLog(`[ImgMarker] 🚫 Query reaksi diblokir (gunakan REPLY-STIKER): "${query}"`);
                continue;
            }

            try {
                const found = await searchAndGetImage(query);
                if (found) {
                    images.push({ buffer: found.buffer, url: found.url, query });
                    imageSearchLog(`[ImgMarker] ✅ "${query}" → ${found.url}`);
                }
            } catch (e) {
                imageSearchError(`[ImgMarker] ❌ Gagal cari gambar untuk "${query}": ${e.message}`);
            }
        }
    }

    // Tahap 2: fallback URL gambar langsung di teks
    // ── Hapus marker REPLY-STIKER / STIKER dulu biar URL .webp di dalamnya
    //    tidak ikut kena tangkap regex gambar di bawah ini ──
    const stickerMarkerRegex = /\[(?:REPLY-STIKER|REPLY-STICKER|STIKER|STICKER):\s*[^\]]{1,400}\]/gi;
    const textForUrlScan = cleanText.replace(stickerMarkerRegex, '');

    const imgUrlRegex = /https?:\/\/[^\s"'<>\)\]]+\.(?:jpg|jpeg|png|webp|gif)(?:\?[^\s"'<>\)\]]*)?/gi;
    const urlMatches = [...textForUrlScan.matchAll(imgUrlRegex)];

    if (urlMatches.length > 0) {
        const urlsToRemove = new Set(urlMatches.map(m => m[0]));
        for (const url of urlsToRemove) {
            cleanText = cleanText.split(url).join('');
            try {
                const buf = await downloadImageBuffer(url, 10000);
                if (buf && buf.length > 5000) {
                    images.push({ buffer: buf, url });
                    imageSearchLog(`[ImgURL] ✅ Download dari URL: ${url}`);
                }
            } catch (e) {
                imageSearchError(`[ImgURL] ❌ Gagal download: ${url} — ${e.message}`);
            }
        }
    }

    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    return { cleanText, images };
}

export { downloadImageBuffer };
