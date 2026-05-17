'use strict';

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

const SIGNUP_URL = 'https://www.googleapis.com/identitytoolkit/v3/relyingparty/signupNewUser?key=AIzaSyAxof8_SbpDcww38NEQRhNh0Pzvbphh-IQ';
const CHAT_URL   = 'https://asia-northeast3-gemmy-ai-bdc03.cloudfunctions.net/gemini';

const TOKEN_CACHE_FILE = path.join(process.cwd(), 'data', 'gemini', 'tokens_scrape.json');
const fs = require('fs');
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

const FALLBACK_MODELS    = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-pro-latest'];
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
        return text;
    }

    async chat({ contents, model = 'gemini-flash-latest', ...config }) {
        if (!Array.isArray(contents)) throw new Error('Contents must be an array.');

        const requestedModel = model;
        const modelChain     = [requestedModel, ...FALLBACK_MODELS.filter(m => m !== requestedModel)];

        let lastErr = null;

        for (const m of modelChain) {
            for (let attempt = 0; attempt < MAX_TOKEN_ROTATIONS; attempt++) {
                let token;
                try {
                    token = await this._getToken({ forceFresh: attempt > 0 });
                } catch (e) {
                    lastErr = e;
                    break;
                }

                try {
                    return await this._callOnce({ token, model: m, contents, config });
                } catch (err) {
                    lastErr = err;
                    const status  = err.response?.status;
                    const body    = err.response?.data;
                    const bodyStr = body ? (typeof body === 'string' ? body : JSON.stringify(body)) : '';

                    if (status === 401 || status === 403 || /UNAUTHENTICATED|invalid.?token|expired/i.test(bodyStr)) {
                        this._invalidateToken(token);
                        await new Promise(r => setTimeout(r, 300));
                        continue;
                    }

                    if (status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(bodyStr)) {
                        this._invalidateToken(token);
                        const wait = Math.min(500 * (attempt + 1), 2500);
                        await new Promise(r => setTimeout(r, wait));
                        continue;
                    }

                    if (status === 404 || /NOT_FOUND|not found/i.test(bodyStr)) {
                        break;
                    }

                    if (status >= 500 || err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ECONNABORTED') {
                        const wait = Math.min(400 * (attempt + 1), 2000);
                        await new Promise(r => setTimeout(r, wait));
                        continue;
                    }

                    throw new Error(bodyStr ? bodyStr.slice(0, 300) : err.message);
                }
            }
        }

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
