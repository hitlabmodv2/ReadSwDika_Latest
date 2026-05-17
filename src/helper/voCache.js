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
'use strict'

import fs from 'fs'
import path from 'path'

const CACHE_DIR = path.join(process.cwd(), 'tmp', 'vocache')
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000

function ensureCacheDir() {
        if (!fs.existsSync(CACHE_DIR)) {
                fs.mkdirSync(CACHE_DIR, { recursive: true })
        }
}

function bufferPath(msgId) {
        return path.join(CACHE_DIR, `${msgId}.bin`)
}

function metaPath(msgId) {
        return path.join(CACHE_DIR, `${msgId}.json`)
}

export function hasViewOnceCache(msgId) {
        return fs.existsSync(bufferPath(msgId)) && fs.existsSync(metaPath(msgId))
}

export function saveViewOnceCache(msgId, buffer, meta = {}) {
        try {
                ensureCacheDir()
                fs.writeFileSync(bufferPath(msgId), buffer)
                fs.writeFileSync(metaPath(msgId), JSON.stringify({ ...meta, savedAt: Date.now() }))
                console.log(`\x1b[36m[VOCache]\x1b[0m Disimpan: ${msgId} (${meta.mediaType || '?'})`)
                return true
        } catch (err) {
                console.error('\x1b[31m[VOCache] Gagal simpan:\x1b[0m', err.message)
                return false
        }
}

export function getViewOnceCache(msgId) {
        try {
                if (!hasViewOnceCache(msgId)) return null
                const buffer = fs.readFileSync(bufferPath(msgId))
                const meta = JSON.parse(fs.readFileSync(metaPath(msgId), 'utf-8'))
                return { buffer, meta }
        } catch (err) {
                console.error('\x1b[31m[VOCache] Gagal baca:\x1b[0m', err.message)
                return null
        }
}

export function deleteViewOnceCache(msgId) {
        try {
                if (fs.existsSync(bufferPath(msgId))) fs.unlinkSync(bufferPath(msgId))
                if (fs.existsSync(metaPath(msgId))) fs.unlinkSync(metaPath(msgId))
        } catch {}
}

export function cleanOldViewOnceCache() {
        try {
                ensureCacheDir()
                const files = fs.readdirSync(CACHE_DIR)
                const now = Date.now()
                let deleted = 0

                const ids = new Set()
                for (const file of files) {
                        const base = file.replace(/\.(bin|json)$/, '')
                        ids.add(base)
                }

                for (const id of ids) {
                        const meta = metaPath(id)
                        if (fs.existsSync(meta)) {
                                try {
                                        const { savedAt } = JSON.parse(fs.readFileSync(meta, 'utf-8'))
                                        if (now - savedAt > MAX_CACHE_AGE_MS) {
                                                deleteViewOnceCache(id)
                                                deleted++
                                        }
                                } catch {
                                        deleteViewOnceCache(id)
                                        deleted++
                                }
                        } else {
                                deleteViewOnceCache(id)
                                deleted++
                        }
                }

                if (deleted > 0) {
                        console.log(`\x1b[36m[VOCache]\x1b[0m Cleanup: ${deleted} cache lama dihapus`)
                }
        } catch (err) {
                console.error('\x1b[31m[VOCache] Cleanup error:\x1b[0m', err.message)
        }
}
