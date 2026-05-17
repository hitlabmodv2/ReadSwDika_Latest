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
import { toCapitalize } from './text.js';
import { loadConfig } from './utils.js';

export function getTelegramConfig() {
        const config = loadConfig();
        return config.telegram || { enabled: false, token: '', chatId: '' };
}

export async function send(chatId, media = '', options = {}) {
        const telegramConfig = getTelegramConfig();
        const token = telegramConfig.token;
        
        if (!token) {
                throw new Error('Telegram token not configured');
        }
        
        const type = options.type.replace('image', 'photo').replace('audio', 'voice');

        const DEFAULT_EXTENSIONS = {
                audio: ['audio/mp3', 'mp3'],
                photo: ['image/jpeg', 'jpg'],
                sticker: ['image/webp', 'webp'],
                video: ['video/mp4', 'mp4'],
                document: ['application/pdf', 'pdf'],
                voice: ['audio/ogg', 'ogg'],
                text: ['text/plain', 'txt'],
        };

        const url = `https://api.telegram.org/bot${token}/send${
                type === 'text' ? 'Message' : toCapitalize(type)
        }`;
        const form = new FormData();

        form.append('chat_id', chatId);
        if (options.parse_mode) form.append('parse_mode', options.parse_mode);
        if (type === 'text') form.append(type, media || options.caption);
        else {
                if (Buffer.isBuffer(media)) {
                        form.append(type, new Blob([media], { type: DEFAULT_EXTENSIONS[type][0] }), `file.${DEFAULT_EXTENSIONS[type][1]}`);
                } else {
                        throw new Error('Invalid media input: must be a Buffer or a valid file path');
                }

                if (options.caption) form.append('caption', options.caption);
        }

        const res = await fetch(url, {
                method: 'POST',
                body: form,
        });

        const data = await res.json();

        return data;
}
