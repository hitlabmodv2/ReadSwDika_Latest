const axios = require('axios');
const yts = require('yt-search');

const servers = {
    api1: { 
        name: 'API 1: CloudkuImages',
        video: 'https://rest.cloudkuimages.com/api/download/ytmp4?url=',
        audio: 'https://rest.cloudkuimages.com/api/download/ytmp3?url=',
        needsFetch: true, // API 1 BUTUH FETCH
        supportsQuality: true
    },
    api2: { 
        name: 'API 2: Caliph Dev',
        video: 'https://ytdl-api.caliphdev.com/download/video?url=',
        audio: 'https://ytdl-api.caliphdev.com/download/audio?url=',
        needsFetch: true
    },
    api3: {
        name: 'API 3: SiputzX',
        video: 'https://ytdl.siputzx.my.id/api/convert?url=',
        audio: 'https://ytdl.siputzx.my.id/api/convert?url=',
        needsFetch: true
    },
    api4: { 
        name: 'API 4: Nauval Group',
        video: 'https://ytdownloader.nvlgroup.my.id/download?url=', 
        audio: 'https://ytdownloader.nvlgroup.my.id/audio?url=',
        needsFetch: false, // API 4 LANGSUNG MEDIA
        supportsQuality: true
    },
    api5: {
        name: 'API 5: SuraWeb',
        audio: 'https://api.suraweb.online/download/youtube/audio?url=',
        needsFetch: false
    }
};

// 🔍 Ambil info video dari yt-search
async function getVideoInfo(url) {
    try {
        const search = await yts(url);
        if (!search.videos.length) return { status: false, message: 'Video tidak ditemukan' };
        
        const video = search.videos[0];
        return {
            status: true,
            title: video.title,
            creator: video.author.name,
            duration: video.seconds,
            thumbnail: video.thumbnail,
            views: video.views,
            uploaded: video.ago,
            url: video.url
        };
    } catch (error) {
        console.warn('Gagal mendapatkan info video:', error.message);
        return { status: false, message: 'Terjadi kesalahan saat mengambil info video' };
    }
}

// 🔍 Cek apakah link bisa diakses
async function validateDownloadUrl(url) {
    try {
        const response = await axios.head(url);
        return response.status === 200;
    } catch {
        return false;
    }
}

// 🎵 Download Audio (MP3)
async function downloadAudio(url, bitrate = '128', apiChoice = null) {
    let selectedAPIs = apiChoice && servers[apiChoice] ? [servers[apiChoice]] : Object.values(servers);

    if (!apiChoice && bitrate !== '128') selectedAPIs = [servers.api1, servers.api4];

    for (const server of selectedAPIs) {
        try {
            let apiUrl = server.audio + encodeURIComponent(url);
            if (server.supportsQuality && bitrate !== '128') apiUrl += `&bitrate=${bitrate}`;
            if (server.name === 'API 3: SiputzX') apiUrl += `&type=mp3`;

            if (server.name === 'API 4: Nauval Group') {
                return { status: true, downloadUrl: apiUrl, source: server.name };
            }

            const response = await axios.get(apiUrl);
            let finalUrl = response.data.download_url || response.data.download || response.data.dl || response.data.data?.download;

            if (server.name === 'API 1: CloudkuImages') {
                finalUrl = response.data.metadata?.url || response.data.url;
            }

            if (!finalUrl) continue;

            if (!apiChoice && server.needsFetch && !(await validateDownloadUrl(finalUrl))) {
                console.warn(`⚠️ Link dari ${server.name} tidak bisa diakses, mencoba API lain...`);
                continue;
            }

            return { status: true, downloadUrl: finalUrl, source: server.name };

        } catch (error) {
            console.warn(`❌ Gagal dari ${server?.name || 'API tidak ditemukan'}, mencoba API lain...`);
        }
    }
    return { status: false, message: "Semua API gagal." };
}

// 📹 Download Video (MP4)
async function downloadVideo(url, resolution = '720', apiChoice = null) {
    let selectedAPIs = apiChoice && servers[apiChoice] ? [servers[apiChoice]] : Object.values(servers);

    if (!apiChoice && resolution !== '720') selectedAPIs = [servers.api1, servers.api4];

    for (const server of selectedAPIs) {
        try {
            let apiUrl = server.video + encodeURIComponent(url);
            if (server.supportsQuality && resolution !== '720') apiUrl += `&resolution=${resolution}`;
            if (server.name === 'API 3: SiputzX') apiUrl += `&type=mp4`;

            if (server.name === 'API 4: Nauval Group') {
                return { status: true, downloadUrl: apiUrl, source: server.name };
            }

            const response = await axios.get(apiUrl);
            let finalUrl = response.data.download_url || response.data.download || response.data.dl;

            if (server.name === 'API 1: CloudkuImages') {
                finalUrl = response.data.metadata?.url || response.data.url;
            }

            if (!finalUrl) continue;

            if (!apiChoice && server.needsFetch && !(await validateDownloadUrl(finalUrl))) {
                console.warn(`⚠️ Link dari ${server.name} tidak bisa diakses, mencoba API lain...`);
                continue;
            }

            return { status: true, downloadUrl: finalUrl, source: server.name };

        } catch (error) {
            console.warn(`❌ Gagal dari ${server?.name || 'API tidak ditemukan'}, mencoba API lain...`);
        }
    }
    return { status: false, message: "Semua API gagal." };
}

module.exports = { getVideoInfo, downloadAudio, downloadVideo, servers };
