'use strict';

const fs            = require('fs');
const path          = require('path');
const pino          = require('pino');
const { execFile }  = require('child_process');
const os            = require('os');

const CREDS_BASE_DIR    = path.join(process.cwd(), 'credsjson');
const PAIRING_TIMEOUT_MS = 3 * 60 * 1000;
const PREKEY_WAIT_MS     = 25_000;   // tunggu pre-key generate
const PREKEY_POLL_MS     = 1_000;    // cek tiap 1 detik

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
 * Tunggu sampai pre-key files muncul di sessionDir.
 * Return true jika ada, false jika timeout.
 */
async function waitForPrekeys(sessionDir, maxWaitMs) {
    const deadline = Date.now() + maxWaitMs;
    while (Date.now() < deadline) {
        const files = fs.readdirSync(sessionDir).filter(f => f.startsWith('pre-key-'));
        if (files.length > 0) return true;
        await new Promise(r => setTimeout(r, PREKEY_POLL_MS));
    }
    return false;
}

/**
 * Buat zip dari semua file JSON di sessionDir menggunakan tar.
 * Return Buffer .tar.gz
 */
function packSessionToBuffer(sessionDir) {
    return new Promise((resolve, reject) => {
        const tmpOut = path.join(os.tmpdir(), `cj_session_${Date.now()}.tar.gz`);
        const files  = fs.readdirSync(sessionDir).filter(f => f.endsWith('.json'));
        if (!files.length) return reject(new Error('Tidak ada file session JSON'));

        execFile('tar', ['-czf', tmpOut, '-C', sessionDir, ...files], (err) => {
            if (err) return reject(new Error(`tar gagal: ${err.message}`));
            try {
                const buf = fs.readFileSync(tmpOut);
                fs.unlinkSync(tmpOut);
                resolve(buf);
            } catch (e) {
                reject(e);
            }
        });
    });
}

/**
 * Buat & jalankan sesi WhatsApp khusus credsjson.
 * Session disimpan di credsjson/[number]/
 * Setelah terhubung → tunggu semua file → kirim session.tar.gz → hapus folder.
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
        auth             : { creds: state.creds, keys: state.keys },
        logger           : silentLogger,
        printQRInTerminal: false,
        browser          : ['Ubuntu', 'Chrome', '136.0.7103.93'],
        keepAliveIntervalMs: 30_000,
        syncFullHistory  : true,
    });

    let pairingRequested = false;
    let connected        = false;
    let aborted          = false;

    function cleanup() {
        aborted = true;
        try { sock.ev.removeAllListeners(); } catch {}
        try { if (sock.ws) sock.ws.close(); } catch {}
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

            // Tunggu pre-key files generate (maks 25 detik)
            setTimeout(async () => {
                try {
                    await waitForPrekeys(sessionDir, PREKEY_WAIT_MS);

                    // Hitung semua file yang ada
                    const allFiles = fs.readdirSync(sessionDir).filter(f => f.endsWith('.json'));
                    const buf = await packSessionToBuffer(sessionDir);

                    await onConnected(buf, number, allFiles.length);
                } catch (e) {
                    try { await onError(e); } catch {}
                } finally {
                    cleanup();
                }
            }, 2000);
        }

        // ── Koneksi putus sebelum berhasil ──
        if (connection === 'close' && !connected && !aborted) {
            const code = lastDisconnect?.error?.output?.statusCode;
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
 * Bersihkan format nomor → 62xxx
 */
function cleanNomor(nomor) {
    let n = String(nomor).replace(/\D/g, '');
    n = n.replace(/^0+/, '');
    if (n.startsWith('6262')) n = n.slice(2);
    if (!n.startsWith('62')) n = '62' + n;
    return n;
}

module.exports = {
    startCredsJsonSession,
    cleanNomor,
    formatPairingCode,
};
