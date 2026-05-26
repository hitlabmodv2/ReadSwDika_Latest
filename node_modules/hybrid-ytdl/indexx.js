const axios = require('axios');

async function getY2Mate(url, format = 'mp3') {
    try {
        console.log(`🔍 Mengambil data dari Y2Mate untuk: ${url}`);

        const analyzeResponse = await axios.post(
            'https://www.y2mate.com/mates/en872/analyzeV2/ajax',
            `k_query=${encodeURIComponent(url)}&k_page=home&hl=en&q_auto=0`, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            }
        );

        console.log("📊 Hasil Analyze:", analyzeResponse.data);

        if (analyzeResponse.data.status !== 'ok') {
            return { status: false, message: 'Gagal mendapatkan informasi video.' };
        }

        const vid = analyzeResponse.data.vid;
        const links = format === 'mp4' ? analyzeResponse.data.links.mp4 : analyzeResponse.data.links.mp3;
        const bestQuality = Object.keys(links).map(k => links[k]).pop();

        console.log("🎥 Pilihan kualitas:", bestQuality);

        if (!bestQuality || !bestQuality.k) {
            return { status: false, message: 'Tidak ditemukan kualitas yang tersedia.' };
        }

        const convertResponse = await axios.post(
            'https://www.y2mate.com/mates/convertV2/index',
            `vid=${vid}&k=${bestQuality.k}`, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            }
        );

        console.log("🚀 Hasil Convert:", convertResponse.data);

        if (!convertResponse.data.dlink) {
            return { status: false, message: 'Download URL tidak ditemukan!' };
        }

        return {
            status: true,
            title: analyzeResponse.data.title,
            creator: analyzeResponse.data.a,
            downloadUrl: convertResponse.data.dlink
        };

    } catch (error) {
        console.error("❌ Error:", error);
        return { status: false, message: 'Terjadi kesalahan saat mengambil data Y2Mate' };
    }
}

module.exports = { getY2Mate };
