/**
 * ───────────────────────────────────────────────────────────
 *  AI TOOLS — extra capabilities buat Wily AI
 *  Pola sama kayak [GAMBAR:...] di imageSearch.js: AI nulis
 *  marker di response, handler nge-extract & kirim media.
 *
 *  Marker yang didukung:
 *    [VN: teks]                  → voice note bahasa Indonesia
 *    [VN-JP: teks]               → voice note bahasa Jepang (kawaii)
 *    [VN-EN: teks]               → voice note bahasa Inggris
 *    [VN-XX: teks]               → kode bahasa lain (es, fr, ko, zh, dll)
 *    [STIKER: query]             → sticker WhatsApp (search img → webp)
 *    [LAGU: judul lagu]          → audio mp3 dari YouTube (search by title)
 *    [VIDEO: judul/URL]          → video mp4 dari YouTube / URL langsung
 *    [TT: url]                   → download TikTok video/slideshow
 *    [IG: url]                   → download Instagram reel/post/story
 *    [YTMP3: url]                → download audio MP3 dari YouTube URL
 *
 *  [GAMBAR:...] tetap di imageSearch.js (legacy).
 * ───────────────────────────────────────────────────────────
 */

import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { searchAndGetImage } from './imageSearch.js';
import { isValidStickerUrl, selectStickerByMood } from './stickerMap.js';
import { logStickerSent } from './aiStickerStory.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TMP_DIR = path.join(process.cwd(), 'tmp');
const BIN_DIR = path.join(process.cwd(), 'bin');

function ensureTmp() {
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

const aiToolsLog = (...args) => {
    if (typeof globalThis.wilyLog === 'function') globalThis.wilyLog(...args);
    else console.log(...args);
};

const aiToolsError = (...args) => {
    if (typeof globalThis.wilyError === 'function') globalThis.wilyError(...args);
    else console.error(...args);
};

// ════════════════════════════════════════════════════════════
//  EDGE NEURAL TTS  (free, no API key — Microsoft Azure voices)
//  Suaranya jauh lebih natural dibanding Google Translate TTS.
//  Voice mapping per bahasa di EDGE_VOICES.
//  Fallback otomatis ke Google TTS kalau Edge gagal.
// ════════════════════════════════════════════════════════════

// Voice + prosody preset per bahasa.
// Indonesia → suara cewek muda natural (Gadis).
// Jepang   → cewek kawaii (Nanami) + pitch tinggi & rate cepat ala
//            karakter Honolulu dari Azur Lane.
const EDGE_VOICES = {
    'id':    { voice: 'id-ID-GadisNeural',  pitch: '+0Hz',  rate: '+0%' },
    'ja':    { voice: 'ja-JP-NanamiNeural', pitch: '+25Hz', rate: '+8%' }, // Honolulu kawaii
    'en':    { voice: 'en-US-JennyNeural',  pitch: '+0Hz',  rate: '+0%' },
    'ko':    { voice: 'ko-KR-SunHiNeural',  pitch: '+0Hz',  rate: '+0%' },
    'zh-CN': { voice: 'zh-CN-XiaoxiaoNeural', pitch: '+0Hz', rate: '+0%' },
    'zh-TW': { voice: 'zh-TW-HsiaoChenNeural', pitch: '+0Hz', rate: '+0%' },
    'ar':    { voice: 'ar-SA-ZariyahNeural', pitch: '+0Hz', rate: '+0%' },
    'es':    { voice: 'es-ES-ElviraNeural', pitch: '+0Hz',  rate: '+0%' },
    'fr':    { voice: 'fr-FR-DeniseNeural', pitch: '+0Hz',  rate: '+0%' },
    'de':    { voice: 'de-DE-KatjaNeural',  pitch: '+0Hz',  rate: '+0%' },
    'it':    { voice: 'it-IT-ElsaNeural',   pitch: '+0Hz',  rate: '+0%' },
    'pt':    { voice: 'pt-BR-FranciscaNeural', pitch: '+0Hz', rate: '+0%' },
    'ru':    { voice: 'ru-RU-SvetlanaNeural', pitch: '+0Hz', rate: '+0%' },
    'tr':    { voice: 'tr-TR-EmelNeural',   pitch: '+0Hz',  rate: '+0%' },
    'th':    { voice: 'th-TH-PremwadeeNeural', pitch: '+0Hz', rate: '+0%' },
    'vi':    { voice: 'vi-VN-HoaiMyNeural', pitch: '+0Hz',  rate: '+0%' },
    'hi':    { voice: 'hi-IN-SwaraNeural',  pitch: '+0Hz',  rate: '+0%' },
    'jw':    { voice: 'id-ID-GadisNeural',  pitch: '+0Hz',  rate: '+0%' }, // Jawa pakai voice ID
    'su':    { voice: 'id-ID-GadisNeural',  pitch: '+0Hz',  rate: '+0%' }, // Sunda pakai voice ID
};

const EDGE_OUTPUT_FORMAT = 'audio-24khz-48kbitrate-mono-mp3';

/**
 * Generate voice note pakai Microsoft Edge Neural TTS (gratis, no API key).
 * Suara cewek natural ala asli, bukan robot.
 * @param {string} text - Teks yang diucapkan.
 * @param {string} lang - Kode bahasa: 'id', 'ja', 'en', dll.
 * @returns {Promise<Buffer>} Buffer mp3.
 */
export async function edgeTTS(text, lang = 'id') {
    const cleanText = String(text || '').replace(/[\[\]]/g, '').trim();
    if (!cleanText) throw new Error('Teks TTS kosong');
    if (cleanText.length > 3000) {
        throw new Error('Teks TTS terlalu panjang (max 3000 karakter)');
    }

    const preset = EDGE_VOICES[lang] || EDGE_VOICES['id'];
    const { MsEdgeTTS } = await import('msedge-tts');
    const tts = new MsEdgeTTS();
    await tts.setMetadata(preset.voice, EDGE_OUTPUT_FORMAT);

    const { audioStream } = await tts.toStream(cleanText, {
        pitch: preset.pitch,
        rate: preset.rate,
    });

    return new Promise((resolve, reject) => {
        const chunks = [];
        const timer = setTimeout(() => {
            try { audioStream.destroy?.(); } catch (_) {}
            reject(new Error('Edge TTS timeout (>30s)'));
        }, 30000);
        audioStream.on('data', c => chunks.push(c));
        audioStream.on('end', () => {
            clearTimeout(timer);
            const buf = Buffer.concat(chunks);
            if (buf.length < 100) {
                return reject(new Error('Edge TTS response kosong (voice mungkin tidak support)'));
            }
            resolve(buf);
        });
        audioStream.on('error', e => {
            clearTimeout(timer);
            reject(new Error(`Edge TTS stream error: ${e.message}`));
        });
    });
}

// ════════════════════════════════════════════════════════════
//  GOOGLE TTS  (fallback — free, no API key, suara kurang natural)
// ════════════════════════════════════════════════════════════

const TTS_MAX_CHUNK = 190; // safe limit per request
const TTS_BASE = 'https://translate.google.com/translate_tts';

// Split teks panjang jadi chunk per ~190 char tanpa motong kata.
function chunkText(text, max = TTS_MAX_CHUNK) {
    const chunks = [];
    let remaining = String(text || '').trim();
    while (remaining.length > 0) {
        if (remaining.length <= max) {
            chunks.push(remaining);
            break;
        }
        // Cari titik/koma/spasi sebelum batas max
        let cut = -1;
        for (let i = max; i > Math.floor(max * 0.5); i--) {
            const ch = remaining[i];
            if (ch === '.' || ch === '!' || ch === '?' || ch === ',' || ch === ';' || ch === '\n') {
                cut = i + 1; break;
            }
        }
        if (cut < 0) {
            for (let i = max; i > Math.floor(max * 0.5); i--) {
                if (remaining[i] === ' ') { cut = i; break; }
            }
        }
        if (cut < 0) cut = max;
        chunks.push(remaining.slice(0, cut).trim());
        remaining = remaining.slice(cut).trim();
    }
    return chunks.filter(c => c.length > 0);
}

/**
 * Generate voice note dari teks pakai Google TTS (gratis, tanpa API key).
 * @param {string} text - Teks yang diucapkan (max ~3000 karakter total).
 * @param {string} lang - Kode bahasa: 'id' (Indonesia), 'en' (English), dll.
 * @returns {Promise<Buffer>} Buffer mp3.
 */
export async function googleTTS(text, lang = 'id') {
    const cleanText = String(text || '').replace(/[\[\]]/g, '').trim();
    if (!cleanText) throw new Error('Teks TTS kosong');
    if (cleanText.length > 3000) {
        throw new Error('Teks TTS terlalu panjang (max 3000 karakter)');
    }

    const chunks = chunkText(cleanText);
    const buffers = [];

    for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const params = new URLSearchParams({
            ie: 'UTF-8',
            q: chunk,
            tl: lang,
            client: 'tw-ob',
            ttsspeed: '1',
            total: String(chunks.length),
            idx: String(i),
            textlen: String(chunk.length),
        });

        const url = `${TTS_BASE}?${params.toString()}`;
        try {
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36',
                    'Referer': 'https://translate.google.com/',
                    'Accept': 'audio/mpeg, */*',
                    'Accept-Language': lang === 'id' ? 'id-ID,id;q=0.9,en;q=0.8' : 'en-US,en;q=0.9',
                },
            });
            if (!res.data || res.data.length < 100) {
                throw new Error('TTS response kosong/terlalu kecil');
            }
            buffers.push(Buffer.from(res.data));
        } catch (e) {
            const status = e.response?.status;
            throw new Error(`Google TTS gagal (chunk ${i + 1}/${chunks.length}, status ${status || '?'}): ${e.message}`);
        }
    }

    return Buffer.concat(buffers);
}

// ════════════════════════════════════════════════════════════
//  YT-DLP HELPERS  (audio & video download dari YouTube)
// ════════════════════════════════════════════════════════════

function getYtdlpBin() {
    return path.join(BIN_DIR, 'yt-dlp');
}

// Cek aja, asumsi binary udah disiapkan oleh ensureYtdlp() di message.js.
function assertYtdlpReady() {
    const bin = getYtdlpBin();
    if (!fs.existsSync(bin)) {
        throw new Error('yt-dlp binary belum tersedia. Pastikan ensureYtdlp() dipanggil dulu.');
    }
    return bin;
}

function execAsync(cmd, opts = {}) {
    return new Promise((resolve, reject) => {
        exec(cmd, { timeout: 120000, ...opts }, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message));
            resolve({ stdout, stderr });
        });
    });
}

/**
 * Search YouTube + download audio mp3 dalam 1 panggilan.
 * @param {string} query - Judul lagu untuk dicari.
 * @param {object} opts - { maxDuration: 600 (detik), ytdlpBin?: string }
 * @returns {Promise<{buffer: Buffer, title: string, channel: string, duration: number, url: string}>}
 */
export async function searchAndDownloadAudio(query, opts = {}) {
    ensureTmp();
    const maxDuration = opts.maxDuration || 600; // 10 menit
    const ytdlpBin = opts.ytdlpBin || assertYtdlpReady();

    if (!query || !query.trim()) throw new Error('Query lagu kosong');

    // Step 1: Search
    const yts = (await import('yt-search')).default;
    const searchResult = await yts(query.trim());
    const video = searchResult?.videos?.[0];
    if (!video) throw new Error(`Lagu "${query}" tidak ditemukan di YouTube`);
    if (video.seconds > maxDuration) {
        throw new Error(`Durasi terlalu panjang (${video.duration?.timestamp}), max ${Math.floor(maxDuration / 60)} menit`);
    }

    aiToolsLog(`[AITool/LAGU] 🔎 "${query}" → "${video.title}" (${video.duration?.timestamp})`);

    // Step 2: Download via yt-dlp
    const tmpId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const outFile = path.join(TMP_DIR, `ai_audio_${tmpId}.mp3`);
    const outTemplate = path.join(TMP_DIR, `ai_audio_${tmpId}.%(ext)s`);

    const cmd = `"${ytdlpBin}" --js-runtimes node --no-playlist -x --audio-format mp3 --audio-quality 5 -o "${outTemplate}" "${video.url}"`;
    try {
        await execAsync(cmd, { timeout: 120000 });
    } catch (e) {
        try { fs.unlinkSync(outFile); } catch (_) {}
        throw new Error(`Download audio gagal: ${e.message.split('\n')[0]}`);
    }

    if (!fs.existsSync(outFile)) {
        throw new Error('File audio gak ke-generate sama yt-dlp');
    }

    const buffer = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch (_) {}

    aiToolsLog(`[AITool/LAGU] ✅ "${video.title}" — ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

    return {
        buffer,
        title: video.title,
        channel: video.author?.name || 'Unknown',
        duration: video.seconds,
        url: video.url,
    };
}

// Domain yang bisa langsung di-download yt-dlp tanpa search YouTube
const DIRECT_DL_DOMAINS = [
    'tiktok.com', 'vm.tiktok.com', 'vt.tiktok.com',
    'instagram.com', 'instagr.am',
    'youtube.com', 'youtu.be', 'm.youtube.com',
    'twitter.com', 'x.com', 't.co',
    'facebook.com', 'fb.watch', 'fb.com',
    'pinterest.com', 'pin.it',
    'reddit.com', 'redd.it',
    'capcut.com', 'likee.video',
];

function isDirectUrl(query) {
    try {
        if (!/^https?:\/\//i.test(query.trim())) return false;
        const hostname = new URL(query.trim()).hostname.replace(/^www\./, '');
        return DIRECT_DL_DOMAINS.some(d => hostname === d || hostname.endsWith('.' + d));
    } catch { return false; }
}

/**
 * Download video dari URL langsung (TikTok, IG, YT, dsb) via yt-dlp.
 */
async function downloadDirectUrl(url, ytdlpBin) {
    ensureTmp();
    const tmpId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const outFile     = path.join(TMP_DIR, `ai_video_${tmpId}.mp4`);
    const outTemplate = path.join(TMP_DIR, `ai_video_${tmpId}.%(ext)s`);

    // Deteksi apakah URL adalah TikTok (butuh handling khusus)
    const isTikTok = /tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/i.test(url);
    
    // Ambil metadata dulu (title, duration) pakai -j
    let title = 'Video', channel = 'Unknown', duration = 0;
    try {
        let metaCmd = `"${ytdlpBin}" --js-runtimes node --no-playlist -j `;
        if (isTikTok) {
            // TikTok butuh User-Agent browser yang proper
            metaCmd += `--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" `;
        }
        metaCmd += `"${url}"`;
        
        const { stdout } = await execAsync(metaCmd, { timeout: 30000 });
        const meta = JSON.parse(stdout.trim().split('\n')[0]);
        title    = meta.title    || meta.description?.slice(0, 80) || 'Video';
        channel  = meta.uploader || meta.channel || meta.creator   || 'Unknown';
        duration = meta.duration || 0;
    } catch (_) { /* metadata optional */ }

    aiToolsLog(`[AITool/VIDEO] 📥 Direct URL → "${title}" (${Math.round(duration)}s)`);

    // Download dengan format yang sesuai
    let cmd = `"${ytdlpBin}" --js-runtimes node --no-playlist `;
    
    if (isTikTok) {
        // TikTok: pakai User-Agent browser, ekstraksi aggressive
        cmd += `--user-agent "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" ` +
               `--extractor-args tiktok:api_hostname=api16-normal-c.tiktokv.com ` +
               `-f "best[ext=mp4]/best" `;
    } else {
        // Untuk platform lain (IG, YT, FB, dll): format fleksibel
        cmd += `-f "bestvideo[height<=720]+bestaudio/best[height<=720]/best" `;
    }
    
    cmd += `--merge-output-format mp4 ` +
           `--postprocessor-args "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart -preset fast -crf 28" ` +
           `-o "${outTemplate}" "${url}"`;

    try {
        await execAsync(cmd, { timeout: 180000 });
    } catch (e) {
        try { fs.unlinkSync(outFile); } catch (_) {}
        throw new Error(`Download gagal: ${e.message.split('\n')[0].slice(0, 120)}`);
    }

    if (!fs.existsSync(outFile)) throw new Error('File video tidak terbuat oleh yt-dlp');

    const buffer = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch (_) {}

    aiToolsLog(`[AITool/VIDEO] ✅ "${title}" — ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    return { buffer, title, channel, duration, url };
}

/**
 * Search YouTube + download video mp4 (360p, max 3 menit default).
 * Jika query adalah URL langsung (TikTok/IG/YT/dll) → download langsung via yt-dlp.
 * @param {string} query  - judul video ATAU URL langsung
 * @param {object} opts   - { maxDuration: 180, ytdlpBin?: string }
 */
export async function searchAndDownloadVideo(query, opts = {}) {
    ensureTmp();
    const maxDuration = opts.maxDuration || 180;
    const ytdlpBin = opts.ytdlpBin || assertYtdlpReady();

    if (!query || !query.trim()) throw new Error('Query video kosong');

    // ── URL langsung (TikTok, Instagram, YouTube, dll) → bypass YouTube search
    if (isDirectUrl(query.trim())) {
        return downloadDirectUrl(query.trim(), ytdlpBin);
    }

    // ── Judul/kata kunci → search YouTube dulu
    const yts = (await import('yt-search')).default;
    const searchResult = await yts(query.trim());
    const video = searchResult?.videos?.[0];
    if (!video) throw new Error(`Video "${query}" tidak ditemukan di YouTube`);
    if (video.seconds > maxDuration) {
        throw new Error(`Durasi video terlalu panjang (${video.duration?.timestamp}), max ${Math.floor(maxDuration / 60)} menit`);
    }

    aiToolsLog(`[AITool/VIDEO] 🔎 "${query}" → "${video.title}" (${video.duration?.timestamp})`);

    const tmpId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const outFile     = path.join(TMP_DIR, `ai_video_${tmpId}.mp4`);
    const outTemplate = path.join(TMP_DIR, `ai_video_${tmpId}.%(ext)s`);

    const cmd = `"${ytdlpBin}" --js-runtimes node --no-playlist ` +
        `-f "bestvideo[height<=360]+bestaudio/best[height<=360]" ` +
        `--merge-output-format mp4 ` +
        `--postprocessor-args "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart -preset fast -crf 28" ` +
        `-o "${outTemplate}" "${video.url}"`;

    try {
        await execAsync(cmd, { timeout: 180000 });
    } catch (e) {
        try { fs.unlinkSync(outFile); } catch (_) {}
        throw new Error(`Download video gagal: ${e.message.split('\n')[0]}`);
    }

    if (!fs.existsSync(outFile)) throw new Error('File video gak ke-generate sama yt-dlp');

    const buffer = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch (_) {}

    aiToolsLog(`[AITool/VIDEO] ✅ "${video.title}" — ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);

    return {
        buffer,
        title: video.title,
        channel: video.author?.name || 'Unknown',
        duration: video.seconds,
        url: video.url,
        thumb: video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`,
    };
}

// ════════════════════════════════════════════════════════════
//  EXTRACTORS  (parse marker dari response AI)
// ════════════════════════════════════════════════════════════

// Mapping kode marker → kode bahasa Google TTS.
// Sengaja flexible: JP/JA → ja, EN/US/GB → en, ID → id, dst.
const VN_LANG_MAP = {
    'ID': 'id', 'IND': 'id', 'IN': 'id',
    'JP': 'ja', 'JA': 'ja', 'JPN': 'ja',
    'EN': 'en', 'US': 'en', 'GB': 'en', 'UK': 'en', 'ENG': 'en',
    'KR': 'ko', 'KO': 'ko', 'KOR': 'ko',
    'CN': 'zh-CN', 'ZH': 'zh-CN', 'CHN': 'zh-CN',
    'TW': 'zh-TW',
    'JV': 'jw', 'SU': 'su',
    'AR': 'ar', 'ARB': 'ar',
    'ES': 'es', 'FR': 'fr', 'DE': 'de', 'IT': 'it',
    'PT': 'pt', 'NL': 'nl', 'RU': 'ru', 'TR': 'tr',
    'TH': 'th', 'VI': 'vi', 'HI': 'hi',
};

function resolveVnLang(code) {
    if (!code) return 'id';
    const upper = String(code).toUpperCase().trim();
    return VN_LANG_MAP[upper] || code.toLowerCase();
}

/**
 * Parse [VN: ...] / [VN-JP: ...] / [VN-EN: ...] dll dari response AI,
 * generate voice note pakai Google TTS sesuai bahasa yang dipilih.
 * @returns {Promise<{cleanText: string, voiceNotes: Array<{buffer, text, lang}>}>}
 */
export async function extractVoiceNotesFromText(text) {
    const voiceNotes = [];
    let cleanText = String(text || '');

    // Group 1: opsional kode bahasa setelah dash (JP, EN, KR, dll)
    // Group 2: isi teks
    const regex = /\[VN(?:-([A-Za-z]{2,4}))?:\s*([^\]]{1,500})\]/gi;
    const matches = [...cleanText.matchAll(regex)];

    for (const match of matches) {
        const fullMarker = match[0];
        const langCode = match[1];
        const vnText = match[2].trim();
        cleanText = cleanText.split(fullMarker).join('');

        if (!vnText) continue;
        const lang = resolveVnLang(langCode);
        let buffer = null;
        let engine = 'edge';
        try {
            buffer = await edgeTTS(vnText, lang);
        } catch (edgeErr) {
            aiToolsError(`[AITool/VN] ⚠️ Edge TTS gagal [${lang}], fallback ke Google: ${edgeErr.message}`);
            engine = 'google';
            try {
                buffer = await googleTTS(vnText, lang);
            } catch (googleErr) {
                aiToolsError(`[AITool/VN] ❌ Semua TTS gagal [${lang}] untuk "${vnText.slice(0, 40)}...": ${googleErr.message}`);
                continue;
            }
        }
        voiceNotes.push({ buffer, text: vnText, lang, engine });
        aiToolsLog(`[AITool/VN] ✅ [${engine}/${lang}] "${vnText.slice(0, 50)}..." (${(buffer.length / 1024).toFixed(1)} KB)`);
    }

    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    return { cleanText, voiceNotes };
}

// ════════════════════════════════════════════════════════════
//  STIKER  (search image → konversi ke webp sticker WhatsApp)
// ════════════════════════════════════════════════════════════

/**
 * Parse [STIKER: query] / [STICKER: query] dari response AI.
 * Cari gambar via imageSearch, lalu konversi ke webp sticker.
 * @param {string} text
 * @param {object} opts - { pack?: string, author?: string }
 * @returns {Promise<{cleanText: string, stickers: Array<{buffer, query}>}>}
 */
export async function extractStickersFromText(text, opts = {}) {
    const stickers = [];
    let cleanText = String(text || '');

    const regex = /\[(?:STIKER|STICKER):\s*([^\]]{1,200})\]/gi;
    const matches = [...cleanText.matchAll(regex)];

    if (matches.length === 0) {
        return { cleanText, stickers };
    }

    let StickerCtor = null;
    let StickerTypesEnum = null;
    try {
        const mod = await import('wa-sticker-formatter');
        StickerCtor = mod.Sticker;
        StickerTypesEnum = mod.StickerTypes;
    } catch (e) {
        aiToolsError(`[AITool/STIKER] ❌ wa-sticker-formatter tidak tersedia: ${e.message}`);
        // Hapus marker biar gak nongol di teks final
        for (const match of matches) {
            cleanText = cleanText.split(match[0]).join('');
        }
        return { cleanText: cleanText.replace(/\n{3,}/g, '\n\n').trim(), stickers };
    }

    const packName = opts.pack || 'Wily Bot AI';
    const authorName = opts.author || 'Bang Wilykun';

    for (const match of matches) {
        const fullMarker = match[0];
        const query = match[1].trim();
        cleanText = cleanText.split(fullMarker).join('');

        if (!query) continue;
        try {
            const found = await searchAndGetImage(query);
            if (!found || !found.buffer) {
                aiToolsError(`[AITool/STIKER] ❌ Gambar tidak ketemu untuk "${query}"`);
                continue;
            }
            const sticker = new StickerCtor(found.buffer, {
                pack: packName,
                author: authorName,
                type: StickerTypesEnum.FULL,
                categories: ['🎭', '✨'],
                id: `wilyai.${Date.now()}`,
                quality: 70,
            });
            const buffer = await sticker.toBuffer();
            stickers.push({ buffer, query, sourceUrl: found.url });
            aiToolsLog(`[AITool/STIKER] ✅ "${query}" → ${(buffer.length / 1024).toFixed(1)} KB webp`);
        } catch (e) {
            aiToolsError(`[AITool/STIKER] ❌ Gagal generate sticker "${query}": ${e.message}`);
        }
    }

    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    return { cleanText, stickers };
}

/**
 * Parse [LAGU: ...] dari response AI, search YT + download audio.
 * @param {string} text
 * @param {object} opts - { ytdlpBin: string } — wajib di-pass dari handler
 * @returns {Promise<{cleanText: string, songs: Array}>}
 */
export async function extractSongsFromText(text, opts = {}) {
    const songs = [];
    let cleanText = String(text || '');

    const regex = /\[LAGU:\s*([^\]]{1,200})\]/gi;
    const matches = [...cleanText.matchAll(regex)];

    for (const match of matches) {
        const fullMarker = match[0];
        const query = match[1].trim();
        cleanText = cleanText.split(fullMarker).join('');

        if (!query) continue;
        try {
            const result = await searchAndDownloadAudio(query, opts);
            songs.push({ ...result, query });
        } catch (e) {
            aiToolsError(`[AITool/LAGU] ❌ Gagal cari/download lagu "${query}": ${e.message}`);
        }
    }

    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    return { cleanText, songs };
}

/**
 * Parse [VIDEO: ...] dari response AI, search YT + download video mp4.
 * @param {string} text
 * @param {object} opts - { ytdlpBin: string } — wajib di-pass dari handler
 * @returns {Promise<{cleanText: string, videos: Array}>}
 */
export async function extractVideosFromText(text, opts = {}) {
    const videos = [];
    let cleanText = String(text || '');

    const regex = /\[VIDEO:\s*([^\]]{1,200})\]/gi;
    const matches = [...cleanText.matchAll(regex)];

    for (const match of matches) {
        const fullMarker = match[0];
        const query = match[1].trim();
        cleanText = cleanText.split(fullMarker).join('');

        if (!query) continue;
        try {
            const result = await searchAndDownloadVideo(query, opts);
            videos.push({ ...result, query });
        } catch (e) {
            aiToolsError(`[AITool/VIDEO] ❌ Gagal cari/download video "${query}": ${e.message}`);
        }
    }

    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    return { cleanText, videos };
}

/**
 * Helper: cek apakah teks mengandung marker yang butuh yt-dlp (LAGU/VIDEO/YTMP3).
 */
export function hasMediaDownloadMarker(text) {
    return /\[LAGU:\s*[^\]]+\]/i.test(text)
        || /\[VIDEO:\s*[^\]]+\]/i.test(text)
        || /\[YTMP3:\s*[^\]]+\]/i.test(text);
}

/**
 * Helper: cek apakah teks mengandung marker sosmed download (TT/IG).
 */
export function hasSocialDLMarker(text) {
    return /\[TT:\s*[^\]]+\]/i.test(text) || /\[IG:\s*[^\]]+\]/i.test(text);
}

/**
 * Helper: cek apakah teks mengandung marker STIKER atau REPLY-STIKER.
 */
export function hasStickerMarker(text) {
    return /\[(?:STIKER|STICKER|REPLY-STIKER|REPLY-STICKER):\s*[^\]]+\]/i.test(text);
}

// ════════════════════════════════════════════════════════════
//  TIKTOK DOWNLOADER
//  Marker: [TT: url]
//  Pakai @tobyg74/tiktok-api-dl, coba v3→v2→v1
//  Return: { videoUrl, images, author, desc, url }
// ════════════════════════════════════════════════════════════

/**
 * Download TikTok video/slideshow dari URL.
 * @param {string} url - URL TikTok (vm.tiktok.com / vt.tiktok.com / www.tiktok.com)
 * @returns {Promise<{videoUrl: string|null, images: string[], author: string, desc: string, url: string}>}
 */
export async function downloadTikTok(url) {
    const { Downloader } = await import('@tobyg74/tiktok-api-dl');

    let result = null;
    for (const version of ['v3', 'v2', 'v1']) {
        try {
            const res = await Downloader(url, { version });
            if (res?.status === 'success' && res.result) { result = res; break; }
        } catch (_) {}
    }
    if (!result) throw new Error('Gagal download TikTok: semua versi API gagal');

    const data = result.result;
    const author = data.author || {};
    const desc   = data.description || data.desc || '';

    const pickUrl = (val) => {
        if (!val) return null;
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) return val[0] || null;
        return null;
    };

    let videoUrl = pickUrl(data.videoHD) || pickUrl(data.videoSD) || pickUrl(data.videoWatermark);
    if (!videoUrl && data.video) {
        if (typeof data.video === 'string') videoUrl = data.video;
        else if (Array.isArray(data.video)) videoUrl = data.video[0];
        else videoUrl = pickUrl(data.video.playAddr) || pickUrl(data.video.downloadAddr) || pickUrl(data.video.noWatermark);
    }

    const images = (data.images || data.image || []).map(img => pickUrl(img) || img).filter(Boolean);

    aiToolsLog(`[AITool/TT] ✅ @${author.nickname || author.unique_id || 'unknown'} — ${videoUrl ? 'video' : images.length + ' gambar'}`);

    return {
        videoUrl: videoUrl || null,
        images,
        author: author.nickname || author.username || author.unique_id || 'Unknown',
        desc,
        url,
    };
}

/**
 * Parse [TT: url] dari response AI, download TikTok.
 * @returns {Promise<{cleanText: string, tikToks: Array}>}
 */
export async function extractTikTokFromText(text) {
    const tikToks = [];
    let cleanText = String(text || '');

    const regex = /\[TT:\s*(https?:\/\/[^\]]{5,300})\]/gi;
    const matches = [...cleanText.matchAll(regex)];

    for (const match of matches) {
        const fullMarker = match[0];
        const url = match[1].trim();
        cleanText = cleanText.split(fullMarker).join('');
        if (!url) continue;
        try {
            const result = await downloadTikTok(url);
            tikToks.push({ ...result, query: url });
        } catch (e) {
            aiToolsError(`[AITool/TT] ❌ Gagal download "${url}": ${e.message}`);
        }
    }

    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    return { cleanText, tikToks };
}

// ════════════════════════════════════════════════════════════
//  INSTAGRAM DOWNLOADER
//  Marker: [IG: url]
//  Pakai multiple API fallbacks (archive.lick, cenedril, agatz)
//  Return: { mediaItems: [{url, isVideo}], caption, username, url }
// ════════════════════════════════════════════════════════════

/**
 * Download Instagram reel/post/story dari URL.
 * @param {string} url - URL Instagram post/reel/story
 * @returns {Promise<{mediaItems: Array<{url: string, isVideo: boolean}>, caption: string, username: string, url: string}>}
 */
export async function downloadInstagram(url) {
    let igUrl = url;
    try {
        const parsed = new URL(url);
        igUrl = parsed.origin + parsed.pathname.replace(/\/$/, '') + '/';
    } catch (_) {}

    const apis = [
        `https://archive.lick.eu.org/api/download/instagram?url=${encodeURIComponent(igUrl)}`,
        `https://api.cenedril.net/api/dl/ig?url=${encodeURIComponent(igUrl)}`,
        `https://api.agatz.xyz/api/instagram?url=${encodeURIComponent(igUrl)}`,
    ];

    let data = null;
    for (const apiUrl of apis) {
        try {
            const res = await axios.get(apiUrl, { timeout: 12000 });
            if (res.data?.status && res.data?.result) { data = res.data; break; }
        } catch (_) {}
    }
    if (!data) throw new Error('Gagal download Instagram: semua API gagal');

    const result  = data.result;
    const rawUrls = result.url || [];
    const caption  = result.caption || '';
    const username = result.username || 'Unknown';
    const isVideoGlobal = result.isVideo;

    const mediaItems = rawUrls.map(item => {
        const mediaUrl = typeof item === 'object' ? (item.url || item.src || String(item)) : String(item);
        let isVideo = isVideoGlobal;
        if (typeof item === 'object' && item.type) {
            isVideo = item.type === 'video' || item.type === 'GraphVideo';
        } else {
            const u = mediaUrl.toLowerCase().split('?')[0];
            if (u.endsWith('.mp4') || u.endsWith('.mov') || u.endsWith('.webm')) isVideo = true;
            else if (u.endsWith('.jpg') || u.endsWith('.jpeg') || u.endsWith('.png') || u.endsWith('.webp')) isVideo = false;
        }
        return { url: mediaUrl, isVideo };
    }).filter(it => it.url);

    if (mediaItems.length === 0) throw new Error('Media tidak ditemukan dari Instagram');

    aiToolsLog(`[AITool/IG] ✅ @${username} — ${mediaItems.length} media`);
    return { mediaItems, caption, username, url };
}

/**
 * Parse [IG: url] dari response AI, download Instagram.
 * @returns {Promise<{cleanText: string, instagrams: Array}>}
 */
export async function extractInstagramFromText(text) {
    const instagrams = [];
    let cleanText = String(text || '');

    const regex = /\[IG:\s*(https?:\/\/[^\]]{5,300})\]/gi;
    const matches = [...cleanText.matchAll(regex)];

    for (const match of matches) {
        const fullMarker = match[0];
        const url = match[1].trim();
        cleanText = cleanText.split(fullMarker).join('');
        if (!url) continue;
        try {
            const result = await downloadInstagram(url);
            instagrams.push({ ...result, query: url });
        } catch (e) {
            aiToolsError(`[AITool/IG] ❌ Gagal download "${url}": ${e.message}`);
        }
    }

    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    return { cleanText, instagrams };
}

// ════════════════════════════════════════════════════════════
//  YOUTUBE MP3 FROM URL
//  Marker: [YTMP3: url]
//  Pakai yt-dlp, download audio langsung dari YouTube URL
//  Return: { buffer, title, channel, duration, url }
// ════════════════════════════════════════════════════════════

/**
 * Download audio MP3 dari YouTube URL langsung (bukan search).
 * @param {string} url - YouTube URL (youtube.com/watch atau youtu.be)
 * @param {string} ytdlpBin - path ke yt-dlp binary
 * @returns {Promise<{buffer: Buffer, title: string, channel: string, duration: number, url: string}>}
 */
export async function downloadYouTubeAudioFromUrl(url, ytdlpBin) {
    ensureTmp();
    ytdlpBin = ytdlpBin || assertYtdlpReady();

    // Ambil metadata
    let title = 'Audio', channel = 'Unknown', duration = 0;
    try {
        const { stdout } = await execAsync(
            `"${ytdlpBin}" --js-runtimes node --no-playlist --dump-json "${url}"`,
            { timeout: 30000 }
        );
        const meta = JSON.parse(stdout.trim());
        title    = meta.title    || 'Audio';
        channel  = meta.uploader || meta.channel || 'Unknown';
        duration = meta.duration || 0;
    } catch (e) {
        throw new Error(`Gagal ambil info YouTube: ${e.message.split('\n')[0].slice(0, 100)}`);
    }

    if (duration > 600) {
        throw new Error(`Durasi terlalu panjang (${Math.floor(duration / 60)} menit), max 10 menit`);
    }

    const tmpId      = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const outFile    = path.join(TMP_DIR, `ai_ytmp3_${tmpId}.mp3`);
    const outTemplate = path.join(TMP_DIR, `ai_ytmp3_${tmpId}.%(ext)s`);

    const cmd = `"${ytdlpBin}" --js-runtimes node --no-playlist -x --audio-format mp3 --audio-quality 5 -o "${outTemplate}" "${url}"`;

    try {
        await execAsync(cmd, { timeout: 120000 });
    } catch (e) {
        try { fs.unlinkSync(outFile); } catch (_) {}
        throw new Error(`Download audio gagal: ${e.message.split('\n')[0].slice(0, 100)}`);
    }

    if (!fs.existsSync(outFile)) throw new Error('File audio tidak terbuat oleh yt-dlp');

    const buffer = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch (_) {}

    aiToolsLog(`[AITool/YTMP3] ✅ "${title}" — ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
    return { buffer, title, channel, duration, url };
}

/**
 * Parse [YTMP3: url] dari response AI, download YouTube audio.
 * @returns {Promise<{cleanText: string, ytAudios: Array}>}
 */
export async function extractYouTubeAudioFromText(text, opts = {}) {
    const ytAudios = [];
    let cleanText = String(text || '');

    const regex = /\[YTMP3:\s*(https?:\/\/[^\]]{5,300})\]/gi;
    const matches = [...cleanText.matchAll(regex)];

    for (const match of matches) {
        const fullMarker = match[0];
        const url = match[1].trim();
        cleanText = cleanText.split(fullMarker).join('');
        if (!url) continue;
        // Validasi harus YouTube
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            aiToolsError(`[AITool/YTMP3] ❌ URL bukan YouTube: "${url}"`);
            continue;
        }
        try {
            const result = await downloadYouTubeAudioFromUrl(url, opts.ytdlpBin);
            ytAudios.push({ ...result, query: url });
        } catch (e) {
            aiToolsError(`[AITool/YTMP3] ❌ Gagal download "${url}": ${e.message}`);
        }
    }

    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    return { cleanText, ytAudios };
}

// ════════════════════════════════════════════════════════════
//  REPLY STICKER  — sticker reaksi karakter dari CDN
//  Marker: [REPLY-STIKER: URL]
//  Sumber: URL langsung dari daftar sticker di aiPrompt.js
//  Output: webp + EXIF metadata sticker WA via node-webpmux
// ════════════════════════════════════════════════════════════

/**
 * Download webp dari URL CDN.
 */
async function fetchStickerFromUrl(url) {
    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer',
            timeout: 20000,
            headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36' },
        });
        const buffer = Buffer.from(res.data);
        if (buffer.length < 500) return null;
        return { buffer, url };
    } catch (e) {
        aiToolsError(`[AITool/REPLY-STIKER] gagal fetch URL "${url}": ${e.message}`);
        return null;
    }
}

/**
 * Inject EXIF sticker metadata ke webp buffer menggunakan node-webpmux.
 * Metode ini sama persis dengan exif.js di repo referensi.
 * @param {Buffer} webpBuf - Buffer webp mentah dari CDN
 * @param {object} meta - { packName, packPublish, packId, emojis }
 * @returns {Promise<Buffer>} - Buffer webp dengan EXIF sticker WA yang valid
 */
async function injectStickerExif(webpBuf, meta = {}) {
    const webpMod = await import('node-webpmux');
    const webp = webpMod.default || webpMod;

    const json = {
        'sticker-pack-id': meta.packId || `honolulu.${Date.now()}`,
        'sticker-pack-name': meta.packName || 'Honolulu - Azur Lane',
        'sticker-pack-publisher': meta.packPublish || 'Wily Bot',
        'android-app-store-link': '',
        'ios-app-store-link': '',
        emojis: meta.emojis || ['⚓', '✨'],
        'is-avatar-sticker': 0,
    };

    const exifAttr = Buffer.from([
        0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00,
        0x01, 0x00, 0x41, 0x57, 0x07, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x16, 0x00, 0x00, 0x00,
    ]);
    const jsonBuff = Buffer.from(JSON.stringify(json), 'utf-8');
    const exif = Buffer.concat([exifAttr, jsonBuff]);
    exif.writeUIntLE(jsonBuff.length, 14, 4);

    const img = new webp.Image();
    await img.load(webpBuf);
    img.exif = exif;
    return await img.save(null);
}

/**
 * Parse [REPLY-STIKER: URL] / [REPLY-STICKER: URL] dari response AI.
 * Download webp CDN → inject EXIF sticker metadata (node-webpmux) → kirim sebagai sticker WA.
 */
export async function extractReplyStickersFromText(text, opts = {}) {
    const stickers = [];
    let cleanText = String(text || '');

    const regex = /\[(?:REPLY-STIKER|REPLY-STICKER):\s*([^\]]{1,300})\]/gi;
    const matches = [...cleanText.matchAll(regex)];

    if (matches.length === 0) return { cleanText, stickers };

    const packName = opts.pack || 'Honolulu - Azur Lane';
    const packPublish = opts.author || 'Wily Bot';

    for (const match of matches) {
        const fullMarker = match[0];
        let value = match[1].trim();
        cleanText = cleanText.split(fullMarker).join('');
        if (!value) continue;

        if (!/^https?:\/\//i.test(value)) {
            aiToolsError(`[AITool/REPLY-STIKER] bukan URL valid: "${value}" — skip`);
            continue;
        }

        // ── Validasi URL: harus dari CDN resmi ──
        // Kalau AI kirim URL yang tidak ada di daftar resmi → fallback ke mood selector
        if (!isValidStickerUrl(value)) {
            aiToolsLog(`[AITool/REPLY-STIKER] ⚠️ URL tidak dikenal, fallback ke mood selector: "${value.substring(0, 60)}"`);
            const fallbackUrl = selectStickerByMood(opts.contextText || cleanText);
            if (fallbackUrl) {
                aiToolsLog(`[AITool/REPLY-STIKER] 🎯 Mood fallback → ${fallbackUrl.substring(0, 70)}`);
                value = fallbackUrl;
                opts._wasFallback = true;
            } else {
                continue;
            }
        }

        try {
            const found = await fetchStickerFromUrl(value);
            if (!found) {
                aiToolsError(`[AITool/REPLY-STIKER] gagal fetch: ${value}`);
                continue;
            }

            const buffer = await injectStickerExif(found.buffer, {
                packName,
                packPublish,
                packId: `honolulu.${Date.now()}`,
                emojis: ['⚓', '✨'],
            });

            if (!buffer || buffer.length < 100) {
                aiToolsError(`[AITool/REPLY-STIKER] buffer kosong setelah inject EXIF: ${value}`);
                continue;
            }

            stickers.push({ buffer, emosi: value, sourceUrl: found.url });
            aiToolsLog(`[AITool/REPLY-STIKER] ✅ "${value.substring(0, 70)}" → ${(buffer.length / 1024).toFixed(1)} KB sticker`);

            // ── Catat ke ai_sticker_story & ai_sticker_pattern ──
            try {
                logStickerSent({
                    sessionKey:  opts.sessionKey  || '',
                    stickerUrl:  value,
                    mood:        opts.mood         || opts.detectedMood || '',
                    context:     (opts.contextText || '').substring(0, 200),
                    wasFallback: !!opts._wasFallback,
                });
            } catch (logErr) {
                aiToolsError(`[AITool/REPLY-STIKER] logStickerSent error: ${logErr.message}`);
            }
        } catch (e) {
            aiToolsError(`[AITool/REPLY-STIKER] gagal "${value.substring(0, 70)}": ${e.message}`);
        }
    }

    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    return { cleanText, stickers };
}

