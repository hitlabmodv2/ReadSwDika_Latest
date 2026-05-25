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

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const SIGNUP_URL = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key=AIzaSyAxof8_SbpDcww38NEQRhNh0Pzvbphh-IQ';
const CHAT_URL   = 'https://asia-northeast3-gemmy-ai-bdc03.cloudfunctions.net/gemini';

const TOKEN_CACHE_FILE = path.join(process.cwd(), 'data', 'gemini', 'tokens_scrape.json');
fs.mkdirSync(path.join(process.cwd(), 'data', 'gemini'), { recursive: true });

const SIGNUP_HEADERS = {
    'accept-encoding':     'gzip',
    'accept-language':     'in-ID, en-US',
    'connection':          'Keep-Alive',
    'content-type':        'application/json',
    'user-agent':          'Dalvik/2.1.0 (Linux; U; Android 10; SM-J700F Build/QQ3A.200805.001)',
    'x-android-cert':      '037CD2976D308B4EFD63EC63C48DC6E7AB7E5AF2',
    'x-android-package':   'com.jetkite.gemmy',
    'x-client-version':    'Android/Fallback/X24000001/FirebaseCore-Android',
    'x-firebase-appcheck': 'eyJlcnJvciI6IlVOS05PV05fRVJST1IifQ==',
    'x-firebase-client':   'H4sIAAAAAAAAAKtWykhNLCpJSk0sKVayio7VUSpLLSrOzM9TslIyUqoFAFyivEQfAAAA',
    'x-firebase-gmpid':    '1:652803432695:android:c4341db6033e62814f33f2',
};

const FALLBACK_MODELS    = ['gemini-flash-latest', 'gemini-pro-latest', 'gemini-2.5-flash'];
const MAX_TOKEN_ROTATIONS = 5;
const POOL_SIZE           = 3;

class Gemini {
    constructor() {
        this.tokenPool = [];
        this.poolIndex = 0;
        this._loadTokenCache();
    }

    _loadTokenCache() {
        try {
            if (!fs.existsSync(TOKEN_CACHE_FILE)) return;
            const raw  = JSON.parse(fs.readFileSync(TOKEN_CACHE_FILE, 'utf-8'));
            const now  = Date.now();
            this.tokenPool = (raw.pool || []).filter(t => t && t.token && t.expiry && now < t.expiry - 300000);
        } catch (_) {}
    }

    _saveTokenCache() {
        try {
            const dir = path.dirname(TOKEN_CACHE_FILE);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(TOKEN_CACHE_FILE, JSON.stringify({ pool: this.tokenPool, savedAt: Date.now() }));
        } catch (_) {}
    }

    async _signup() {
        const { data } = await axios.post(
            SIGNUP_URL,
            { clientType: 'CLIENT_TYPE_ANDROID' },
            { headers: SIGNUP_HEADERS, timeout: 15000 }
        );
        if (!data.idToken) throw new Error('Failed to get Gemini auth token.');
        return { token: data.idToken, expiry: Date.now() + 3600 * 1000 };
    }

    async _ensurePool() {
        const now    = Date.now();
        const before = this.tokenPool.length;
        this.tokenPool = this.tokenPool.filter(t => t && now < t.expiry - 300000);
        if (this.tokenPool.length !== before) this._saveTokenCache();
        while (this.tokenPool.length < POOL_SIZE) {
            try {
                const t = await this._signup();
                this.tokenPool.push(t);
                this._saveTokenCache();
            } catch (e) {
                if (this.tokenPool.length === 0) throw e;
                break;
            }
        }
    }

    async _getToken({ forceFresh = false } = {}) {
        if (forceFresh) {
            const fresh = await this._signup();
            this.tokenPool.push(fresh);
            this._saveTokenCache();
            this.poolIndex = this.tokenPool.length - 1;
            return fresh.token;
        }
        await this._ensurePool();
        this.poolIndex = (this.poolIndex + 1) % this.tokenPool.length;
        return this.tokenPool[this.poolIndex].token;
    }

    _invalidateToken(token) {
        const before = this.tokenPool.length;
        this.tokenPool = this.tokenPool.filter(t => t.token !== token);
        if (this.tokenPool.length !== before) this._saveTokenCache();
    }

    async getAuthToken() {
        return this._getToken();
    }

    _formatForWhatsApp(text) {
        if (!text) return text;

        let result = text;
        const saved = [];
        const preserve = (str) => { saved.push(str); return `\x00SAVE${saved.length - 1}\x00`; };

        // 1. Simpan triple backtick code block (ga disentuh)
        result = result.replace(/```[\s\S]*?```/g, match => preserve(match));

        // 2. Simpan inline code `...` (ga disentuh)
        result = result.replace(/`[^`\n]+`/g, match => preserve(match));

        // 3. Header # → *Judul* (bold WA), langsung preserve hasil
        result = result.replace(/^#{1,6}\s+(.+)$/gm, (_, t) => preserve(`*${t.trim()}*`));

        // 4. Bold **text** atau __text__ → *text* WA, preserve supaya ga ketabrak italic
        result = result.replace(/\*\*(.+?)\*\*/gs, (_, t) => preserve(`*${t}*`));
        result = result.replace(/__(.+?)__/gs, (_, t) => preserve(`*${t}*`));

        // 5. Italic *text* → _text_ WA (sekarang aman, bold udah dipreserve)
        result = result.replace(/\*([^*\n]+?)\*/g, '_$1_');

        // 6. List unordered - item → • item
        result = result.replace(/^[ \t]*-\s+(.+)$/gm, '• $1');

        // 7. Horizontal rule ---+ → garis WA
        result = result.replace(/^---+$/gm, '───────────────');

        // 8. Kembalikan semua yang dipreserve
        result = result.replace(/\x00SAVE(\d+)\x00/g, (_, i) => saved[parseInt(i)]);

        // 9. Bersihkan trailing whitespace per baris
        result = result.replace(/[ \t]+$/gm, '');

        return result;
    }

    async _callOnce({ token, model, contents, config }) {
        const generationConfig = {
            maxOutputTokens: 8192,
            temperature:     0.7,
            topP:            0.9,
            ...config,
        };
        const { data } = await axios.post(
            CHAT_URL,
            {
                model,
                stream: false,
                request: { contents, generationConfig },
            },
            {
                headers: {
                    'accept-encoding': 'gzip',
                    'authorization':   `Bearer ${token}`,
                    'content-type':    'application/json; charset=UTF-8',
                    'user-agent':      'okhttp/5.3.2',
                },
                timeout: 30000,
            }
        );
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) throw new Error('Gemini returned empty response. Raw: ' + JSON.stringify(data).slice(0, 200));
        return this._formatForWhatsApp(text);
    }

    async chat({ contents, model = 'gemini-flash-latest', ...config }) {
        if (!Array.isArray(contents)) throw new Error('Contents must be an array.');

        const requestedModel = model;
        const modelChain     = [requestedModel, ...FALLBACK_MODELS.filter(m => m !== requestedModel)];

        let lastErr      = null;
        let usedFallback = false;

        for (const m of modelChain) {
            if (m !== requestedModel) {
                console.log(`[Gemini] ⚠️ Fallback: "${requestedModel}" gagal → coba "${m}"`);
                usedFallback = true;
            }

            for (let attempt = 0; attempt < MAX_TOKEN_ROTATIONS; attempt++) {
                let token;
                try {
                    token = await this._getToken({ forceFresh: attempt > 0 });
                } catch (e) {
                    lastErr = e;
                    console.warn(`[Gemini] ❌ Gagal ambil token untuk "${m}" attempt ${attempt + 1}:`, e?.message);
                    break;
                }

                try {
                    const result = await this._callOnce({ token, model: m, contents, config });
                    if (usedFallback) {
                        console.log(`[Gemini] ✅ Berhasil pakai fallback model "${m}" (diminta: "${requestedModel}")`);
                    } else if (attempt > 0) {
                        console.log(`[Gemini] ✅ Berhasil pakai "${m}" setelah ${attempt + 1} percobaan`);
                    }
                    return result;
                } catch (err) {
                    lastErr = err;
                    const status  = err.response?.status;
                    const body    = err.response?.data;
                    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';

                    if (status === 401 || status === 403 || /UNAUTHENTICATED|invalid.?token|expired/i.test(bodyStr)) {
                        console.warn(`[Gemini] 🔑 Token invalid untuk "${m}" attempt ${attempt + 1}, rotate token...`);
                        this._invalidateToken(token);
                        await new Promise(r => setTimeout(r, 300));
                        continue;
                    }

                    if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(bodyStr)) {
                        console.warn(`[Gemini] 🚦 Rate limit/quota "${m}" attempt ${attempt + 1}, tunggu lalu retry...`);
                        this._invalidateToken(token);
                        const wait = Math.min(500 * (attempt + 1), 2500);
                        await new Promise(r => setTimeout(r, wait));
                        continue;
                    }

                    if (status === 404 || /NOT_FOUND|not found/i.test(bodyStr)) {
                        console.warn(`[Gemini] 🔍 Model "${m}" tidak ditemukan (404), skip ke fallback berikutnya`);
                        break;
                    }

                    if (status >= 500 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
                        console.warn(`[Gemini] 🌐 Server error "${m}" attempt ${attempt + 1} (${status || err.code}), retry...`);
                        const wait = Math.min(400 * (attempt + 1), 2000);
                        await new Promise(r => setTimeout(r, wait));
                        continue;
                    }

                    throw new Error(bodyStr ? bodyStr.slice(0, 300) : err.message);
                }
            }
        }

        console.error(`[Gemini] ❌ Semua model gagal. Chain: [${modelChain.join(' → ')}]. Error terakhir:`, lastErr?.message);

        if (lastErr?.response?.data) {
            const body = lastErr.response.data;
            throw new Error(typeof body === 'string' ? body.slice(0, 300) : JSON.stringify(body).slice(0, 300));
        }
        throw new Error(lastErr?.message || 'Gemini request failed after all retries.');
    }

    async analyzeImage(imageBuffer, prompt, { mimeType = 'image/jpeg', model = 'gemini-flash-latest' } = {}) {
        const base64 = Buffer.isBuffer(imageBuffer) ? imageBuffer.toString('base64') : imageBuffer;
        return this.chat({
            model,
            contents: [{
                role:  'user',
                parts: [
                    { inlineData: { mimeType, data: base64 } },
                    { text: prompt },
                ],
            }],
            temperature: 0.6,
        });
    }

    async ask(prompt, { model = 'gemini-flash-latest' } = {}) {
        return this.chat({
            model,
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
        });
    }
}

const singleton = new Gemini();

module.exports = { Gemini, gemini: singleton };
