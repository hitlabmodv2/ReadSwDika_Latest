/**
 * ───────────────────────────────
 *  Base Script : Bang Dika Ardnt
 *  Recode By   : Bang Wilykun
 *  WhatsApp    : 6289688206739
 *  Telegram    : @Wilykun1994
 * ───────────────────────────────
 */
'use strict';

const https = require('https');
const http  = require('http');

const BASE_URL   = 'https://api.siputzx.my.id/api/canvas';
const DEFAULT_BG = 'https://i.ibb.co/4YBNyvP/images-76.jpg';

// ─── Parameter builder per versi ──────────────────────────────────────────────
// Setiap versi punya parameter API yang berbeda, disesuaikan persis dari docs
// { username, groupName, groupIconUrl, memberCount, avatarUrl }

const WELCOME_BUILDERS = [
        // v1 — username, guildName, guildIcon, memberCount, avatar, background, quality
        (d) => ({
                username:    d.username,
                guildName:   d.groupName,
                guildIcon:   d.groupIconUrl || '',
                memberCount: d.memberCount  || '',
                avatar:      d.avatarUrl    || '',
                background:  DEFAULT_BG,
                quality:     80,
        }),
        // v2 — username, guildName, memberCount, avatar, background
        (d) => ({
                username:    d.username,
                guildName:   d.groupName,
                memberCount: d.memberCount || '',
                avatar:      d.avatarUrl   || '',
                background:  DEFAULT_BG,
        }),
        // v3 — username, avatar (minimal)
        (d) => ({
                username: d.username,
                avatar:   d.avatarUrl || '',
        }),
        // v4 — avatar, background, description
        (d) => ({
                avatar:      d.avatarUrl || '',
                background:  DEFAULT_BG,
                description: `Welcome to ${d.groupName}!`,
        }),
        // v5 — username, guildName, memberCount, avatar, background, quality
        (d) => ({
                username:    d.username,
                guildName:   d.groupName,
                memberCount: d.memberCount || '',
                avatar:      d.avatarUrl   || '',
                background:  DEFAULT_BG,
                quality:     90,
        }),
];

const GOODBYE_BUILDERS = [
        // v1 — username, guildName, guildIcon, memberCount, avatar, background, quality
        (d) => ({
                username:    d.username,
                guildName:   d.groupName,
                guildIcon:   d.groupIconUrl || '',
                memberCount: d.memberCount  || '',
                avatar:      d.avatarUrl    || '',
                background:  DEFAULT_BG,
                quality:     80,
        }),
        // v2 — username, guildName, memberCount, avatar, background
        (d) => ({
                username:    d.username,
                guildName:   d.groupName,
                memberCount: d.memberCount || '',
                avatar:      d.avatarUrl   || '',
                background:  DEFAULT_BG,
        }),
        // v3 — username, avatar (minimal)
        (d) => ({
                username: d.username,
                avatar:   d.avatarUrl || '',
        }),
        // v4 — avatar, background, title, description, border, avatarBorder, overlayOpacity
        (d) => ({
                avatar:         d.avatarUrl || '',
                background:     DEFAULT_BG,
                title:          'Goodbye',
                description:    `Goodbye from ${d.groupName}!`,
                border:         '#2a2e35',
                avatarBorder:   '#2a2e35',
                overlayOpacity: 0.3,
        }),
        // v5 — username, guildName, memberCount, avatar, background, quality
        (d) => ({
                username:    d.username,
                guildName:   d.groupName,
                memberCount: d.memberCount || '',
                avatar:      d.avatarUrl   || '',
                background:  DEFAULT_BG,
                quality:     90,
        }),
];

const VERSION_NAMES = ['v1', 'v2', 'v3', 'v4', 'v5'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fetchImage(url, ms = 15000) {
        return new Promise((resolve, reject) => {
                const mod = url.startsWith('https') ? https : http;
                const req = mod.get(url, {
                        headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                                'Accept': 'image/jpeg,image/png,image/*,*/*',
                        }
                }, (res) => {
                        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
                                return fetchImage(res.headers.location, ms).then(resolve).catch(reject);
                        if (res.statusCode !== 200)
                                return reject(new Error('HTTP ' + res.statusCode));
                        const ct = res.headers['content-type'] || '';
                        if (!ct.includes('image') && !ct.includes('octet-stream'))
                                return reject(new Error('Bukan gambar, content-type: ' + ct));
                        const mimetype = ct.includes('jpeg') ? 'image/jpeg' : 'image/png';
                        const c = [];
                        res.on('data', d => c.push(d));
                        res.on('end', () => resolve({ buffer: Buffer.concat(c), mimetype }));
                        res.on('error', reject);
                });
                req.on('error', reject);
                req.setTimeout(ms, () => { req.destroy(); reject(new Error('timeout')); });
        });
}

function buildUrl(endpoint, params) {
        const qs = Object.entries(params)
                .filter(([, v]) => v !== null && v !== undefined && v !== '')
                .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
                .join('&');
        return `${BASE_URL}/${endpoint}?${qs}`;
}

function pickRandom(n) {
        return Math.floor(Math.random() * n);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function createWelcomeCard({ name, groupName, avatarUrl, groupIconUrl, type = 'welcome', memberCount = null }) {
        const isWelcome = type === 'welcome';
        const builders  = isWelcome ? WELCOME_BUILDERS : GOODBYE_BUILDERS;
        const prefix    = isWelcome ? 'welcome' : 'goodbye';

        const idx     = pickRandom(builders.length);   // random 0-4
        const version = prefix + VERSION_NAMES[idx];   // e.g. welcomev3

        const data = {
                username:    name        || 'Anggota',
                groupName:   groupName   || 'Grup',
                avatarUrl:   avatarUrl   || '',
                groupIconUrl: groupIconUrl || '',
                memberCount: memberCount !== null ? memberCount : '',
        };

        const params = builders[idx](data);
        const url    = buildUrl(version, params);

        console.info(`\x1b[35m[Card]\x1b[0m ${isWelcome ? '\x1b[32mWELCOME' : '\x1b[33mGOODBYE'}\x1b[0m › \x1b[36m${version}\x1b[0m`);

        const { buffer, mimetype } = await fetchImage(url);
        return { buffer, mimetype };
}

module.exports = { createWelcomeCard };
