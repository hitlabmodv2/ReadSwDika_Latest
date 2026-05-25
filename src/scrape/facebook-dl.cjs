'use strict';

/**
 * Handler untuk command .fb
 * @param {object} hisoka - bot socket
 * @param {object} m       - pesan
 * @param {string} query   - URL Facebook
 * @param {object} ctx     - { tolak, logCommand }
 */
async function handleFacebookDl(hisoka, m, query, ctx) {
    const { tolak, logCommand } = ctx;

    if (!query) {
        await tolak(hisoka, m,
            '❌ Masukkan link Facebook!\n\nContoh:\n' +
            '.fb https://www.facebook.com/watch?v=xxx\n' +
            '.fb https://fb.watch/xxx\n' +
            '.fb https://www.facebook.com/reel/xxx\n' +
            '.fb https://www.facebook.com/stories/xxx'
        );
        return;
    }

    const fbUrl = query.trim();
    if (!fbUrl.includes('facebook.com') && !fbUrl.includes('fb.watch') && !fbUrl.includes('fb.com')) {
        await tolak(hisoka, m, '❌ Link tidak valid! Pastikan link dari Facebook.');
        return;
    }

    const loadingMsg = await tolak(hisoka, m, '⏳ Sedang mengunduh dari Facebook...');

    const isStory = fbUrl.includes('/stories/') || fbUrl.includes('story.php') || fbUrl.includes('/story/');

    let mediaData = null;

    // Method 1: archive.lick.eu.org (primary)
    try {
        const apiUrl = `https://archive.lick.eu.org/api/download/facebook?url=${encodeURIComponent(fbUrl)}`;
        const response = await fetch(apiUrl, { signal: AbortSignal.timeout(20000) });
        const data = await response.json();

        if (data.status && data.result && data.result.media && data.result.media.length > 0) {
            const mediaList = data.result.media;
            const hdMedia   = mediaList.find(item =>
                item.quality && (item.quality.toLowerCase().includes('hd') || item.quality.toLowerCase().includes('high'))
            );
            const bestMedia = hdMedia || mediaList[0];
            if (bestMedia && bestMedia.url) {
                mediaData = {
                    url: bestMedia.url,
                    quality: hdMedia ? 'HD' : 'SD',
                    isHD: !!hdMedia,
                    title: data.result.metadata?.title || '',
                    isVideo: true,
                };
            }
        }
    } catch (e) {
        console.log('[FB] archive.lick failed:', e.message);
    }

    // Method 2: direct page scraping via axios (Chrome user-agent, allow redirects)
    if (!mediaData) {
        try {
            const axios = (await import('axios')).default;
            const { data: pageData } = await axios.get(fbUrl, {
                maxRedirects: 10,
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'accept-language': 'en-US,en;q=0.5',
                    'sec-fetch-dest': 'document',
                    'sec-fetch-mode': 'navigate',
                    'sec-fetch-site': 'none',
                },
                timeout: 20000,
            });

            const cleaned = pageData.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
            const hdMatch  = cleaned.match(/"browser_native_hd_url":"([^"]+)"/)  || cleaned.match(/"playable_url_quality_hd":"([^"]+)"/);
            const sdMatch  = cleaned.match(/"browser_native_sd_url":"([^"]+)"/)  || cleaned.match(/"playable_url":"([^"]+)"/);
            const hdUrl    = hdMatch ? hdMatch[1].replace(/\\/g, '') : null;
            const sdUrl    = sdMatch ? sdMatch[1].replace(/\\/g, '') : null;
            const videoUrl = hdUrl || sdUrl;

            if (videoUrl && videoUrl.startsWith('https://')) {
                mediaData = {
                    url: videoUrl,
                    quality: hdUrl ? 'HD' : 'SD',
                    isHD: !!hdUrl,
                    isVideo: true,
                };
                console.log('[FB] direct scraping success:', hdUrl ? 'HD' : 'SD');
            }
        } catch (e) {
            console.log('[FB] direct scraping failed:', e.message);
        }
    }

    if (!mediaData || !mediaData.url) {
        await m.reply({ edit: loadingMsg.key, text: '❌ Gagal mengunduh. Video/story mungkin private, perlu login, atau link tidak valid.' });
        return;
    }

    let infoText = `╭═══ *FACEBOOK DOWNLOADER* ═══╮\n`;
    infoText += `│ 📌 Tipe: ${isStory ? 'Story' : 'Video/Reel'}\n`;
    infoText += `│ 🎬 Kualitas: ${mediaData.quality}\n`;
    if (mediaData.duration) infoText += `│ ⏱️ Durasi: ${mediaData.duration}\n`;
    if (mediaData.title) {
        const shortTitle = mediaData.title.length > 50 ? mediaData.title.substring(0, 50) + '...' : mediaData.title;
        infoText += `│ 📝 ${shortTitle}\n`;
    }
    infoText += `╰════════════════════════╯`;

    await m.reply({ edit: loadingMsg.key, text: '✅ Berhasil! Mengirim media...' });

    if (mediaData.isVideo !== false) {
        await hisoka.sendMessage(m.from, {
            video: { url: mediaData.url },
            caption: infoText,
        }, { quoted: m });
    } else {
        await hisoka.sendMessage(m.from, {
            image: { url: mediaData.url },
            caption: infoText,
        }, { quoted: m });
    }

    logCommand(m, hisoka, 'facebook');
}

module.exports = { handleFacebookDl };
