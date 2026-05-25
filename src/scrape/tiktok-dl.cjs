'use strict';

const { Downloader } = require('@tobyg74/tiktok-api-dl');

/**
 * Handler untuk command .tt
 * @param {object} hisoka - bot socket
 * @param {object} m       - pesan
 * @param {string} query   - URL TikTok
 * @param {object} ctx     - { gemini, tolak, logCommand, buildVideoDownloadCaptionPrompt }
 */
async function handleTiktokDl(hisoka, m, query, ctx) {
    const { gemini, tolak, logCommand, buildVideoDownloadCaptionPrompt } = ctx;

    if (!query) {
        await tolak(hisoka, m, '❌ Masukkan link TikTok!\n\nContoh: .tt https://vt.tiktok.com/xxx\nAtau: .tt https://www.tiktok.com/@user/video/xxx');
        return;
    }

    const ttUrl = query.trim();
    if (!ttUrl.includes('tiktok.com') && !ttUrl.includes('tiktok')) {
        await tolak(hisoka, m, '❌ Link tidak valid! Pastikan link dari TikTok.');
        return;
    }

    const loadingMsg = await tolak(hisoka, m, '⏳ Sedang mengunduh dari TikTok...');

    let result = null;
    let lastError = null;

    const versions = ['v3', 'v2', 'v1'];
    for (const version of versions) {
        try {
            const res = await Downloader(ttUrl, { version });
            if (res && res.status === 'success' && res.result) {
                result = res;
                console.log('[TikTok] Success with version:', version);
                break;
            }
        } catch (e) {
            lastError = e;
            continue;
        }
    }

    if (!result || result.status !== 'success') {
        await m.reply({ edit: loadingMsg.key, text: '❌ Gagal mengunduh. Video mungkin privat atau link tidak valid.' });
        return;
    }

    const data = result.result;
    const author = data.author || {};
    const stats = data.statistics || data.stats || {};
    const desc = data.description || data.desc || '';

    const formatNum = (num) => {
        if (!num || num === 0) return null;
        const n = parseInt(num) || 0;
        if (isNaN(n) || n === 0) return null;
        return n.toLocaleString('id-ID');
    };

    const playCount    = formatNum(stats.playCount    || stats.play_count || stats.views   || data.playCount);
    const likeCount    = formatNum(stats.likeCount    || stats.like_count || stats.likes   || stats.diggCount || data.likeCount);
    const commentCount = formatNum(stats.commentCount || stats.comment_count || stats.comments || data.commentCount);
    const shareCount   = formatNum(stats.shareCount   || stats.share_count  || stats.shares   || data.shareCount);

    let infoText = `╭═══ *TIKTOK DOWNLOADER* ═══╮\n`;
    infoText += `│ 👤 @${author.nickname || author.username || author.unique_id || data.author?.nickname || 'Unknown'}\n`;
    if (playCount)    infoText += `│ 👁️ ${playCount} views\n`;
    if (likeCount)    infoText += `│ ❤️ ${likeCount} likes\n`;
    if (commentCount) infoText += `│ 💬 ${commentCount} comments\n`;
    if (shareCount)   infoText += `│ 🔄 ${shareCount} shares\n`;
    if (desc) {
        const shortDesc = desc.length > 300 ? desc.substring(0, 300) + '...' : desc;
        infoText += `│\n│ 📝 ${shortDesc}\n`;
    }
    infoText += `╰════════════════════════╯`;

    await m.reply({ edit: loadingMsg.key, text: '✅ Berhasil! Mengirim media...' });

    const aiCaptionPromiseTT = gemini.ask(buildVideoDownloadCaptionPrompt({
        platform: 'TikTok',
        title: desc || '',
        author: author.nickname || author.username || author.unique_id || 'Unknown',
        views: playCount || '',
        likes: likeCount || '',
        comments: commentCount || '',
        description: desc || '',
    })).catch(() => null);

    const pickUrl = (val) => {
        if (!val) return null;
        if (typeof val === 'string') return val;
        if (Array.isArray(val)) return val[0] || null;
        return null;
    };

    let videoUrl = null;

    videoUrl = pickUrl(data.videoHD) || pickUrl(data.videoSD) || pickUrl(data.videoWatermark);

    if (!videoUrl && data.video) {
        if (typeof data.video === 'string') {
            videoUrl = data.video;
        } else if (Array.isArray(data.video)) {
            videoUrl = data.video[0];
        } else {
            videoUrl = pickUrl(data.video.playAddr)
                || pickUrl(data.video.downloadAddr)
                || pickUrl(data.video.noWatermark);
        }
    }

    const aiCaptionTT = await aiCaptionPromiseTT;
    const finalCaptionTT = aiCaptionTT?.trim() || infoText;

    if (videoUrl) {
        try {
            await hisoka.sendMessage(m.from, {
                video: { url: videoUrl },
                caption: finalCaptionTT
            }, { quoted: m });
        } catch (videoErr) {
            console.log('[TikTok] Video send failed:', videoErr.message);
            await tolak(hisoka, m, '⚠️ Gagal mengirim video. Coba lagi nanti.');
        }
    }

    if (!videoUrl) {
        const images = data.images || data.image || [];
        if (images.length > 0) {
            await tolak(hisoka, m, `📸 Slide TikTok ditemukan (${images.length} gambar)`);
            for (let i = 0; i < Math.min(images.length, 10); i++) {
                const imgUrl = pickUrl(images[i]) || images[i];
                if (!imgUrl) continue;
                try {
                    await hisoka.sendMessage(m.from, {
                        image: { url: imgUrl },
                        caption: i === 0 ? finalCaptionTT : `📷 ${i + 1}/${images.length}`
                    }, { quoted: m });
                } catch (imgErr) {
                    console.log('[TikTok] Image send failed:', imgErr.message);
                }
            }
        } else {
            await tolak(hisoka, m, '❌ Media tidak ditemukan dalam video ini.');
        }
    }

    logCommand(m, hisoka, 'tiktok');
}

module.exports = { handleTiktokDl };
