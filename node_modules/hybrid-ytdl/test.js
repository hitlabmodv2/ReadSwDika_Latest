const readline = require('readline');
const { getVideoInfo, downloadAudio, downloadVideo, servers } = require('./index'); // Import servers

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function main() {
    rl.question('Masukkan URL YouTube: ', async (url) => {
        console.log('🔍 Mengambil informasi video...');
        const info = await getVideoInfo(url);
        if (!info.status) {
            console.log('❌ Gagal mendapatkan informasi video.');
            return rl.close();
        }

        console.log(info);

        rl.question('Ingin download (1) Audio atau (2) Video? ', async (choice) => {
            rl.question('Pilih API (1-5, kosong untuk otomatis): ', async (apiChoice) => {
                apiChoice = apiChoice.trim();
                const apiKey = servers[`api${apiChoice}`] ? `api${apiChoice}` : null; // FIXED

                if (choice === '1') {
                    rl.question('Masukkan bitrate (default: 128): ', async (bitrate) => {
                        bitrate = bitrate.trim() || '128';
                        console.log(`🎵 Mengambil link audio dengan bitrate ${bitrate}kbps...`);
                        const result = await downloadAudio(url, bitrate, apiKey);
                        console.log(result);
                        rl.close();
                    });

                } else if (choice === '2') {
                    rl.question('Masukkan resolusi (default: 720): ', async (resolution) => {
                        resolution = resolution.trim() || '720';
                        console.log(`📹 Mengambil link video dengan resolusi ${resolution}p...`);
                        const result = await downloadVideo(url, resolution, apiKey);
                        console.log(result);
                        rl.close();
                    });

                } else {
                    console.log('❌ Pilihan tidak valid.');
                    rl.close();
                }
            });
        });
    });
}

main();
