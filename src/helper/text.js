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
export const isNumber = value => {
        value = Number(value);
        return !isNaN(value) && typeof value === 'number';
};

export const toLower = (text = '') => text.toLowerCase().trim();
export const toUpper = (text = '') => text.toUpperCase().trim();
export const toCapitalize = (text = '') => text.charAt(0).toUpperCase() + text.slice(1).trim();
export const toCapitalizeWords = (text = '') =>
        text
                .replace(/([a-z])([A-Z])/g, '$1 $2')
                .replace(/\b([A-Z]{2,})\b/g, word => word)
                .replace(/\b[a-z]/g, char => char.toUpperCase())
                .trim();
export const toCapitalizeSentence = (text = '') => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase().trim();
export const toCapitalizeParagraph = (text = '') =>
        text.replace(/(^\w{1}|\.\s+\w{1})/gi, char => char.toUpperCase()).trim();
export const separateWords = text => toCapitalize(text.replace(/([A-Z]+[a-z0-9])/g, ' $1').trim()).trim();

export const df = date =>
        new Intl.DateTimeFormat('id-ID', { dateStyle: 'full', timeStyle: 'long' }).format(date).replace(/\./g, ':');
