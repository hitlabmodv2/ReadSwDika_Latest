'use strict';

const fs   = require('fs');
const path = require('path');
const { exec } = require('child_process');

function parseYtdlpError(stderr, fallback) {
    if (!stderr) return fallback || 'Unknown error';
    const errorLine = stderr.split('\n').find(l => l.trim().startsWith('ERROR:'));
    if (errorLine) {
        return errorLine.replace(/^ERROR:\s*/, '').replace(/^\[youtube\]\s*[^:]+:\s*/, '').trim();
    }
    return fallback || stderr.substring(0, 150);
}

async function ensureYtdlp(hisoka, m, tolak) {
    const binDir   = path.join(process.cwd(), 'bin');
    const ytdlpBin = path.join(binDir, 'yt-dlp');

    if (!fs.existsSync(binDir)) fs.mkdirSync(binDir, { recursive: true });
    if (fs.existsSync(ytdlpBin)) return ytdlpBin;

    console.log('\x1b[33m[YT-DLP] Binary tidak ditemukan, mengunduh otomatis...\x1b[39m');

    if (hisoka && m) {
        await hisoka.sendMessage(m.from, { react: { text: '⬇️', key: m.key } });
        await tolak(hisoka, m, '⬇️ *Mohon tunggu sebentar...*\n\nSistem sedang mempersiapkan downloader YouTube. Proses ini hanya terjadi sekali dan tidak akan terulang lagi. Permintaanmu akan otomatis dilanjutkan setelah siap. ⏳');
    }

    const downloadUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux';

    await new Promise((resolve, reject) => {
        exec(`curl -L "${downloadUrl}" -o "${ytdlpBin}"`, { timeout: 120000 }, (err) => {
            if (err) return reject(new Error('Gagal mengunduh yt-dlp: ' + err.message));
            resolve();
        });
    });

    fs.chmodSync(ytdlpBin, 0o755);
    console.log('\x1b[32m[YT-DLP] ✓ Binary berhasil diunduh dan siap digunakan.\x1b[39m');

    if (hisoka && m) {
        await tolak(hisoka, m, '✅ *Downloader siap!* Sedang memproses permintaanmu...');
    }

    return ytdlpBin;
}

/**
 * Handler untuk command .play
 * @param {object} ctx - { gemini, tolak, logCommand, pendingPlayChoices, Button, buildVideoDownloadCaptionPrompt }
 */
async function handlePlay(hisoka, m, query, ctx) {
    const { tolak, logCommand, pendingPlayChoices, Button } = ctx;

    if (!query) {
        await tolak(hisoka, m, '❌ Masukkan judul lagu!\n\nContoh: .play shape of you ed sheeran');
        return;
    }

    await hisoka.sendMessage(m.from, { react: { text: '🔍', key: m.key } });
    const loadingMsg = await tolak(hisoka, m, '🔍 Mencari lagu...');

    const yts = (await import('yt-search')).default;
    const searchResult = await yts(query.trim());

    if (!searchResult || !searchResult.videos || searchResult.videos.length === 0) {
        await hisoka.sendMessage(m.from, { react: { text: '❌', key: m.key } });
        await m.reply({ edit: loadingMsg.key, text: '❌ Lagu tidak ditemukan!' });
        return;
    }

    const video = searchResult.videos[0];

    if (video.seconds > 600) {
        await hisoka.sendMessage(m.from, { react: { text: '❌', key: m.key } });
        await m.reply({ edit: loadingMsg.key, text: `❌ Durasi terlalu panjang! (${video.duration.timestamp})\nMaksimal 10 menit.` });
        return;
    }

    const thumbUrl  = video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;
    const videoLink = video.url        || `https://youtu.be/${video.videoId}`;
    const durStr    = video.duration.timestamp;
    const viewsFmt  = video.views ? video.views.toLocaleString('id-ID') : '?';

    let playBody = `╭═══〔 *🎵 PLAY MUSIC* 〕═══╮\n`;
    playBody += `│\n`;
    playBody += `│ 📌 *${video.title}*\n`;
    playBody += `│ ⏱️ Durasi  : ${durStr}\n`;
    playBody += `│ 👁️ Views   : ${viewsFmt}\n`;
    if (video.author?.name) playBody += `│ 👤 Channel : ${video.author.name}\n`;
    playBody += `│ 🔗 Link    : ${videoLink}\n`;
    playBody += `│\n`;
    playBody += `│ Pilih format di bawah 👇\n`;
    playBody += `╰═══════════════════════╯`;

    let buttonSent = false;
    try {
        await new Button()
            .setImage(thumbUrl)
            .setBody(playBody)
            .setFooter('⏳ Pilihan hangus dalam 2 menit')
            .addReply('🎵 Audio MP3', '1')
            .addReply('🎬 Video MP4 (360p)', '2')
            .run(m.from, hisoka, m);
        buttonSent = true;
    } catch {
        await hisoka.sendMessage(m.from, {
            image: { url: thumbUrl },
            caption: playBody + `\n\n🎵 *1* - Audio MP3\n🎬 *2* - Video MP4\n\n_Balas dengan angka pilihanmu_`
        }, { quoted: m });
    }

    await hisoka.sendMessage(m.from, { react: { text: '🎵', key: m.key } });
    await m.reply({
        edit: loadingMsg.key,
        text: buttonSent
            ? `🎵 Ketemu! Tap tombol *Audio MP3* atau *Video MP4* untuk download.`
            : `🎵 Ketemu! Balas dengan *1* untuk Audio MP3 atau *2* untuk Video MP4.`
    });

    const timeoutId = setTimeout(() => {
        if (pendingPlayChoices.has(m.sender)) {
            pendingPlayChoices.delete(m.sender);
        }
    }, 2 * 60 * 1000);

    pendingPlayChoices.set(m.sender, {
        url: video.url,
        title: video.title,
        duration: durStr,
        seconds: video.seconds,
        timeout: timeoutId
    });

    logCommand(m, hisoka, 'play');
}

/**
 * Handler untuk command .ytmp3
 * @param {object} ctx - { gemini, tolak, logCommand, buildVideoDownloadCaptionPrompt }
 */
async function handleYtmp3(hisoka, m, query, ctx) {
    const { gemini, tolak, logCommand, buildVideoDownloadCaptionPrompt } = ctx;

    if (!query) {
        await tolak(hisoka, m, '❌ Masukkan link YouTube!\n\nContoh: .ytmp3 https://youtu.be/xxx\nAtau: .ytmp3 https://www.youtube.com/watch?v=xxx');
        return;
    }

    const ytUrl = query.trim();
    if (!ytUrl.includes('youtube.com') && !ytUrl.includes('youtu.be')) {
        await tolak(hisoka, m, '❌ Link tidak valid! Gunakan link YouTube.');
        return;
    }

    await hisoka.sendMessage(m.from, { react: { text: '⏳', key: m.key } });
    const loadingMsg = await tolak(hisoka, m, '⏳ Mengambil info video...');

    const ytdlpBin = await ensureYtdlp(hisoka, m, tolak);

    const metaRaw = await new Promise((resolve, reject) => {
        exec(`"${ytdlpBin}" --js-runtimes node --no-playlist --dump-json "${ytUrl}"`, { timeout: 30000 }, (err, stdout, stderr) => {
            if (err) return reject(new Error(parseYtdlpError(stderr, err.message)));
            resolve(stdout.trim());
        });
    });

    const meta     = JSON.parse(metaRaw);
    const duration = meta.duration || 0;

    if (duration > 600) {
        await hisoka.sendMessage(m.from, { react: { text: '❌', key: m.key } });
        await m.reply({ edit: loadingMsg.key, text: `❌ Durasi terlalu panjang! (${Math.floor(duration / 60)} menit)\nMaksimal 10 menit.` });
        return;
    }

    await m.reply({ edit: loadingMsg.key, text: '⏳ Mengunduh audio MP3...' });

    const durMin   = Math.floor(duration / 60);
    const durSec   = Math.floor(duration % 60);
    const durStr   = `${durMin}:${String(durSec).padStart(2, '0')}`;
    const viewsFmt = meta.view_count ? parseInt(meta.view_count).toLocaleString('id-ID') : '?';
    const thumbUrl = meta.thumbnail || `https://i.ytimg.com/vi/${meta.id}/hqdefault.jpg`;
    const videoLink = `https://youtu.be/${meta.id}`;

    let mp3Caption = `╭═══〔 *🎵 YTMP3 DOWNLOADER* 〕═══╮\n`;
    mp3Caption += `│\n`;
    mp3Caption += `│ 📌 *${meta.title}*\n`;
    mp3Caption += `│ ⏱️ Durasi  : ${durStr}\n`;
    mp3Caption += `│ 👁️ Views   : ${viewsFmt}\n`;
    if (meta.uploader) mp3Caption += `│ 👤 Channel : ${meta.uploader}\n`;
    if (meta.like_count) mp3Caption += `│ 👍 Likes   : ${parseInt(meta.like_count).toLocaleString('id-ID')}\n`;
    mp3Caption += `│ 🔗 Link    : ${videoLink}\n`;
    mp3Caption += `│\n`;
    mp3Caption += `│ ⬇️ _Sedang mengunduh audio MP3..._\n`;
    mp3Caption += `╰══════════════════════════════╯`;

    const aiCaptionPromiseYtmp3 = gemini.ask(buildVideoDownloadCaptionPrompt({
        platform: 'YouTube Audio',
        title: meta.title || '',
        author: meta.uploader || meta.channel || '',
        duration: durStr,
        views: viewsFmt,
        likes: meta.like_count ? parseInt(meta.like_count).toLocaleString('id-ID') : '',
        description: meta.description || '',
    })).catch(() => null);

    await hisoka.sendMessage(m.from, {
        image: { url: thumbUrl },
        caption: mp3Caption
    }, { quoted: m });

    const { getDiskUsage, clearTmpFolder: clearTmpForYtmp3 } = await import('../helper/cleaner.js');
    const diskInfoYtmp3 = getDiskUsage();
    if (diskInfoYtmp3.free < 80 * 1024 * 1024) {
        console.log(`\x1b[33m[YTMP3]\x1b[39m Disk hampir penuh (${diskInfoYtmp3.free} bytes), membersihkan tmp...`);
        clearTmpForYtmp3();
    }

    const tmpId       = Date.now();
    const tmpFile     = path.join(process.cwd(), 'tmp', `ytmp3_${tmpId}.mp3`);
    const tmpTemplate = path.join(process.cwd(), 'tmp', `ytmp3_${tmpId}.%(ext)s`);

    await new Promise((resolve, reject) => {
        const cmd = `"${ytdlpBin}" --js-runtimes node --no-playlist -x --audio-format mp3 --audio-quality 5 -o "${tmpTemplate}" "${ytUrl}"`;
        exec(cmd, { timeout: 120000 }, (err, stdout, stderr) => {
            if (err) return reject(new Error(parseYtdlpError(stderr, err.message)));
            resolve();
        });
    });

    const audioBuffer = fs.readFileSync(tmpFile);

    const aiCaptionYtmp3  = await aiCaptionPromiseYtmp3;
    const finalCaptionYtmp3 = aiCaptionYtmp3?.trim() || `🎵 *${meta.title}*\n👤 ${meta.uploader || ''}\n⏱️ ${durStr}`;

    await hisoka.sendMessage(m.from, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        fileName: `${meta.title.replace(/[^\w\s]/gi, '')}.mp3`,
        ptt: false
    }, { quoted: m });

    await hisoka.sendMessage(m.from, { react: { text: '✅', key: m.key } });
    await m.reply({ edit: loadingMsg.key, text: `✅ *Audio MP3 berhasil dikirim!*\n\n${finalCaptionYtmp3}` });

    try { fs.unlinkSync(tmpFile); } catch (_) {}

    logCommand(m, hisoka, 'ytmp3');
}

/**
 * Handler untuk command .ytmp4
 * @param {object} ctx - { gemini, tolak, logCommand, buildVideoDownloadCaptionPrompt }
 */
async function handleYtmp4(hisoka, m, query, ctx) {
    const { gemini, tolak, logCommand, buildVideoDownloadCaptionPrompt } = ctx;

    if (!query) {
        await tolak(hisoka, m, '❌ Masukkan link YouTube!\n\nContoh: .ytmp4 https://youtu.be/xxx\nAtau: .ytmp4 https://www.youtube.com/watch?v=xxx');
        return;
    }

    const ytUrl = query.trim();
    if (!ytUrl.includes('youtube.com') && !ytUrl.includes('youtu.be')) {
        await tolak(hisoka, m, '❌ Link tidak valid! Gunakan link YouTube.');
        return;
    }

    await hisoka.sendMessage(m.from, { react: { text: '⏳', key: m.key } });
    const loadingMsg = await tolak(hisoka, m, '⏳ Mengambil info video...');

    const ytdlpBin = await ensureYtdlp(hisoka, m, tolak);

    const metaRaw = await new Promise((resolve, reject) => {
        exec(`"${ytdlpBin}" --js-runtimes node --no-playlist --dump-json "${ytUrl}"`, { timeout: 30000 }, (err, stdout, stderr) => {
            if (err) return reject(new Error(parseYtdlpError(stderr, err.message)));
            resolve(stdout.trim());
        });
    });

    const meta     = JSON.parse(metaRaw);
    const duration = meta.duration || 0;

    if (duration > 300) {
        await hisoka.sendMessage(m.from, { react: { text: '❌', key: m.key } });
        await m.reply({ edit: loadingMsg.key, text: `❌ Durasi terlalu panjang! (${Math.floor(duration / 60)} menit)\nMaksimal 5 menit untuk video.` });
        return;
    }

    await m.reply({ edit: loadingMsg.key, text: '⏳ Mengunduh video MP4...' });

    const durMin    = Math.floor(duration / 60);
    const durSec    = Math.floor(duration % 60);
    const durStr    = `${durMin}:${String(durSec).padStart(2, '0')}`;
    const viewsFmt  = meta.view_count ? parseInt(meta.view_count).toLocaleString('id-ID') : '?';
    const thumbUrl  = meta.thumbnail  || `https://i.ytimg.com/vi/${meta.id}/hqdefault.jpg`;
    const videoLink = `https://youtu.be/${meta.id}`;

    let mp4Caption = `╭═══〔 *🎬 YTMP4 DOWNLOADER* 〕═══╮\n`;
    mp4Caption += `│\n`;
    mp4Caption += `│ 📌 *${meta.title}*\n`;
    mp4Caption += `│ ⏱️ Durasi  : ${durStr}\n`;
    mp4Caption += `│ 📐 Kualitas: 360p\n`;
    mp4Caption += `│ 👁️ Views   : ${viewsFmt}\n`;
    if (meta.uploader)  mp4Caption += `│ 👤 Channel : ${meta.uploader}\n`;
    if (meta.like_count) mp4Caption += `│ 👍 Likes   : ${parseInt(meta.like_count).toLocaleString('id-ID')}\n`;
    mp4Caption += `│ 🔗 Link    : ${videoLink}\n`;
    mp4Caption += `│\n`;
    mp4Caption += `│ ⬇️ _Sedang mengunduh video MP4..._\n`;
    mp4Caption += `╰══════════════════════════════╯`;

    const aiCaptionPromiseYtmp4 = gemini.ask(buildVideoDownloadCaptionPrompt({
        platform: 'YouTube',
        title: meta.title || '',
        author: meta.uploader || meta.channel || '',
        duration: durStr,
        views: viewsFmt,
        likes: meta.like_count ? parseInt(meta.like_count).toLocaleString('id-ID') : '',
        description: meta.description || '',
    })).catch(() => null);

    await hisoka.sendMessage(m.from, {
        image: { url: thumbUrl },
        caption: mp4Caption
    }, { quoted: m });

    const { getDiskUsage: getDiskYtmp4, clearTmpFolder: clearTmpForYtmp4 } = await import('../helper/cleaner.js');
    const diskInfoYtmp4 = getDiskYtmp4();
    if (diskInfoYtmp4.free < 200 * 1024 * 1024) {
        console.log(`\x1b[33m[YTMP4]\x1b[39m Disk hampir penuh (${diskInfoYtmp4.free} bytes), membersihkan tmp...`);
        clearTmpForYtmp4();
    }

    const tmpId       = Date.now();
    const tmpFile     = path.join(process.cwd(), 'tmp', `ytmp4_${tmpId}.mp4`);
    const tmpTemplate = path.join(process.cwd(), 'tmp', `ytmp4_${tmpId}.%(ext)s`);

    await new Promise((resolve, reject) => {
        const cmd = `"${ytdlpBin}" --js-runtimes node --no-playlist -f "bestvideo[height<=360]+bestaudio/best[height<=360]" --merge-output-format mp4 --postprocessor-args "ffmpeg:-c:v libx264 -c:a aac -movflags +faststart -preset fast -crf 28" -o "${tmpTemplate}" "${ytUrl}"`;
        exec(cmd, { timeout: 240000 }, (err, stdout, stderr) => {
            if (err) return reject(new Error(parseYtdlpError(stderr, err.message)));
            resolve();
        });
    });

    const videoBuffer = fs.readFileSync(tmpFile);

    const aiCaptionYtmp4    = await aiCaptionPromiseYtmp4;
    const finalCaptionYtmp4 = aiCaptionYtmp4?.trim() || `🎬 *${meta.title}*\n👤 ${meta.uploader || ''}\n⏱️ ${durStr} • 360p`;

    await hisoka.sendMessage(m.from, {
        video: videoBuffer,
        caption: finalCaptionYtmp4,
        mimetype: 'video/mp4'
    }, { quoted: m });

    await hisoka.sendMessage(m.from, { react: { text: '✅', key: m.key } });
    await m.reply({ edit: loadingMsg.key, text: `✅ *Video MP4 berhasil dikirim!*\n📌 ${meta.title}` });

    try { fs.unlinkSync(tmpFile); } catch (_) {}

    logCommand(m, hisoka, 'ytmp4');
}

module.exports = { handlePlay, handleYtmp3, handleYtmp4, parseYtdlpError, ensureYtdlp };
