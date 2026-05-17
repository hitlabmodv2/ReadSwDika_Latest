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
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const { extractMessageContent, getContentType } = _require('socketon');

const configPath = path.join(process.cwd(), 'config.json');

export function loadConfig() {
        try {
                if (fs.existsSync(configPath)) {
                        return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                }
        } catch (err) {
                console.error('\x1b[31m[Config] Error loading config:\x1b[39m', err.message);
        }
        return {};
}

export function saveConfig(config) {
        try {
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
                return true;
        } catch (err) {
                console.error('\x1b[31m[Config] Error saving config:\x1b[39m', err.message);
                return false;
        }
}

export function updateConfig(key, value) {
        const config = loadConfig();
        config[key] = { ...config[key], ...value };
        return saveConfig(config);
}

export function parseMessage(content) {
        let extract = extractMessageContent(content);

        if (extract && extract.viewOnceMessageV2Extension) {
                extract = extract.viewOnceMessageV2Extension.message;
        }
        if (extract && extract.protocolMessage && [14, 5, 9, 0].includes(extract.protocolMessage.type)) {
                const type = getContentType(extract.protocolMessage);
                extract = extract.protocolMessage[type];
        }
        if (extract && extract.message) {
                const type = getContentType(extract.message);
                extract = extract.message[type];
        }

        return extract || content || {};
}

export function parseMention(text = '', isGroup = false) {
        if (!text) return [];

        if (typeof text == 'object' && (text.mentionedJid || text.groupMentions)) {
                const mentions = [];
                if (Array.isArray(text.mentionedJid)) mentions.push(...text.mentionedJid);
                if (Array.isArray(text.groupMentions)) text.groupMentions.forEach(v => mentions.push(v.groupJid));
                return mentions;
        }

        const regGroup = /@((\d+)-?(\d+)@g\.us)/g;
        const regUser = /@([0-9]{5,16}|0)/g;
        if (isGroup || regGroup.test(text)) {
                return Array.from(new Set([...text.match(regGroup)]))
                        .filter(Boolean)
                        .map(v => v.replace(/^@/, ''));
        }

        if (regUser.test(text)) {
                return Array.from(new Set([...text.matchAll(/@([0-9]{5,16}|0)/g)]?.map(v => v?.[1] + '@s.whatsapp.net'))).filter(
                        Boolean
                );
        }

        return [];
}

export function msToTime(milliseconds) {
        const roundTowardsZero = milliseconds > 0 ? Math.floor : Math.ceil;
        const res = {
                day: roundTowardsZero(milliseconds / 86400000),
                hour: roundTowardsZero(milliseconds / 3600000) % 24,
                minute: roundTowardsZero(milliseconds / 60000) % 60,
                second: roundTowardsZero(milliseconds / 1000) % 60,
        };

        const result = [];
        for (const key in res) {
                result.push(`${res[key]} ${key.length < 1 ? key : key + 's'}`);
        }

        return result.join(', ');
}

export function escapeRegExp(string = '') {
        return string.replace(/[.*=+:\-?^${}()|[\]\\]|\s/g, '\\$&').replace(/-/g, '\\x2d');
}

export const getCaseName = fileOrCode => {
        return new Promise((resolve, reject) => {
                const regex = /case\s+['"`]?(.*?)['"`]?\s*:/g;
                let matches = [];

                if (!fs.existsSync(fileOrCode)) {
                        let match;
                        while ((match = regex.exec(fileOrCode)) !== null) {
                                matches.push(match[1]);
                        }

                        return resolve(matches);
                }

                const readStream = fs.createReadStream(fileOrCode);

                readStream.on('data', chunk => {
                        let match;
                        while ((match = regex.exec(chunk)) !== null) {
                                matches.push(match[1]);
                        }
                });

                readStream.on('end', () => {
                        readStream.destroy();
                        resolve(Array.from(new Set(matches)));
                });
        });
};
