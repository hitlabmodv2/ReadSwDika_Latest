'use strict';

/**
 * ═══════════════════════════════════════════════════
 *  AI PROMPT — INSTAGRAM DOWNLOADER (AiPromptIg.js)
 *  File khusus prompt AI untuk fitur .ig
 *
 *  Fungsi:
 *    1. buildIgVisionPrompt()       → prompt analisis visual thumbnail/cover
 *    2. buildIgCaptionPrompt(data)  → prompt generate caption WA lengkap
 *    3. buildIgFallbackCaption(d)   → fallback caption kalau AI gagal
 *    4. parseIgMetaHtml(html)       → ekstrak metadata dari HTML IG
 *    5. formatIgLikes(n)            → format angka → "17K", "1.2M"
 * ═══════════════════════════════════════════════════
 */

/**
 * Format angka likes/views jadi readable: 17247 → "17,2K" | 1200000 → "1,2M"
 */
export function formatIgCount(n) {
    const num = Number(n);
    if (!num || isNaN(num)) return '';
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1).replace('.0', '') + 'M';
    if (num >= 1_000)     return (num / 1_000).toFixed(1).replace('.0', '') + 'K';
    return num.toLocaleString('id-ID');
}

/**
 * Ekstrak metadata dari HTML Instagram (fb-crawler scrape).
 * Return: { fullName, username, likes, comments, caption, hashtags }
 */
export function parseIgMetaHtml(html = '') {
    const decode = s => s
        .replace(/&quot;/g, '"').replace(/&#x27;/g, "'")
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&[a-z]+;/g, '');

    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)?.[1] || '';
    const ogDesc  = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/)?.[1] || '';

    const decoded = decode(ogTitle + ' ' + ogDesc);

    // Nama lengkap: "Ilham Nur Farobby di Instagram:"
    const fullName = decode(ogTitle).match(/^([^:]+?)\s+di Instagram/i)?.[1]?.trim() || '';

    // username: "farobbyilham pada May 8"
    const username = decode(ogDesc).match(/[-–]\s*([a-zA-Z0-9_.]+)\s+pada\s+/i)?.[1]
        || decode(ogDesc).match(/[-–]\s*([a-zA-Z0-9_.]+)\s+on\s+/i)?.[1]
        || '';

    // Likes: "17K likes" atau "17.247 likes"
    const likesRaw = decode(ogDesc).match(/([\d.,]+[KkMm]?)\s*(?:likes|suka)/i)?.[1] || '';
    const likes = likesRaw.replace(',', '.').toUpperCase();

    // Comments
    const commentsRaw = decode(ogDesc).match(/([\d.,]+[KkMm]?)\s*(?:comments|komentar)/i)?.[1] || '';
    const comments = commentsRaw;

    // Caption: ambil dari kutipan
    const rawCaption = decode(ogDesc).replace(/^[\d.,KkMm]+\s+likes.*?:\s*"?/i, '').replace(/"?\s*$/, '').trim();

    // Hashtags
    const hashtags = (rawCaption.match(/#\w+/g) || []).slice(0, 5);

    return { fullName, username, likes, comments, caption: rawCaption, hashtags };
}

/**
 * Prompt untuk Gemini Vision — analisis thumbnail/cover Instagram.
 * Dipanggil dengan gemini.chat({ model: 'gemini-2.5-flash', ... })
 */
export function buildIgVisionPrompt() {
    return `Kamu adalah AI spesialis analisis konten visual Instagram.

Analisis gambar ini dengan teliti dan jawab 4 hal berikut (jawab langsung tanpa label/heading):

1. *Aksi utama*: Apa yang sedang terjadi atau ditampilkan? (spesifik, akurat)
2. *Subjek*: Siapa atau apa yang ada di sini? (orang, hewan, objek — sebut spesifik. Contoh: "pria muda berkacamata", "kucing oranye", "tupai tanah abu-abu")
3. *Setting*: Di mana latarnya? (dalam ruangan, outdoor, kafe, alam, dll)
4. *Vibe/nuansa*: Apa suasananya? (lucu, menggemaskan, menegangkan, estetik, edukatif, absurd, dll)

Aturan WAJIB:
- Bahasa Indonesia, akurat berdasarkan yang BENAR-BENAR terlihat
- Jangan mengarang, jangan tebak-tebakan
- Jika ada hewan → sebut nama jenisnya secara spesifik
- Jika ada makanan → sebut nama makanannya
- Jika ada teks di gambar → sebut isinya
- Maksimal 3-4 kalimat total, ringkas dan to the point
- Jangan tulis "Berdasarkan gambar..." atau label apapun
- Jangan bilang kamu AI`;
}

/**
 * Prompt generate caption WhatsApp — pakai formatting WA: *bold* _italic_ \`code\` > quote
 *
 * @param {object} d
 * @param {string} d.fullName      - Nama lengkap kreator ("Ilham Nur Farobby")
 * @param {string} d.username      - Username IG ("farobbyilham")
 * @param {string} d.likes         - Likes formatted ("17K")
 * @param {string} d.comments      - Comments ("436")
 * @param {string} d.caption       - Caption asli dari IG
 * @param {string[]} d.hashtags    - Array hashtag ["#hantavirus", "#tikus"]
 * @param {string} d.music         - Nama lagu (kosong kalau tidak ada)
 * @param {string} d.musicArtist   - Nama artis musik
 * @param {string} d.mediaType     - "reel" | "photo" | "carousel"
 * @param {string} d.visualDesc    - Hasil analisis visual dari Gemini Vision
 */
export function buildIgCaptionPrompt({
    fullName = '',
    username = '',
    likes = '',
    comments = '',
    caption = '',
    hashtags = [],
    music = '',
    musicArtist = '',
    mediaType = 'reel',
    visualDesc = '',
} = {}) {
    const isReel = mediaType === 'reel' || mediaType === 'video';
    const isPhoto = mediaType === 'photo' || mediaType === 'image';
    const emoji = isReel ? '🎬' : isPhoto ? '📸' : '🖼️';
    const typeLabel = isReel ? 'Reel/Video' : isPhoto ? 'Foto' : 'Album';

    const displayName = fullName
        ? `${fullName}${username ? ' (@' + username + ')' : ''}`
        : username ? `@${username}` : 'Instagram';

    const parts = [];
    parts.push(`Sumber: ${displayName}`);
    if (likes)    parts.push(`Likes: ${likes}`);
    if (comments) parts.push(`Komentar: ${comments}`);
    if (music)    parts.push(`Musik: "${music}"${musicArtist ? ' — ' + musicArtist : ''}`);
    if (caption)  parts.push(`Caption asli: "${caption.substring(0, 300)}"`);
    if (hashtags.length) parts.push(`Hashtag: ${hashtags.join(' ')}`);

    const metaBlock = parts.map(p => `- ${p}`).join('\n');
    const visualBlock = visualDesc
        ? `\nAnalisis Visual (PRIORITAS UTAMA — dari AI Vision):\n"${visualDesc.substring(0, 600)}"`
        : '';

    return `Kamu adalah Wily, asisten bot WhatsApp yang cerdas, natural, dan sedikit bercanda.
Tugasmu: buat caption WhatsApp untuk ${typeLabel} Instagram yang baru diunduh.

DATA KONTEN:
${metaBlock}${visualBlock}

FORMAT CAPTION (ikuti persis):
Baris 1  : ${emoji} *[Nama/Username dalam bold]* — sertakan @username jika ada
Baris 2-3: Deskripsi isi konten 1-2 kalimat — *WAJIB berdasarkan Analisis Visual*, bukan mengarang
           Boleh pakai _italic_ untuk kata kunci menarik, dan \`monospace\` untuk istilah/nama spesifik
Baris 4  : (opsional) Komentar santai/reaksi singkat yang nyambung — boleh lucu/ngakak kalau kontennya memang lucu
Baris 5  : > ❤️ [likes]  💬 [comments] — pakai format quote WA (tanda >) untuk stats engagement
           (hanya tampilkan baris ini jika ada data likes/comments)

ATURAN KETAT:
1. WAJIB gunakan formatting WA: *bold* untuk nama/judul, _italic_ untuk penekanan, \`backtick\` untuk nama spesifik/istilah, > untuk baris stats
2. Deskripsi konten HARUS berdasarkan Analisis Visual — jika visual bilang tupai, tulis tupai; JANGAN tulis "kompilasi momen indah" atau frasa generik
3. Jika ada info musik → sebut di baris sendiri dengan emoji 🎵
4. Bahasa Indonesia santai, tidak kaku, terasa seperti kawan ngirim video
5. DILARANG mengarang fakta di luar data yang diberikan
6. DILARANG sertakan URL atau link
7. DILARANG bilang kamu AI
8. Maksimal 5-6 baris total

Caption:`;
}

/**
 * Fallback caption sederhana jika AI total gagal.
 */
export function buildIgFallbackCaption({
    fullName = '',
    username = '',
    likes = '',
    comments = '',
    mediaType = 'reel',
    caption = '',
} = {}) {
    const emoji = mediaType === 'reel' || mediaType === 'video' ? '🎬' : '📸';
    const name = fullName ? `*${fullName}*${username ? ' (@' + username + ')' : ''}` : username ? `*@${username}*` : '*Instagram*';
    let text = `${emoji} ${name}\n`;
    if (caption) text += caption.substring(0, 120) + (caption.length > 120 ? '...' : '') + '\n';
    const stats = [];
    if (likes) stats.push(`❤️ ${likes}`);
    if (comments) stats.push(`💬 ${comments}`);
    if (stats.length) text += `> ${stats.join('  ')}`;
    return text.trim();
}
