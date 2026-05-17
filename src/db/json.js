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

export class JSONDB {
        cache = {};
        hasLoaded = false;
        filePath = '';

        constructor(fileName, dir = null) {
                if (!dir) {
                        throw new Error('Directory path must be specified');
                }

                this.filePath = path.join(dir, fileName + '.json');
                this.cache = {};

                if (!fs.existsSync(path.dirname(this.filePath))) {
                        fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
                }
        }

        load() {
                try {
                        if (!fs.existsSync(this.filePath)) {
                                this.cache = {};
                                fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf-8');
                                return;
                        }

                        const bytes = fs.readFileSync(this.filePath, 'utf-8');
                        if (bytes.length > 0) {
                                this.cache = JSON.parse(bytes);
                        } else {
                                this.cache = {};
                        }
                } catch (err) {
                        if (err.code === 'ENOENT') {
                                this.cache = {};
                        } else {
                                throw err;
                        }
                }

                this.hasLoaded = true;
        }

        loadIfNeeded() {
                if (!this.hasLoaded) {
                        this.load();
                }
        }

        exists(key) {
                if (!this.hasLoaded) {
                        this.load();
                }
                return Object.prototype.hasOwnProperty.call(this.cache, key);
        }

        read(key) {
                this.loadIfNeeded();
                if (!this.exists(key)) {
                        return null;
                }

                return this.cache[key];
        }

        write(key, value) {
                this.loadIfNeeded();
                this.cache[key] = value;
                const data = JSON.stringify(this.cache, null, 2);
                fs.writeFileSync(this.filePath, data, 'utf-8');
                return value;
        }

        delete(key) {
                this.loadIfNeeded();
                delete this.cache[key];
                const data = JSON.stringify(this.cache, null, 2);
                fs.writeFileSync(this.filePath, data, 'utf-8');
        }

        keys() {
                this.loadIfNeeded();
                return Object.keys(this.cache);
        }

        values() {
                this.loadIfNeeded();
                return Object.values(this.cache);
        }

        entries() {
                this.loadIfNeeded();
                return Object.entries(this.cache);
        }

        find(predicate) {
                this.loadIfNeeded();
                return this.values().find(predicate);
        }
}

export default JSONDB;
