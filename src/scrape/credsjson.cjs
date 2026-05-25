'use strict';

const fs   = require('fs');
const path = require('path');
const pino = require('pino');

const CREDS_BASE_DIR = path.join(process.cwd(), 'credsjson');
const PAIRING_TIMEOUT_MS = 3 * 60 * 1000;

const silentLogger = pino({ level: 'silent' });

/**
 * Format pairing code → XXXX-XXXX
 */
function formatPairingCode(code) {
    const clean = String(code).replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (clean.length === 8) return clean.slice(0, 4) + '-' + clean.slice(4);
    return clean.match(/.{1,4}/g)?.join('-') || clean;
}

/**
 * Buat & jalankan sesi WhatsApp khusus credsjson.
 * Session disimpan di credsjson/[number]/
 * Setelah terhubung → kirim creds.json → hapus folder otomatis.
 *
 * @param {string} number       - nomor WA (62xxx)
 * @param {object} opts
 *   onPairingCode(code, fmt)   - dipanggil saat pairing code siap
 *   onConnected(buf, number)   - dipanggil setelah terhubung, berikan Buffer creds.json
 *   onTimeout()                - dipanggil saat waktu habis (3 menit)
 *   onError(err)               - dipanggil saat error
 *   customPairingCode          - kode custom (opsional)
 */
async function startCredsJsonSession(number, opts = {}) {
    const {
        onPairingCode = () => {},
        onConnected   = () => {},
        onTimeout     = () => {},
        onError       = () => {},
        customPairingCode,
    } = opts;

    number = String(number).replace(/[^0-9]/g, '');

    const sessionDir = path.join(CREDS_BASE_DIR, number);
    fs.mkdirSync(sessionDir, { recursive: true });

    const {
        default: makeWASocket,
        fetchLatestBaileysVersion,
        useMultiFileAuthState,
    } = require('socketon');

    const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
    const { version }          = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth            : { creds: state.creds, keys: state.keys },
        logger          : silentLogger,
        printQRInTerminal: false,
        browser         : ['Ubuntu', 'Chrome', '136.0.7103.93'],
        keepAliveIntervalMs: 30_000,
    });

    let pairingRequested = false;
    let connected        = false;
    let aborted          = false;

    function cleanup() {
        aborted = true;
        try { sock.ev.removeAllListeners(); } catch {}
        try { if (sock.ws) sock.ws.close(); } catch {}
        // Hapus folder credsjson/[number]/
        try { fs.rmSync(sessionDir, { recursive: true, force: true }); } catch {}
    }

    // Timeout 3 menit jika belum terhubung
    const timeoutHandle = setTimeout(async () => {
        if (connected || aborted) return;
        cleanup();
        try { await onTimeout(); } catch {}
    }, PAIRING_TIMEOUT_MS);

    sock.ev.on('creds.update', async (...args) => {
        try { await saveCreds(...args); } catch {}
    });

    sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
        if (aborted) return;

        // ── Generate pairing code saat connecting pertama kali ──
        if (connection === 'connecting' && !state.creds?.registered && !pairingRequested) {
            pairingRequested = true;
            setTimeout(async () => {
                if (aborted) return;
                let retries = 3;
                while (retries-- > 0) {
                    try {
                        const code = await sock.requestPairingCode(
                            number,
                            customPairingCode ? String(customPairingCode).toUpperCase() : undefined
                        );
                        if (aborted) return;
                        const fmt = formatPairingCode(code);
                        await onPairingCode(code, fmt);
                        return;
                    } catch (e) {
                        if (retries === 0) {
                            try { await onError(e); } catch {}
                        } else {
                            await new Promise(r => setTimeout(r, 1000));
                        }
                    }
                }
            }, 1500);
        }

        // ── Terhubung ──
        if (connection === 'open' && !connected) {
            connected = true;
            clearTimeout(timeoutHandle);

            // Tunggu creds tersimpan ke disk
            setTimeout(async () => {
                try {
                    const credsPath = path.join(sessionDir, 'creds.json');
                    if (!fs.existsSync(credsPath)) throw new Error('creds.json tidak ditemukan setelah connect');
                    const buf = fs.readFileSync(credsPath);
                    await onConnected(buf, number);
                } catch (e) {
                    try { await onError(e); } catch {}
                } finally {
                    cleanup();
                }
            }, 2500);
        }

        // ── Koneksi putus sebelum berhasil ──
        if (connection === 'close' && !connected && !aborted) {
            const code = lastDisconnect?.error?.output?.statusCode;
            // 401 = logged out / invalid → bersihkan
            if (code === 401) {
                clearTimeout(timeoutHandle);
                cleanup();
                try { await onError(new Error('Sesi tidak valid / ditolak WhatsApp (401)')); } catch {}
            }
        }
    });

    return {
        abort() { clearTimeout(timeoutHandle); cleanup(); },
    };
}

/**
 * Bersihkan format nomor → 62xxx (tanpa +, spasi, dash, dll)
 */
function cleanNomor(nomor) {
    let n = String(nomor).replace(/\D/g, '');
    n = n.replace(/^0+/, '');
    if (n.startsWith('6262')) n = n.slice(2);
    if (!n.startsWith('62')) n = '62' + n;
    return n;
}

/**
 * Baca creds.json langsung dari folder credsjson/[number]/
 */
function readCredsBuffer(number) {
    const p = path.join(CREDS_BASE_DIR, number, 'creds.json');
    if (!fs.existsSync(p)) throw new Error(`creds.json tidak ada di: ${p}`);
    return fs.readFileSync(p);
}

/**
 * Hapus folder credsjson/[number]/
 */
async function deleteCredsFolder(number) {
    const dir = path.join(CREDS_BASE_DIR, number);
    if (fs.existsSync(dir)) {
        await fs.promises.rm(dir, { recursive: true, force: true });
    }
}

module.exports = {
    startCredsJsonSession,
    cleanNomor,
    readCredsBuffer,
    deleteCredsFolder,
    formatPairingCode,
};
