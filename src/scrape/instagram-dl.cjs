'use strict';

/**
 * Handler untuk command .ig
 * @param {object} hisoka - bot socket
 * @param {object} m       - pesan
 * @param {string} query   - URL Instagram
 * @param {object} ctx     - { gemini, tolak, logCommand, exec, util,
 *                            buildIgVisionPrompt, buildIgCaptionPrompt,
 *                            buildIgFallbackCaption, parseIgMetaHtml, formatIgCount }
 */
async function handleInstagramDl(hisoka, m, query, ctx) {
    const {
        gemini, tolak, logCommand, exec, util,
        buildIgVisionPrompt, buildIgCaptionPrompt,
        buildIgFallbackCaption, parseIgMetaHtml, formatIgCount,
    } = ctx;

    if (!query) {
        await tolak(hisoka, m, '❌ Masukkan link Instagram!\n\nContoh: .ig https://www.instagram.com/reel/xxx');
        return;
    }

    const igRaw = query.trim();
    if (!igRaw.includes('instagram.com')) {
        await tolak(hisoka, m, '❌ Link tidak valid! Pastikan link dari Instagram.');
        return;
    }

    let igUrl = igRaw;
    try {
        const parsed = new URL(igRaw);
        igUrl = parsed.origin + parsed.pathname.replace(/\/$/, '') + '/';
    } catch (_) {}

    const loadingMsg = await tolak(hisoka, m, '⏳ Sedang mengunduh dari Instagram...');

    async function fetchVdraw(url) {
        const res = await fetch('https://vdraw.ai/api/v1/instagram/ins-info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url, type: 'video' }),
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = await res.json();
        if (json.code === 100000 && json.data) return json.data;
        throw new Error('No data from vdraw');
    }

    const [vdrawResult, archiveResult, metaHtmlResult] = await Promise.allSettled([
        fetchVdraw(igUrl),
        fetch(`https://archive.lick.eu.org/api/download/instagram?url=${encodeURIComponent(igUrl)}`, { signal: AbortSignal.timeout(12000) })
            .then(r => r.json()).catch(() => null),
        fetch(igUrl, {
            signal: AbortSignal.timeout(10000),
            headers: {
                'User-Agent': 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)',
                'Accept-Language': 'id-ID,id;q=0.9,en;q=0.8',
            },
        }).then(r => r.text()).catch(() => ''),
    ]);

    let igData = vdrawResult.status === 'fulfilled' ? vdrawResult.value : null;
    const archiveJson = archiveResult.status === 'fulfilled' ? archiveResult.value : null;
    const metaHtml = metaHtmlResult.status === 'fulfilled' ? metaHtmlResult.value : '';

    if (!igData && archiveJson?.status && archiveJson?.result) {
        const r = archiveJson.result;
        igData = {
            media_type: r.isVideo ? 'reel' : 'photo',
            info: (r.url || []).map(u => ({
                url: typeof u === 'object' ? (u.url || u.src) : u,
                media_format: r.isVideo ? 'video' : 'image',
            })),
        };
    }

    if (!igData?.info?.length) {
        await m.reply({ edit: loadingMsg.key, text: '❌ Gagal mengunduh. Pastikan link benar dan akun tidak private, lalu coba lagi.' });
        return;
    }

    const mediaItems = igData.info;
    const mediaType  = igData.media_type || 'reel';

    const archiveMeta = archiveJson?.result || {};
    const parsedMeta  = parseIgMetaHtml(metaHtml);

    const fullName    = parsedMeta.fullName || '';
    const username    = archiveMeta.username || parsedMeta.username || '';
    const caption     = archiveMeta.caption  || parsedMeta.caption  || '';
    const hashtags    = parsedMeta.hashtags  || [];
    const likesNum    = archiveMeta.like    || 0;
    const commentsNum = archiveMeta.comment || 0;
    const likesStr    = parsedMeta.likes   || (likesNum    ? formatIgCount(likesNum)    : '');
    const commentsStr = commentsNum ? formatIgCount(commentsNum) : (parsedMeta.comments || '');

    let infoText = `╭═══ *INSTAGRAM DOWNLOADER* ═══╮\n`;
    if (fullName || username) infoText += `│ 👤 ${fullName ? fullName + (username ? ' (@' + username + ')' : '') : '@' + username}\n`;
    if (likesStr)    infoText += `│ ❤️ ${likesStr} likes\n`;
    if (commentsStr) infoText += `│ 💬 ${commentsStr} comments\n`;
    if (caption) {
        const shortCaption = caption.length > 200 ? caption.substring(0, 200) + '...' : caption;
        infoText += `│\n│ 📝 ${shortCaption}\n`;
    }
    infoText += `╰════════════════════════╯`;

    await m.reply({ edit: loadingMsg.key, text: '✅ Berhasil! Mengirim media...' });

    let igThumbUrl = igData.cover_url || igData.thumbnail_url || igData.cover || igData.thumb || igData.thumbnail || null;

    if (!igThumbUrl && Array.isArray(mediaItems) && mediaItems[0]) {
        const first = mediaItems[0];
        igThumbUrl = first.cover || first.cover_url || first.thumbnail_url || first.thumbnail || null;
    }

    if (!igThumbUrl && Array.isArray(mediaItems)) {
        const firstPhoto = mediaItems.find(it => it.media_format === 'image' || it.media_format === 'photo');
        if (firstPhoto) igThumbUrl = firstPhoto.url || firstPhoto.src;
    }

    let igVisualDesc = '';
    if (igThumbUrl) {
        try {
            const { default: axiosLib } = await import('axios');
            const thumbRes = await axiosLib.get(igThumbUrl, {
                responseType: 'arraybuffer',
                timeout: 12000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36' },
            });
            const thumbBuf = Buffer.from(thumbRes.data);
            if (thumbBuf.length > 500) {
                const base64Thumb = thumbBuf.toString('base64');
                const mimeThumb = thumbRes.headers['content-type']?.split(';')[0] || 'image/jpeg';
                igVisualDesc = await gemini.chat({
                    model: 'gemini-2.5-flash',
                    contents: [{
                        role: 'user',
                        parts: [
                            { inlineData: { mimeType: mimeThumb, data: base64Thumb } },
                            { text: buildIgVisionPrompt() },
                        ],
                    }],
                });
            }
        } catch (_) {}
    }

    let finalCaptionIG = buildIgFallbackCaption({
        fullName, username,
        likes: likesStr, comments: commentsStr,
        mediaType, caption,
    });

    try {
        const captionPrompt = buildIgCaptionPrompt({
            fullName, username, caption, hashtags,
            likes: likesStr, comments: commentsStr,
            mediaType, visualDesc: igVisualDesc,
        });
        const aiCaptionIG = await gemini.ask(captionPrompt);
        if (aiCaptionIG?.trim()) finalCaptionIG = aiCaptionIG.trim();
    } catch (_) {}

    let firstVideoUrl = null;

    for (let i = 0; i < mediaItems.length; i++) {
        const item = mediaItems[i];
        const mediaUrl = typeof item === 'object' ? (item.url || item.src) : item;
        const isFirstMedia = i === 0;

        let itemIsVideo = mediaType === 'video' || mediaType === 'reel';
        if (item.media_format) {
            itemIsVideo = item.media_format === 'video';
        } else {
            const urlStr = String(mediaUrl).toLowerCase().split('?')[0];
            if (urlStr.endsWith('.mp4') || urlStr.endsWith('.mov') || urlStr.endsWith('.webm')) itemIsVideo = true;
            else if (urlStr.endsWith('.jpg') || urlStr.endsWith('.jpeg') || urlStr.endsWith('.png') || urlStr.endsWith('.webp')) itemIsVideo = false;
        }

        if (itemIsVideo && !firstVideoUrl) firstVideoUrl = mediaUrl;

        try {
            if (itemIsVideo) {
                await hisoka.sendMessage(m.from, {
                    video: { url: mediaUrl },
                    caption: isFirstMedia ? finalCaptionIG : ''
                }, { quoted: m });
            } else {
                await hisoka.sendMessage(m.from, {
                    image: { url: mediaUrl },
                    caption: isFirstMedia ? finalCaptionIG : ''
                }, { quoted: m });
            }
        } catch (sendErr) {
            console.error(`[IG] Failed to send media ${i + 1}:`, sendErr.message);
        }
    }

    if (firstVideoUrl) {
        try {
            const execAsync = util.promisify(exec);
            const tmpAudio = `/tmp/ig_audio_${Date.now()}.mp3`;
            await execAsync(`ffmpeg -i "${firstVideoUrl}" -vn -acodec libmp3lame -q:a 4 "${tmpAudio}" -y`, { timeout: 60000 });
            const { readFile, unlink } = await import('fs/promises');
            const audioBuf = await readFile(tmpAudio);
            await hisoka.sendMessage(m.from, {
                audio: audioBuf,
                mimetype: 'audio/mpeg',
                ptt: false,
            }, { quoted: m });
            unlink(tmpAudio).catch(() => {});
        } catch (audioErr) {
            console.error('[IG] Gagal ekstrak audio:', audioErr.message);
        }
    }

    logCommand(m, hisoka, 'instagram');
}

module.exports = { handleInstagramDl };
