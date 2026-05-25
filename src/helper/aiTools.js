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
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import util from 'util';
import { selectStickerByMood, isValidStickerUrl } from './stickerMap.js';
import { logStickerSent } from './aiStickerStory.js';

const execAsync = util.promisify(exec);

const WILY_VERBOSE_AITOOLS = process.env.WILY_VERBOSE_LOGS === 'true' || process.env.BOT_DEBUG_LOG === 'true';
function aiToolsLog(...args)   { if (WILY_VERBOSE_AITOOLS) console.log(...args); }
function aiToolsError(...args) { console.error(...args); }

const TMP_DIR = path.join(process.cwd(), 'tmp');
function ensureTmp() {
    if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });
}

function assertYtdlpReady() {
    const bin = path.join(process.cwd(), 'bin', 'yt-dlp');
    if (!fs.existsSync(bin)) throw new Error('yt-dlp binary tidak ditemukan. Jalankan perintah download dulu sekali.');
    return bin;
}

const _stickerCooldowns = new Map();
const STICKER_COOLDOWN_MS = 60 * 1000;
function isStickerOnCooldown(sessionKey) {
    if (!sessionKey) return false;
    const last = _stickerCooldowns.get(sessionKey);
    return last ? (Date.now() - last) < STICKER_COOLDOWN_MS : false;
}
function markStickerSent(sessionKey) {
    if (sessionKey) _stickerCooldowns.set(sessionKey, Date.now());
}

async function searchAndDownloadAudio(query, opts = {}) {
    const ytdlpBin = opts.ytdlpBin || assertYtdlpReady();
    ensureTmp();

    const yts = (await import('yt-search')).default;
    const res = await yts(query);
    const video = (res.videos || [])[0];
    if (!video) throw new Error(`Tidak ada hasil YouTube untuk query: "${query}"`);

    const { url, title, author, duration } = video;
    if (duration.seconds > 600) throw new Error(`Durasi terlalu panjang (${duration.timestamp}), max 10 menit`);

    const tmpId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const outFile = path.join(TMP_DIR, `ai_song_${tmpId}.mp3`);
    const outTemplate = path.join(TMP_DIR, `ai_song_${tmpId}.%(ext)s`);

    await execAsync(
        `"${ytdlpBin}" --js-runtimes node --no-playlist -x --audio-format mp3 --audio-quality 5 -o "${outTemplate}" "${url}"`,
        { timeout: 120000 }
    );

    if (!fs.existsSync(outFile)) throw new Error('File audio tidak terbuat oleh yt-dlp');
    const buffer = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch (_) {}

    return { buffer, title, channel: author?.name || 'Unknown', duration: duration.seconds, url };
}

async function searchAndDownloadVideo(query, opts = {}) {
    const ytdlpBin = opts.ytdlpBin || assertYtdlpReady();
    ensureTmp();

    const yts = (await import('yt-search')).default;
    const res = await yts(query);
    const video = (res.videos || [])[0];
    if (!video) throw new Error(`Tidak ada hasil YouTube untuk query: "${video}"`);

    const { url, title, author, duration } = video;
    if (duration.seconds > 300) throw new Error(`Durasi terlalu panjang (${duration.timestamp}), max 5 menit untuk video`);

    const tmpId = Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    const outFile = path.join(TMP_DIR, `ai_video_${tmpId}.mp4`);
    const outTemplate = path.join(TMP_DIR, `ai_video_${tmpId}.%(ext)s`);

    await execAsync(
        `"${ytdlpBin}" --js-runtimes node --no-playlist -f "bestvideo[ext=mp4][height<=480]+bestaudio[ext=m4a]/best[ext=mp4][height<=480]/best" --merge-output-format mp4 -o "${outTemplate}" "${url}"`,
        { timeout: 180000 }
    );

    if (!fs.existsSync(outFile)) throw new Error('File video tidak terbuat oleh yt-dlp');
    const buffer = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch (_) {}

    return { buffer, title, channel: author?.name || 'Unknown', duration: duration.seconds, url };
}

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

    // ── Cooldown check: skip kirim stiker jika chat ini masih dalam cooldown ──
    const sessionKey = opts.sessionKey || '';
    if (isStickerOnCooldown(sessionKey)) {
        aiToolsLog(`[AITool/REPLY-STIKER] ⏳ Cooldown aktif untuk "${sessionKey}" — marker dihapus, stiker skip`);
        cleanText = cleanText.replace(regex, '').replace(/\n{3,}/g, '\n\n').trim();
        return { cleanText, stickers };
    }

    const packName = opts.pack || 'Honolulu - Azur Lane';
    const packPublish = opts.author || 'Wily Bot';

    for (const match of matches) {
        const fullMarker = match[0];
        let value = match[1].trim();
        cleanText = cleanText.split(fullMarker).join('');
        if (!value) continue;

        if (!/^https?:\/\//i.test(value)) {
            // Bukan URL → perlakukan sebagai kata emosi/mood keyword
            aiToolsLog(`[AITool/REPLY-STIKER] 🎭 Kata emosi terdeteksi: "${value}" → mood selector`);
            const moodUrl = selectStickerByMood(value);
            if (moodUrl) {
                aiToolsLog(`[AITool/REPLY-STIKER] 🎯 Emosi "${value}" → ${moodUrl.substring(0, 70)}`);
                value = moodUrl;
                opts._wasFallback = true;
            } else {
                aiToolsError(`[AITool/REPLY-STIKER] emosi "${value}" tidak cocok stiker manapun — skip`);
                continue;
            }
        }

        // ── Validasi URL: harus dari CDN resmi ──
        // Kalau AI kirim URL yang tidak ada di daftar resmi → fallback ke mood selector dari konteks
        if (!isValidStickerUrl(value)) {
            aiToolsLog(`[AITool/REPLY-STIKER] ⚠️ URL tidak dikenal, fallback ke mood selector: "${value.substring(0, 60)}"`);
            const fallbackUrl = selectStickerByMood(opts.contextText || cleanText);
            if (fallbackUrl) {
                aiToolsLog(`[AITool/REPLY-STIKER] 🎯 Context fallback → ${fallbackUrl.substring(0, 70)}`);
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
            markStickerSent(sessionKey);
            aiToolsLog(`[AITool/REPLY-STIKER] ✅ "${value.substring(0, 70)}" → ${(buffer.length / 1024).toFixed(1)} KB sticker | cooldown dimulai`);

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

// ════════════════════════════════════════════════════════════
//  VOICE NOTE / TTS
//  Marker: [VN: text], [VN-JP: text], [VN-EN: text], [VN-XX: text]
//  Pakai msedge-tts, generate MP3 buffer
//  Return: { cleanText, voiceNotes: [{ buffer, text, lang }] }
// ════════════════════════════════════════════════════════════

const VN_VOICES = {
    'id': 'id-ID-GadisNeural',
    'jp': 'ja-JP-NanamiNeural',
    'en': 'en-US-AriaNeural',
    'xx': 'id-ID-GadisNeural',
};

async function textToSpeechBuffer(text, voice) {
    const { MsEdgeTTS, OUTPUT_FORMAT } = await import('msedge-tts');
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = tts.toStream(text);
    return new Promise((resolve, reject) => {
        const chunks = [];
        audioStream.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        audioStream.on('end', () => resolve(Buffer.concat(chunks)));
        audioStream.on('close', () => resolve(Buffer.concat(chunks)));
        audioStream.on('error', reject);
    });
}

export async function extractVoiceNotesFromText(text) {
    const voiceNotes = [];
    let cleanText = String(text || '');

    const regex = /\[VN(?:-(JP|EN|XX|ID))?:\s*([^\]]{1,500})\]/gi;
    const matches = [...cleanText.matchAll(regex)];

    for (const match of matches) {
        const fullMarker = match[0];
        const langTag    = (match[1] || 'id').toLowerCase();
        const vnText     = match[2].trim();
        cleanText = cleanText.split(fullMarker).join('');

        if (!vnText) continue;

        const voice = VN_VOICES[langTag] || VN_VOICES['id'];

        try {
            const buffer = await textToSpeechBuffer(vnText, voice);
            if (!buffer || buffer.length < 100) throw new Error('Buffer TTS kosong');
            voiceNotes.push({ buffer, text: vnText, lang: langTag });
            console.log(`[AITool/VN] ✅ "${vnText.substring(0, 60)}" → ${(buffer.length / 1024).toFixed(1)} KB (${voice})`);
        } catch (e) {
            console.error(`[AITool/VN] ❌ Gagal generate TTS "${vnText.substring(0, 60)}": ${e.message}`);
        }
    }

    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    return { cleanText, voiceNotes };
}

// ════════════════════════════════════════════════════════════
//  STICKER FROM IMAGE SEARCH
//  Marker: [STIKER: keyword]
//  Cari gambar → convert ke WebP sticker WA
//  Return: { cleanText, stickers: [{ buffer }] }
// ════════════════════════════════════════════════════════════

export async function extractStickersFromText(text) {
    const stickers = [];
    let cleanText = String(text || '');

    const regex = /\[(?:STIKER|STICKER):\s*([^\]]{1,200})\]/gi;
    const matches = [...cleanText.matchAll(regex)];

    for (const match of matches) {
        const fullMarker = match[0];
        const query      = match[1].trim();
        cleanText = cleanText.split(fullMarker).join('');

        if (!query) continue;

        try {
            const { searchAndGetImage } = await import('./imageSearch.js');
            const found = await searchAndGetImage(query);
            if (!found || !found.buffer) throw new Error('Gambar tidak ditemukan');

            const { Sticker, StickerTypes } = await import('wa-sticker-formatter');
            const sticker = new Sticker(found.buffer, {
                pack:   'Wily Bot',
                author: 'AI Sticker',
                type:   StickerTypes.FULL,
                quality: 50,
            });
            const buffer = await sticker.toBuffer();
            if (!buffer || buffer.length < 100) throw new Error('Buffer sticker kosong');
            stickers.push({ buffer, query });
            console.log(`[AITool/STIKER] ✅ "${query}" → ${(buffer.length / 1024).toFixed(1)} KB sticker`);
        } catch (e) {
            console.error(`[AITool/STIKER] ❌ Gagal buat stiker "${query}": ${e.message}`);
        }
    }

    cleanText = cleanText.replace(/\n{3,}/g, '\n\n').trim();
    return { cleanText, stickers };
}
