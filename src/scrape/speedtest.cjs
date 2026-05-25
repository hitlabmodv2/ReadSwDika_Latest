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
'use strict';

/**
 * ─────────────────────────────────────────────────────
 *  FITUR   : Internet Speed Test
 *  Fungsi  : Ukur download, upload, dan ping ke server
 *            Cloudflare Speed (speed.cloudflare.com)
 *            menggunakan axios — tanpa binary eksternal.
 * ─────────────────────────────────────────────────────
 */

const axios = require('axios');

const CF_BASE    = 'https://speed.cloudflare.com';
const CF_DOWN    = `${CF_BASE}/__down`;
const CF_UP      = `${CF_BASE}/__up`;
const CF_META    = `${CF_BASE}/meta`;

const HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
    'Accept'    : '*/*',
};

// ── PING ─────────────────────────────────────────────────────────────────────

async function ukurPing(ulang = 5) {
    const latencies = [];
    for (let i = 0; i < ulang; i++) {
        const t0 = Date.now();
        try {
            await axios.get(`${CF_BASE}/favicon.ico`, {
                headers : HEADERS,
                timeout : 5000,
                validateStatus: () => true,
            });
            latencies.push(Date.now() - t0);
        } catch (_) {}
        if (i < ulang - 1) await new Promise(r => setTimeout(r, 100));
    }
    if (!latencies.length) return null;
    latencies.sort((a, b) => a - b);
    const min    = latencies[0];
    const max    = latencies[latencies.length - 1];
    const avg    = Math.round(latencies.reduce((s, v) => s + v, 0) / latencies.length);
    const jitter = max - min;
    return { min, max, avg, jitter };
}

// ── DOWNLOAD ──────────────────────────────────────────────────────────────────

async function ukurDownload() {
    // Unduh 3 file berbeda ukuran secara berurutan, ambil yang terbaik
    const ukuranList = [
        { bytes: 10_000_000, label: '10MB'  },
        { bytes: 25_000_000, label: '25MB'  },
        { bytes: 100_000_000, label: '100MB' },
    ];

    const hasilMbps = [];

    for (const { bytes } of ukuranList) {
        try {
            const t0 = Date.now();
            const resp = await axios.get(`${CF_DOWN}?bytes=${bytes}`, {
                headers     : HEADERS,
                timeout     : 20000,
                responseType: 'arraybuffer',
            });
            const durMs    = Date.now() - t0;
            const bytesDapat = resp.data.byteLength || bytes;
            const mbps       = (bytesDapat * 8) / (durMs / 1000) / 1_000_000;
            hasilMbps.push(mbps);
        } catch (_) {
            break; // kalau file besar timeout, hentikan
        }
    }

    if (!hasilMbps.length) return null;
    return Math.max(...hasilMbps);
}

// ── UPLOAD ────────────────────────────────────────────────────────────────────

async function ukurUpload() {
    const ukuranList = [
        { bytes: 1_000_000,  label: '1MB'  },
        { bytes: 10_000_000, label: '10MB' },
    ];

    const hasilMbps = [];

    for (const { bytes } of ukuranList) {
        try {
            const data = Buffer.alloc(bytes, 'A');
            const t0   = Date.now();
            await axios.post(CF_UP, data, {
                headers: {
                    ...HEADERS,
                    'Content-Type'  : 'application/octet-stream',
                    'Content-Length': bytes,
                },
                timeout    : 20000,
                maxBodyLength: Infinity,
                validateStatus: () => true,
            });
            const durMs = Date.now() - t0;
            const mbps  = (bytes * 8) / (durMs / 1000) / 1_000_000;
            hasilMbps.push(mbps);
        } catch (_) {
            break;
        }
    }

    if (!hasilMbps.length) return null;
    return Math.max(...hasilMbps);
}

// ── META (ISP / Lokasi) ───────────────────────────────────────────────────────

async function ambilMeta() {
    try {
        // Cloudflare cdn-cgi/trace — plain text, selalu tersedia
        const { data } = await axios.get('https://cloudflare.com/cdn-cgi/trace', {
            headers: HEADERS,
            timeout: 5000,
        });
        const parse = (key) => {
            const m = String(data).match(new RegExp(`^${key}=(.+)$`, 'm'));
            return m ? m[1].trim() : '-';
        };
        const ip    = parse('ip');
        const negara = parse('loc');
        const colo  = parse('colo');
        // ISP dari endpoint ipinfo.io sebagai fallback ringan
        let isp = '-', kota = '-';
        try {
            const ipInfo = await axios.get(`https://ipinfo.io/${ip}/json`, {
                headers: { ...HEADERS, Accept: 'application/json' },
                timeout: 4000,
            });
            isp  = ipInfo.data?.org  || '-';
            kota = ipInfo.data?.city || '-';
        } catch (_) {
            kota = colo; // pakai kode datacenter Cloudflare sebagai fallback
        }
        return { ip, isp, kota, negara };
    } catch (_) {
        return { ip: '-', isp: '-', kota: '-', negara: '-' };
    }
}

// ── LABEL KUALITAS ────────────────────────────────────────────────────────────

function labelKualitas(mbps) {
    if (mbps === null || mbps === undefined) return { teks: 'Gagal', emoji: '❌' };
    if (mbps >= 100)  return { teks: 'Sangat Cepat', emoji: '🚀' };
    if (mbps >= 50)   return { teks: 'Cepat',        emoji: '⚡' };
    if (mbps >= 20)   return { teks: 'Normal',        emoji: '✅' };
    if (mbps >= 5)    return { teks: 'Lumayan',       emoji: '🟡' };
    return              { teks: 'Lambat',        emoji: '🐢' };
}

function labelPing(ms) {
    if (ms === null) return { teks: 'Gagal', emoji: '❌' };
    if (ms < 20)   return { teks: 'Excellent', emoji: '🟢' };
    if (ms < 50)   return { teks: 'Bagus',     emoji: '🟡' };
    if (ms < 100)  return { teks: 'Normal',    emoji: '🟠' };
    return           { teks: 'Tinggi',    emoji: '🔴' };
}

function formatMbps(mbps) {
    if (mbps === null) return 'Gagal';
    return mbps >= 1000
        ? `${(mbps / 1000).toFixed(2)} Gbps`
        : `${mbps.toFixed(2)} Mbps`;
}

// ── JALANKAN SPEEDTEST LENGKAP ────────────────────────────────────────────────

async function jalankanSpeedtest() {
    const mulai = Date.now();

    // Semua berjalan berurutan supaya tidak rebutan bandwidth
    const meta     = await ambilMeta();
    const pingData = await ukurPing(5);
    const dlMbps   = await ukurDownload();
    const ulMbps   = await ukurUpload();

    const durasi = ((Date.now() - mulai) / 1000).toFixed(1);

    return {
        meta,
        ping    : pingData,
        download: dlMbps,
        upload  : ulMbps,
        durasi,
    };
}

// ── GENERATE GAMBAR THUMBNAIL ─────────────────────────────────────────────────

function dlColor(mbps) {
    if (mbps === null) return '#ef4444';
    if (mbps >= 100)  return '#22c55e';
    if (mbps >= 50)   return '#84cc16';
    if (mbps >= 20)   return '#eab308';
    if (mbps >= 5)    return '#f97316';
    return '#ef4444';
}
function pingColor(ms) {
    if (ms === null) return '#ef4444';
    if (ms < 20)  return '#22c55e';
    if (ms < 50)  return '#84cc16';
    if (ms < 100) return '#eab308';
    return '#ef4444';
}

function buatSvg(hasil) {
    const { meta, ping, download, upload, durasi } = hasil;

    const dlVal  = download !== null ? formatMbps(download) : 'N/A';
    const ulVal  = upload   !== null ? formatMbps(upload)   : 'N/A';
    const pgVal  = ping     ? `${ping.avg} ms`              : 'N/A';
    const jitter = ping     ? `${ping.jitter} ms`           : '-';

    const dlC = dlColor(download);
    const ulC = dlColor(upload);
    const pgC = pingColor(ping?.avg ?? null);

    const isp    = (meta.isp || '-').replace(/AS\d+\s*/i, '').slice(0, 28);
    const lokasi = [meta.kota, meta.negara].filter(v => v && v !== '-').join(', ') || '-';
    const ip     = meta.ip || '-';
    const waktu  = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    return `<svg width="640" height="360" xmlns="http://www.w3.org/2000/svg" font-family="Arial,sans-serif">
  <!-- background gradient -->
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"   stop-color="#0f0c29"/>
      <stop offset="50%"  stop-color="#1a1060"/>
      <stop offset="100%" stop-color="#24243e"/>
    </linearGradient>
    <linearGradient id="card" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#ffffff" stop-opacity="0.07"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0.02"/>
    </linearGradient>
  </defs>

  <rect width="640" height="360" fill="url(#bg)"/>

  <!-- header bar -->
  <rect x="0" y="0" width="640" height="52" fill="#141330" opacity="0.8"/>
  <circle cx="28" cy="26" r="14" fill="#141330" stroke="#6366f1" stroke-width="2"/>
  <text x="28" y="31" text-anchor="middle" font-size="15" fill="#6366f1" font-weight="bold">⚡</text>
  <text x="50" y="33" font-size="18" fill="white" font-weight="bold">INTERNET SPEED TEST</text>
  <text x="620" y="33" text-anchor="end" font-size="11" fill="#94a3b8">speed.cloudflare.com</text>

  <!-- 3 metric cards -->
  <!-- DOWNLOAD -->
  <rect x="24" y="72" width="184" height="150" rx="14" fill="url(#card)" stroke="${dlC}" stroke-width="1.5" stroke-opacity="0.5"/>
  <text x="116" y="100" text-anchor="middle" font-size="12" fill="#94a3b8" letter-spacing="2">DOWNLOAD</text>
  <text x="116" y="148" text-anchor="middle" font-size="34" fill="${dlC}" font-weight="bold">${dlVal.replace(' Mbps','').replace(' Gbps','')}</text>
  <text x="116" y="170" text-anchor="middle" font-size="13" fill="${dlC}" opacity="0.8">${dlVal.includes('Gbps') ? 'Gbps' : 'Mbps'}</text>
  <rect x="44" y="182" width="${Math.min(144, download ? Math.round((Math.min(download,1000)/1000)*144) : 0)}" height="5" rx="3" fill="${dlC}" opacity="0.7"/>
  <rect x="44" y="182" width="144" height="5" rx="3" fill="none" stroke="${dlC}" stroke-width="1" opacity="0.2"/>
  <text x="116" y="208" text-anchor="middle" font-size="11" fill="${dlC}">${labelKualitas(download).teks}</text>

  <!-- UPLOAD -->
  <rect x="228" y="72" width="184" height="150" rx="14" fill="url(#card)" stroke="${ulC}" stroke-width="1.5" stroke-opacity="0.5"/>
  <text x="320" y="100" text-anchor="middle" font-size="12" fill="#94a3b8" letter-spacing="2">UPLOAD</text>
  <text x="320" y="148" text-anchor="middle" font-size="34" fill="${ulC}" font-weight="bold">${ulVal.replace(' Mbps','').replace(' Gbps','')}</text>
  <text x="320" y="170" text-anchor="middle" font-size="13" fill="${ulC}" opacity="0.8">${ulVal.includes('Gbps') ? 'Gbps' : 'Mbps'}</text>
  <rect x="248" y="182" width="${Math.min(144, upload ? Math.round((Math.min(upload,1000)/1000)*144) : 0)}" height="5" rx="3" fill="${ulC}" opacity="0.7"/>
  <rect x="248" y="182" width="144" height="5" rx="3" fill="none" stroke="${ulC}" stroke-width="1" opacity="0.2"/>
  <text x="320" y="208" text-anchor="middle" font-size="11" fill="${ulC}">${labelKualitas(upload).teks}</text>

  <!-- PING -->
  <rect x="432" y="72" width="184" height="150" rx="14" fill="url(#card)" stroke="${pgC}" stroke-width="1.5" stroke-opacity="0.5"/>
  <text x="524" y="100" text-anchor="middle" font-size="12" fill="#94a3b8" letter-spacing="2">PING</text>
  <text x="524" y="148" text-anchor="middle" font-size="34" fill="${pgC}" font-weight="bold">${ping ? ping.avg : 'N/A'}</text>
  <text x="524" y="170" text-anchor="middle" font-size="13" fill="${pgC}" opacity="0.8">ms</text>
  <text x="481" y="198" text-anchor="middle" font-size="10" fill="#64748b">MIN</text>
  <text x="481" y="210" text-anchor="middle" font-size="11" fill="${pgC}">${ping ? ping.min+'ms' : '-'}</text>
  <text x="524" y="198" text-anchor="middle" font-size="10" fill="#64748b">MAX</text>
  <text x="524" y="210" text-anchor="middle" font-size="11" fill="${pgC}">${ping ? ping.max+'ms' : '-'}</text>
  <text x="567" y="198" text-anchor="middle" font-size="10" fill="#64748b">JITTER</text>
  <text x="567" y="210" text-anchor="middle" font-size="11" fill="${pgC}">${jitter}</text>

  <!-- info bar bawah -->
  <rect x="0" y="240" width="640" height="120" fill="#0d0b25" opacity="0.6"/>
  <line x1="0" y1="240" x2="640" y2="240" stroke="#6366f1" stroke-width="1" opacity="0.3"/>

  <!-- ISP -->
  <text x="32" y="268" font-size="10" fill="#64748b">ISP</text>
  <text x="32" y="284" font-size="13" fill="#e2e8f0" font-weight="bold">${isp}</text>

  <!-- LOKASI -->
  <text x="240" y="268" font-size="10" fill="#64748b">LOKASI</text>
  <text x="240" y="284" font-size="13" fill="#e2e8f0">${lokasi}</text>

  <!-- IP -->
  <text x="450" y="268" font-size="10" fill="#64748b">IP ADDRESS</text>
  <text x="450" y="284" font-size="13" fill="#e2e8f0">${ip}</text>

  <!-- divider -->
  <line x1="24" y1="298" x2="616" y2="298" stroke="#334155" stroke-width="1"/>

  <!-- footer -->
  <text x="32" y="320" font-size="10" fill="#475569">DURASI TEST</text>
  <text x="32" y="336" font-size="12" fill="#94a3b8">${durasi}s</text>
  <text x="320" y="336" text-anchor="middle" font-size="11" fill="#475569">${waktu} WIB</text>
  <text x="608" y="320" text-anchor="end" font-size="10" fill="#475569">WILY BOT</text>
  <text x="608" y="336" text-anchor="end" font-size="12" fill="#6366f1">Speed Test</text>
</svg>`;
}

async function buatGambar(hasil) {
    const sharp = require('sharp');
    const svg   = buatSvg(hasil);
    return await sharp(Buffer.from(svg)).png().toBuffer();
}

// ── FORMAT CAPTION ────────────────────────────────────────────────────────────

const SEP  = '━━━━━━━━━━━━━━━━━━━━';
const SEP2 = '┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄';

function buatCaption(hasil) {
    const { meta, ping, download, upload, durasi } = hasil;

    const dl      = labelKualitas(download);
    const ul      = labelKualitas(upload);
    const pg      = labelPing(ping?.avg ?? null);

    const waktu   = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

    const dlTeks  = download !== null ? `${formatMbps(download)}  ${dl.emoji} _${dl.teks}_` : '❌ Gagal';
    const ulTeks  = upload   !== null ? `${formatMbps(upload)}  ${ul.emoji} _${ul.teks}_`   : '❌ Gagal';

    const pingBaris = ping
        ? `${ping.avg} ms  ${pg.emoji} _${pg.teks}_\n` +
          `├ 📉 *Min*    : ${ping.min} ms\n` +
          `├ 📈 *Max*    : ${ping.max} ms\n` +
          `╰ 〰️ *Jitter* : ${ping.jitter} ms`
        : '❌ Gagal';

    return (
        `🌐 *INTERNET SPEED TEST*\n` +
        `${SEP}\n\n` +
        `📥 *Download*\n` +
        `╰ ${dlTeks}\n\n` +
        `📤 *Upload*\n` +
        `╰ ${ulTeks}\n\n` +
        `🏓 *Ping*\n` +
        `├ ⚡ *Avg*    : ${pingBaris}\n\n` +
        `${SEP}\n` +
        `📋 *Info Koneksi*\n` +
        `${SEP2}\n` +
        `├ 🌍 *Server*  : speed.cloudflare.com\n` +
        `├ 🏢 *ISP*     : ${meta.isp}\n` +
        `├ 📍 *Lokasi*  : ${meta.kota}, ${meta.negara}\n` +
        `╰ 🔌 *IP*      : ${meta.ip}\n` +
        `${SEP}\n` +
        `⏱️ _Selesai dalam ${durasi}s · ${waktu} WIB_`
    );
}

// ── SIMULASI ──────────────────────────────────────────────────────────────────

async function simulasi() {
    const hasil   = await jalankanSpeedtest();
    const caption = buatCaption(hasil);
    return { caption, hasil };
}

// ── EXPORT ────────────────────────────────────────────────────────────────────

module.exports = {
    jalankanSpeedtest,
    buatCaption,
    buatGambar,
    buatSvg,
    simulasi,
    ukurPing,
    ukurDownload,
    ukurUpload,
    ambilMeta,
    labelKualitas,
    labelPing,
    formatMbps,
};
