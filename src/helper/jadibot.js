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

import { createRequire } from 'module';
const _require = createRequire(import.meta.url);
const {
  default: makeWASocket,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  delay,
  Browsers
} = _require('socketon');

import fs from 'fs'
import path from 'path'
import pino from 'pino'
import QRCode from 'qrcode'
import { execFile } from 'child_process'
import { getRandomEmoji } from '../helper/emoji.js'
import { injectClient } from '../helper/inject.js'
import messageHandler from '../handler/message.js'
import JSONDB from '../db/json.js'
import { cleanStaleSessionFiles } from './cleaner.js'
import { logError } from '../db/errorLog.js'
import { getJadibotAnticall, getJadibotAnticallvid, getJadibotNumber } from './jadibotSettings.js'

/* ================= LOGGER ================= */
const silentLogger = pino({ level: 'silent' })

/* ================= KONSTANTA ================= */
const PAIRING_TIMEOUT_MS = 3 * 60 * 1000 // 3 menit
const DEFAULT_JADIBOT_DURATION_MS = 24 * 60 * 60 * 1000
const MAX_TIMER_MS = 2147483647
const JADIBOT_DATA_PATH = path.join(process.cwd(), 'data', 'jadibot', 'realtime.json')
fs.mkdirSync(path.join(process.cwd(), 'data', 'jadibot'), { recursive: true })
const JADIBOT_EXPIRY_WARNING_THRESHOLDS = [
  { ms: 10 * 60 * 1000, label: '10 menit' },
  { ms: 5 * 60 * 1000, label: '5 menit' },
  { ms: 60 * 1000, label: '1 menit' },
  { ms: 30 * 1000, label: '30 detik' }
]

/* ================= STATE ================= */
const jadibotMap = new Map()
const jadibotConnectedAt = new Map()
const startingSocketMap = new Map()
const pairingRequested = new Set()
const stoppingJadibot = new Set()
const expiringJadibot = new Set()
const reconnectingJadibot = new Set()
const activeOrStartingJadibot = new Set()
const pairingTimeout = new Map()
const pendingJadibotChoices = new Map()
const expiryTimers = new Map()
const expiryWarningTimers = new Map()

/* ================= UTILS ================= */
function loadConfig() {
  try {
    const p = path.join(process.cwd(), 'config.json')
    if (fs.existsSync(p)) return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {}
  return {}
}

function maskNumber(num) {
  const n = num.replace(/[^0-9]/g, '')
  if (n.length <= 6) return n
  return n.slice(0, 4) + '****' + n.slice(-4)
}

function isSessionValid(sessionDir) {
  return fs.existsSync(path.join(sessionDir, 'creds.json'))
}

function ensureJadibotDataDir() {
  fs.mkdirSync(path.dirname(JADIBOT_DATA_PATH), { recursive: true })
}

function loadJadibotRealtimeData() {
  try {
    ensureJadibotDataDir()
    if (!fs.existsSync(JADIBOT_DATA_PATH)) return { bots: {} }
    const parsed = JSON.parse(fs.readFileSync(JADIBOT_DATA_PATH, 'utf-8'))
    if (!parsed || typeof parsed !== 'object') return { bots: {} }
    if (!parsed.bots || typeof parsed.bots !== 'object') parsed.bots = {}
    return parsed
  } catch {
    return { bots: {} }
  }
}

const TOKEN_SECRET_PATH = path.join(process.cwd(), '.token.secret')
const REPO_LAST_PATH    = path.join(process.cwd(), '.repo.last')
let _backupTimer = null

function scheduleDataBackup() {
  if (_backupTimer) {
    clearTimeout(_backupTimer)
    _backupTimer = null
  }
  _backupTimer = setTimeout(() => {
    _backupTimer = null
    _runDataBackup()
  }, 60_000)
}

function _runDataBackup() {
  try {
    const token = fs.existsSync(TOKEN_SECRET_PATH)
      ? fs.readFileSync(TOKEN_SECRET_PATH, 'utf-8').trim()
      : ''
    if (!token || token.length < 10) return

    const repoLast = fs.existsSync(REPO_LAST_PATH)
      ? fs.readFileSync(REPO_LAST_PATH, 'utf-8').trim()
      : ''

    let user = '', repo = ''
    if (repoLast) {
      const m = repoLast.match(/github\.com\/([^/]+)\/([^/\s]+)/)
      if (m) { user = m[1]; repo = m[2].replace(/\.git$/, '') }
    }
    if (!user || !repo) {
      try {
        const { execFileSync } = _require('child_process')
        const remoteUrl = execFileSync('git', ['remote', 'get-url', 'origin'], { encoding: 'utf-8' }).trim()
        const m = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/\s]+?)(?:\.git)?$/)
        if (m) { user = m[1]; repo = m[2] }
      } catch { return }
    }
    if (!user || !repo) return

    const remoteWithToken = `https://${user}:${token}@github.com/${user}/${repo}.git`
    const cwd = process.cwd()
    const git = (args, opts = {}) => new Promise((resolve) => {
      execFile('git', args, { cwd, ...opts }, (err, stdout, stderr) => resolve({ err, stdout, stderr }))
    })

    ;(async () => {
      try {
        await git(['add', '-f', 'data'])
        const { stdout: diffOut } = await git(['diff', '--cached', '--name-only'])
        if (!diffOut.trim()) return
        const ts = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', hour12: false })
        await git(['commit', '-m', `chore: auto-backup data [${ts}]`])
        await git(['push', remoteWithToken, 'HEAD'])
        console.log(`[AutoBackup] ✅ data/ berhasil di-push ke GitHub`)
      } catch (e) {
        console.log(`[AutoBackup] ⚠️ Gagal backup: ${e?.message || e}`)
      }
    })()
  } catch (e) {
    console.log(`[AutoBackup] ⚠️ Error: ${e?.message || e}`)
  }
}

function saveJadibotRealtimeData(data) {
  ensureJadibotDataDir()
  const tmpPath = `${JADIBOT_DATA_PATH}.tmp`
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmpPath, JADIBOT_DATA_PATH)
  scheduleDataBackup()
}

function formatDurationMs(ms) {
  const totalMinutes = Math.max(1, Math.round(ms / 60000))
  if (totalMinutes % 1440 === 0) return `${totalMinutes / 1440} hari`
  if (totalMinutes % 60 === 0) return `${totalMinutes / 60} jam`
  return `${totalMinutes} menit`
}

function formatRemainingTime(ms) {
  if (!Number.isFinite(ms) || ms <= 0) return 'kedaluwarsa'
  const totalSeconds = Math.ceil(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const parts = []
  if (days) parts.push(`${days} hari`)
  if (hours) parts.push(`${hours} jam`)
  if (minutes) parts.push(`${minutes} menit`)
  if (seconds && !days) parts.push(`${seconds} detik`)
  if (!parts.length) parts.push(`${seconds} detik`)
  return parts.slice(0, 4).join(' ')
}

function formatJadibotExpiryTime(timestamp) {
  const value = Number(timestamp)
  if (!Number.isFinite(value) || value <= 0) return 'belum tercatat'
  return new Date(value).toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).replace(/\./g, ':') + ' WIB'
}

function clearJadibotExpiryWarningTimers(number) {
  number = String(number || '').replace(/[^0-9]/g, '')
  const timers = expiryWarningTimers.get(number) || []
  for (const timer of timers) clearTimeout(timer)
  expiryWarningTimers.delete(number)
}

function msgJadibotExpiryWarning(number, remainingText, expiresAtText, durationLabel = '1 hari') {
  return (
    `╔══════════════════════╗\n` +
    `║  ⚠️  *JADIBOT HAMPIR HABIS* ║\n` +
    `╚══════════════════════╝\n\n` +
    `📱 *Nomor:* +${maskNumber(number)}\n` +
    `⏳ *Sisa waktu:* ${remainingText}\n` +
    `📅 *Habis pada:* ${expiresAtText}\n\n` +
    `⚠️ Masa aktif jadibot hampir habis.\n` +
    `Bot akan otomatis berhenti dan sesi dihapus saat waktunya habis.\n\n` +
    `💡 Perpanjang dengan:\n` +
    `*.jadibot ${number} ${durationLabel}*`
  )
}

async function sendDirectJadibotNotice(sock, number, text) {
  if (!sock || !number || !text) return
  try {
    await sock.sendMessage(`${number}@s.whatsapp.net`, { text })
  } catch {}
}

function getJadibotExpirySummary(number) {
  const meta = getJadibotExpiry(number)
  if (!meta) {
    return {
      remaining: 'Tidak diketahui',
      expiresAtText: 'Tidak diketahui',
      durationText: 'Tidak diketahui',
      status: 'unknown'
    }
  }
  if (meta.permanent === true) {
    return {
      remaining: 'Permanent',
      expiresAtText: 'Permanent',
      durationText: 'Permanent',
      status: 'permanent'
    }
  }
  const remainingMs = Number(meta.expiresAt) - Date.now()
  return {
    remaining: formatRemainingTime(remainingMs),
    expiresAtText: formatJadibotExpiryTime(meta.expiresAt),
    durationText: meta.durationText || formatDurationMs(Number(meta.durationMs) || DEFAULT_JADIBOT_DURATION_MS),
    status: remainingMs <= 0 ? 'expired' : (meta.status || 'active')
  }
}

function parseJadibotDuration(input = '') {
  const clean = String(input || '').trim().toLowerCase()
  if (!clean) {
    return {
      ms: DEFAULT_JADIBOT_DURATION_MS,
      label: formatDurationMs(DEFAULT_JADIBOT_DURATION_MS),
      isDefault: true
    }
  }
  // p = singkatan permanent
  if (['permanent', 'permanen', 'perm', 'perma', 'selamanya', 'p'].includes(clean)) {
    return {
      ms: 'permanent',
      label: 'Permanent',
      permanent: true,
      isDefault: false
    }
  }
  // m=menit, j=jam, h=hari, d=hari
  const match = clean.match(/^(\d+)\s*(menit|mnt|min|minute|minutes|m|jam|hour|hours|j|hari|day|days|h|d)$/i)
  if (!match) return null
  const value = Number(match[1])
  if (!Number.isSafeInteger(value) || value <= 0) return null
  const unit = match[2].toLowerCase()
  let multiplier = 60000 // default: menit
  if (['jam', 'hour', 'hours', 'j'].includes(unit)) multiplier = 60 * 60000
  if (['hari', 'day', 'days', 'h', 'd'].includes(unit)) multiplier = 24 * 60 * 60000
  const ms = value * multiplier
  if (!Number.isSafeInteger(ms) || ms <= 0) return null
  return { ms, label: formatDurationMs(ms), isDefault: false }
}

function getJadibotExpiry(number) {
  number = String(number || '').replace(/[^0-9]/g, '')
  const data = loadJadibotRealtimeData()
  return data.bots[number] || null
}

function setPermanentJadibot(number, status = 'active') {
  number = String(number || '').replace(/[^0-9]/g, '')
  if (expiryTimers.has(number)) {
    clearTimeout(expiryTimers.get(number))
    expiryTimers.delete(number)
  }
  clearJadibotExpiryWarningTimers(number)
  const now = Date.now()
  const data = loadJadibotRealtimeData()
  const existing = data.bots[number] || {}
  data.bots[number] = {
    ...existing,
    number,
    permanent: true,
    status,
    createdAt: existing.createdAt || now,
    updatedAt: now,
    expiresAt: undefined,
    durationMs: undefined,
    durationText: 'Permanent',
    isPaused: undefined,
    pausedAt: undefined,
    pausedRemainingMs: undefined,
  }
  saveJadibotRealtimeData(data)
  return data.bots[number]
}

function ensureJadibotExpiry(number, durationMs = null, status = 'starting') {
  number = String(number || '').replace(/[^0-9]/g, '')
  const now = Date.now()
  const data = loadJadibotRealtimeData()
  const existing = data.bots[number]
  if (existing?.permanent === true) {
    existing.status = status
    existing.updatedAt = now
    data.bots[number] = existing
    saveJadibotRealtimeData(data)
    return existing
  }
  if (existing && Number(existing.expiresAt) > now) {
    existing.status = status
    existing.updatedAt = now
    data.bots[number] = existing
    saveJadibotRealtimeData(data)
    return existing
  }
  const ms = Number(durationMs) > 0 ? Number(durationMs) : DEFAULT_JADIBOT_DURATION_MS
  const meta = {
    number,
    createdAt: now,
    updatedAt: now,
    expiresAt: now + ms,
    durationMs: ms,
    durationText: formatDurationMs(ms),
    status
  }
  data.bots[number] = meta
  saveJadibotRealtimeData(data)
  return meta
}

function extendJadibotExpiry(number, addedDurationMs, status = 'active') {
  number = String(number || '').replace(/[^0-9]/g, '')
  const addMs = Number(addedDurationMs)
  if (!number || !Number.isSafeInteger(addMs) || addMs <= 0) return null
  const now = Date.now()
  const data = loadJadibotRealtimeData()
  const existing = data.bots[number] || null
  const oldExpiresAt = existing?.permanent === true ? now : (Number(existing?.expiresAt) || 0)
  const baseExpiresAt = oldExpiresAt > now ? oldExpiresAt : now
  const oldRemainingMs = Math.max(0, baseExpiresAt - now)
  const newExpiresAt = baseExpiresAt + addMs
  const totalRemainingMs = Math.max(0, newExpiresAt - now)
  const meta = {
    ...(existing || {}),
    number,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    expiresAt: newExpiresAt,
    durationMs: totalRemainingMs,
    durationText: formatDurationMs(totalRemainingMs),
    addedDurationMs: addMs,
    addedDurationText: formatDurationMs(addMs),
    previousRemainingMs: oldRemainingMs,
    previousRemainingText: formatRemainingTime(oldRemainingMs),
    status
  }
  data.bots[number] = meta
  saveJadibotRealtimeData(data)
  return meta
}

function updateJadibotExpiryStatus(number, status) {
  number = String(number || '').replace(/[^0-9]/g, '')
  const data = loadJadibotRealtimeData()
  if (!data.bots[number]) return null
  data.bots[number].status = status
  data.bots[number].updatedAt = Date.now()
  saveJadibotRealtimeData(data)
  return data.bots[number]
}

function persistConnectedAt(number, ts) {
  number = String(number || '').replace(/[^0-9]/g, '')
  const data = loadJadibotRealtimeData()
  if (!data.bots[number]) return
  data.bots[number].connectedAt = ts
  saveJadibotRealtimeData(data)
}

function restoreConnectedAtMap() {
  const data = loadJadibotRealtimeData()
  for (const [number, meta] of Object.entries(data.bots || {})) {
    if (meta?.connectedAt && !jadibotConnectedAt.has(number)) {
      jadibotConnectedAt.set(number, Number(meta.connectedAt))
    }
  }
}

function removeJadibotExpiry(number) {
  number = String(number || '').replace(/[^0-9]/g, '')
  if (expiryTimers.has(number)) {
    clearTimeout(expiryTimers.get(number))
    expiryTimers.delete(number)
  }
  clearJadibotExpiryWarningTimers(number)
  const data = loadJadibotRealtimeData()
  if (data.bots[number]) {
    delete data.bots[number]
    saveJadibotRealtimeData(data)
  }
}

function isJadibotExpired(number) {
  const meta = getJadibotExpiry(number)
  if (!meta) return false
  if (meta.permanent === true) return false
  return Number(meta.expiresAt) <= Date.now()
}

function msgJadibotExpired(number) {
  return (
    `╔══════════════════════╗\n` +
    `║  ⏰  *JADIBOT EXPIRED* ║\n` +
    `╚══════════════════════╝\n\n` +
    `📱 *Nomor:* +${maskNumber(number)}\n\n` +
    `❌ Masa berlaku jadibot sudah habis.\n` +
    `🗑️ Sesi dan data jadibot otomatis dihapus realtime.\n\n` +
    `💡 Ketik *.jadibot ${number} 1 hari* untuk aktifkan lagi.`
  )
}

async function expireJadibot(number, sendReply = null) {
  number = String(number || '').replace(/[^0-9]/g, '')

  // Guard: cegah double-expiry untuk nomor yang sama (race condition)
  if (expiringJadibot.has(number)) return
  expiringJadibot.add(number)
  stoppingJadibot.add(number)

  const sessionDir = path.join(process.cwd(), 'jadibot', number)
  const sock = jadibotMap.get(number)
  const expiredMsg = msgJadibotExpired(number)

  // Cek mode pairing untuk tentukan kemana notif expired dikirim
  const expiryCfg = loadConfig()
  const expiryMode = (expiryCfg.jadibotPairingMode || 'v2').toLowerCase()

  if (expiryMode === 'v2') {
    // V2: kirim notif expired ke nomor tujuan SEBELUM socket ditutup
    if (sock) {
      try {
        await sock.sendMessage(`${number}@s.whatsapp.net`, { text: expiredMsg })
      } catch {}
    }
  } else {
    // V1: kirim notif expired ke GC/owner
    if (sendReply) {
      try {
        await sendReply(expiredMsg)
      } catch {}
    }
  }

  // Langkah 3: tutup socket
  try {
    if (sock) {
      sock.ev.removeAllListeners()
      if (sock.ws) sock.ws.close()
    }
  } catch {}

  // Langkah 4: bersihkan semua Map/Set
  jadibotMap.delete(number)
  pairingRequested.delete(number)
  reconnectingJadibot.delete(number)
  activeOrStartingJadibot.delete(number)
  if (pairingTimeout.has(number)) {
    clearTimeout(pairingTimeout.get(number))
    pairingTimeout.delete(number)
  }
  if (typeof global.autoStartedJadibot !== 'undefined') {
    global.autoStartedJadibot.delete(number)
  }

  // Langkah 5: hapus data expiry dari JSON
  removeJadibotExpiry(number)

  // Langkah 6: hapus folder sesi (delay 500ms beri waktu socket close)
  setTimeout(() => {
    try {
      if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true })
    } catch {}
  }, 500)

  // Langkah 7: lepas guard setelah selesai
  setTimeout(() => {
    stoppingJadibot.delete(number)
    expiringJadibot.delete(number)
  }, 2000)

  console.log(`[JADIBOT] ⏰ ${number} expired → notif terkirim → sesi dihapus realtime`)
}

async function cleanupExpiredJadibots(sendReply = null) {
  const expired = []
  const data = loadJadibotRealtimeData()
  const now = Date.now()
  const numbers = new Set([
    ...jadibotMap.keys(),
    ...Object.keys(data.bots || {})
  ])
  for (const number of numbers) {
    const meta = data.bots?.[number]
    if (meta && Number(meta.expiresAt) <= now) {
      expired.push(number)
      await expireJadibot(number, sendReply)
    }
  }
  return expired
}

function scheduleJadibotExpiry(number, sendReply = null) {
  number = String(number || '').replace(/[^0-9]/g, '')
  const meta = getJadibotExpiry(number)
  if (!meta) return
  if (meta.permanent === true) return
  if (expiryTimers.has(number)) {
    clearTimeout(expiryTimers.get(number))
    expiryTimers.delete(number)
  }
  clearJadibotExpiryWarningTimers(number)
  const remaining = Number(meta.expiresAt) - Date.now()
  if (remaining <= 0) {
    expireJadibot(number, sendReply)
    return
  }
  const warningTimers = []
  for (const threshold of JADIBOT_EXPIRY_WARNING_THRESHOLDS) {
    const delayMs = remaining - threshold.ms
    if (delayMs <= 0 || delayMs > MAX_TIMER_MS) continue
    const warningTimer = setTimeout(async () => {
      const latest = getJadibotExpiry(number)
      if (!latest) return
      const latestRemaining = Number(latest.expiresAt) - Date.now()
      if (latestRemaining <= 0 || latestRemaining > threshold.ms + 15000) return
      const durationLabel = latest.durationText || formatDurationMs(Number(latest.durationMs) || DEFAULT_JADIBOT_DURATION_MS)
      const warningText = msgJadibotExpiryWarning(
        number,
        formatRemainingTime(latestRemaining),
        formatJadibotExpiryTime(latest.expiresAt),
        durationLabel
      )
      const warningCfg = loadConfig()
      const warningMode = (warningCfg.jadibotPairingMode || 'v2').toLowerCase()
      if (warningMode === 'v2') {
        // V2: kirim warning ke nomor tujuan (via sock jadibot itu sendiri)
        await sendDirectJadibotNotice(jadibotMap.get(number), number, warningText)
      } else {
        // V1: kirim warning ke GC/owner
        if (sendReply) {
          try { await sendReply(warningText) } catch {}
        }
      }
    }, delayMs)
    warningTimers.push(warningTimer)
  }
  if (warningTimers.length) expiryWarningTimers.set(number, warningTimers)
  const timer = setTimeout(() => {
    if (isJadibotExpired(number)) {
      expireJadibot(number, sendReply)
    } else {
      scheduleJadibotExpiry(number, sendReply)
    }
  }, Math.min(remaining, MAX_TIMER_MS))
  expiryTimers.set(number, timer)
}

function purgeExpiredJadibotSessions() {
  const data = loadJadibotRealtimeData()
  const now = Date.now()
  const expired = []
  for (const [number, meta] of Object.entries(data.bots)) {
    if (meta?.permanent === true) continue
    if (Number(meta?.expiresAt) <= now) expired.push(number)
  }
  for (const number of expired) {
    const sessionDir = path.join(process.cwd(), 'jadibot', number)
    try {
      if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true })
    } catch {}
    delete data.bots[number]
    if (typeof global.autoStartedJadibot !== 'undefined') {
      global.autoStartedJadibot.delete(number)
    }
  }
  saveJadibotRealtimeData(data)
  return expired
}

function formatPairingCode(code) {
  // Format: XXXX-XXXX supaya lebih mudah dibaca
  const clean = String(code).replace(/[^A-Z0-9]/gi, '').toUpperCase()
  if (clean.length === 8) return clean.slice(0, 4) + '-' + clean.slice(4)
  return code
}

/* ================= PESAN RAPIH ================= */
function msgPairingCode(code, number) {
  const formatted = formatPairingCode(code)
  const masked = maskNumber(number)
  return (
    `╔══════════════════════╗\n` +
    `║   🤖  *J A D I B O T*   ║\n` +
    `╚══════════════════════╝\n\n` +
    `📱 *Nomor:* ${masked}\n\n` +
    `🔑 *Kode Pairing:*\n` +
    `┌─────────────────┐\n` +
    `│   *${formatted}*   │\n` +
    `└─────────────────┘\n\n` +
    `📋 *Cara Memasukkan Kode:*\n` +
    `1️⃣ Buka WhatsApp di HP kamu\n` +
    `2️⃣ Ketuk ⋮ (titik tiga) → *Perangkat Tertaut*\n` +
    `3️⃣ Ketuk *Tautkan Perangkat*\n` +
    `4️⃣ Pilih *Tautkan dengan nomor telepon*\n` +
    `5️⃣ Masukkan kode di atas\n\n` +
    `⏳ *Batas waktu: 3 menit*\n` +
    `⚠️ Jika gagal, ketik *.jadibot* ulang`
  )
}

function msgCopyCode(code, number) {
  const formatted = formatPairingCode(code)
  const masked = maskNumber(number)
  return {
    interactiveMessage: {
      title:
        `╔══════════════════════╗\n` +
        `║   🤖  *J A D I B O T*   ║\n` +
        `╚══════════════════════╝\n\n` +
        `📱 *Nomor:* ${masked}\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `📋 *Cara Memasukkan Kode:*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `1️⃣ Buka *WhatsApp* di HP kamu\n` +
        `2️⃣ Ketuk ⋮ → *Perangkat Tertaut*\n` +
        `3️⃣ Ketuk *Tautkan Perangkat*\n` +
        `4️⃣ Pilih *Tautkan dengan nomor telepon*\n` +
        `5️⃣ Masukkan kode pairing di atas\n\n` +
        `⏳ Kode berlaku *3 menit*\n` +
        `⚠️ Gagal? Ketik *.jadibot* lagi`,
      footer: `📲 Tap tombol untuk salin kode · +${number}`,
      buttons: [
        {
          name: 'cta_copy',
          buttonParamsJson: JSON.stringify({
            display_text: '📋 Salin Kode Pairing',
            copy_code: formatted
          })
        }
      ]
    }
  }
}

function msgPairingExpired(number) {
  const masked = maskNumber(number)
  return (
    `╔══════════════════════╗\n` +
    `║   ⏰  *WAKTU HABIS*   ║\n` +
    `╚══════════════════════╝\n\n` +
    `📱 *Nomor:* ${masked}\n\n` +
    `❌ Kode pairing sudah *kedaluwarsa*\n` +
    `karena tidak digunakan dalam *3 menit*.\n\n` +
    `🔄 Sesi otomatis dihapus.\n` +
    `💡 Ketik *.jadibot ${number}* untuk coba lagi.`
  )
}

function msgConnected(number) {
  const masked = maskNumber(number)
  const now = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })

  const config = loadConfig()
  const story = config.autoReadStory || {}
  const storyOn = story.enabled !== false
  const reactOn = storyOn && story.autoReaction !== false
  const expiry = getJadibotExpiry(number)
  const expiryLine = expiry
    ? `⏳ *Masa Berlaku:* ${formatRemainingTime(Number(expiry.expiresAt) - Date.now())}\n`
    : ''

  let swStatus
  if (!storyOn) {
    swStatus = `❌ *AutoRead SW:* Nonaktif`
  } else if (reactOn) {
    swStatus = `✅ *AutoRead SW:* Aktif — Mode *Read + Reaction* 🎉`
  } else {
    swStatus = `✅ *AutoRead SW:* Aktif — Mode *Read Only* 👁️`
  }

  return (
    `╔══════════════════════╗\n` +
    `║  ✅  *JADIBOT AKTIF*  ║\n` +
    `╚══════════════════════╝\n\n` +
    `📱 *Nomor:* ${masked}\n` +
    `🕐 *Waktu:* ${now} WIB\n\n` +
    expiryLine +
    `🎉 Jadibot berhasil terhubung!\n` +
    `Bot sudah siap menerima perintah.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 *Status Fitur Otomatis:*\n` +
    `${swStatus}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `🛠️ *Fitur Jadibot:*\n` +
    `• 👁️ Auto baca & reaction story/SW kontak\n` +
    `• 🔕 Anti-delete pesan (jika aktif)\n` +
    `• 🤖 Semua command bot bisa diakses\n` +
    `   _(hanya oleh owner via bot utama)_\n\n` +
    `📌 *Kontrol Jadibot (dari bot utama):*\n` +
    `• *.menu* — Lihat semua fitur\n` +
    `• *.readsw* — Kelola AutoRead SW\n` +
    `• *.stopbot ${number}* — Matikan jadibot\n` +
    `• *.listbot* — Daftar jadibot aktif\n\n` +
    `_Powered by Wily Bot_ 🤖`
  )
}

function msgDirectWelcome(number) {
  const now = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
  const expiry = getJadibotExpiry(number)
  let expiryLine = ''
  if (expiry?.permanent === true) {
    expiryLine = `♾️ *Masa berlaku:* Permanent\n`
  } else if (expiry?.expiresAt) {
    const remaining = Number(expiry.expiresAt) - Date.now()
    if (remaining > 0) {
      expiryLine = `⏳ *Aktif selama:* ${formatRemainingTime(remaining)}\n`
    }
  }
  return (
    `╔══════════════════════╗\n` +
    `║  🤖  *J A D I B O T*  ║\n` +
    `╚══════════════════════╝\n\n` +
    `🎉 *Nomor kamu sudah aktif sebagai Jadibot!*\n\n` +
    `📱 *Nomor:* +${number}\n` +
    `🕐 *Aktif:* ${now} WIB\n` +
    expiryLine +
    `\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛠️ *Fitur yang aktif di nomormu:*\n` +
    `• 👁️ Auto baca & reaction status/SW\n` +
    `• 🔕 Anti-delete pesan\n` +
    `• 🤖 Semua fitur bot tersedia\n\n` +
    `📌 *Command tersedia (kirim ke bot utama):*\n` +
    `• *.p* / *.ping* — Cek bot aktif\n` +
    `• *.menu* — Daftar semua fitur\n` +
    `• *.readsw* — Kelola auto baca status\n` +
    `• *.antidel* — Anti hapus pesan\n` +
    `• *.sticker* — Buat stiker\n` +
    `• *.stopbot ${number}* — Matikan jadibot\n\n` +
    `⚠️ _Jangan logout dari Perangkat Tertaut_\n` +
    `_agar jadibot tetap aktif._\n\n` +
    `_Powered by Wily Bot_ 🤖`
  )
}

function msgLoggedOut(number, remainingList) {
  const masked = maskNumber(number)
  const now = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })

  let listPart
  if (remainingList.length === 0) {
    listPart = `❌ Tidak ada jadibot aktif saat ini.`
  } else {
    const items = remainingList.map((v, i) => `│ ${i + 1}. +${v}`).join('\n')
    listPart = (
      `📊 *Jadibot Masih Aktif (${remainingList.length}):*\n` +
      `┌─────────────────────\n` +
      `${items}\n` +
      `└─────────────────────`
    )
  }

  return (
    `╔══════════════════════╗\n` +
    `║  ⚠️  *JADIBOT LOGOUT*  ║\n` +
    `╚══════════════════════╝\n\n` +
    `📱 *Nomor:* ${masked}\n` +
    `🕐 *Waktu:* ${now} WIB\n\n` +
    `🚨 Jadibot ini telah *di-logout* dari\n` +
    `WhatsApp (Perangkat Tertaut dihapus).\n\n` +
    `🗑️ Sesi otomatis dihapus.\n\n` +
    `${listPart}\n\n` +
    `💡 Ketik *.jadibot ${number}* untuk\n` +
    `menghubungkan kembali.`
  )
}

function msgLoggedOutDirect(number) {
  const now = new Date().toLocaleString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  })
  return (
    `╔══════════════════════╗\n` +
    `║  ⚠️  *JADIBOT LOGOUT*  ║\n` +
    `╚══════════════════════╝\n\n` +
    `📱 *Nomor kamu:* +${number}\n` +
    `🕐 *Waktu:* ${now} WIB\n\n` +
    `🚨 *Jadibot kamu telah logout!*\n` +
    `Nomor kamu dihapus dari Perangkat Tertaut\n` +
    `atau melakukan logout dari sisi WhatsApp.\n\n` +
    `🗑️ Sesi jadibot otomatis dihapus.\n\n` +
    `💡 Hubungi owner untuk aktifkan kembali.`
  )
}

/* ================= START JADIBOT ================= */
async function startJadibot(number, sendReply, mainBotNumber, editMsg = null, sendPairingMsg = null, durationMs = undefined, mainBotSock = null, reactFn = null) {
  number = number.replace(/[^0-9]/g, '')
  const hasRequestedDuration = durationMs !== undefined && durationMs !== null

  if (hasRequestedDuration) {
    removeJadibotExpiry(number)
  } else if (isJadibotExpired(number)) {
    await expireJadibot(number, sendReply)
    return
  }

  if (activeOrStartingJadibot.has(number)) {
    if (jadibotMap.has(number)) {
      console.log(`\x1b[33m[JADIBOT]\x1b[0m ⚠️ ${number} sudah aktif/dalam proses start, skip duplikat`)
      return
    }
    // Nomor sedang dalam proses pairing tapi belum terhubung → tutup socket lama & reset state
    console.log(`\x1b[33m[JADIBOT]\x1b[0m 🔁 ${number} pairing stuck → tutup socket lama & coba ulang`)
    const oldSock = startingSocketMap.get(number)
    if (oldSock) {
      try {
        oldSock.ev.removeAllListeners()
        if (oldSock.ws) oldSock.ws.close()
      } catch {}
      startingSocketMap.delete(number)
    }
    activeOrStartingJadibot.delete(number)
    pairingRequested.delete(number)
    if (pairingTimeout.has(number)) {
      clearTimeout(pairingTimeout.get(number))
      pairingTimeout.delete(number)
    }
    // Tunggu sebentar agar socket lama selesai sebelum buat yang baru
    await delay(800)
  }
  activeOrStartingJadibot.add(number)
  if (!hasRequestedDuration && getJadibotExpiry(number)) {
    updateJadibotExpiryStatus(number, 'starting')
    scheduleJadibotExpiry(number, sendReply)
  }

  if (typeof global.autoStartedJadibot !== 'undefined') {
    global.autoStartedJadibot.add(number)
  }

  const sessionDir = path.join(process.cwd(), 'jadibot', number)

  fs.mkdirSync(sessionDir, { recursive: true })

  // Bersihkan pre-key stale & session lama sebelum load
  cleanStaleSessionFiles(sessionDir)

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: state.keys,
    },
    logger: silentLogger,
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '136.0.7103.93'],
    keepAliveIntervalMs: 30000,
    syncFullHistory: true,
  })

  sock.isMainBot = false
  sock.mainBotNumber = mainBotNumber

  injectClient(
    sock,
    new Map(),
    new JSONDB('contacts', sessionDir),
    new JSONDB('groups', sessionDir),
    new JSONDB('settings', sessionDir)
  )

  sock.ev.on('creds.update', async (...args) => {
    try { await saveCreds(...args) } catch {}
  })

  // Daftarkan socket ke startingSocketMap selama belum connected
  startingSocketMap.set(number, sock)

  /* ================= CONNECTION ================= */
  let pairingMsgKey = null
  let aborted = false
  let hasConnectedOnce = false

  function cleanupSocket() {
    aborted = true
    try {
      sock.ev.removeAllListeners()
      if (sock.ws) sock.ws.close()
    } catch {}
  }

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    const reason = lastDisconnect?.error?.output?.statusCode

    /* ===== PAIRING CODE — TIMEOUT 3 MENIT ===== */
    if (
      connection === 'connecting' &&
      !state.creds?.registered &&
      !pairingRequested.has(number)
    ) {
      pairingRequested.add(number)

      // Kirim kode pairing setelah koneksi stabil (dengan retry)
      setTimeout(async () => {
        await delay(1000) // tunggu socket stabil
        let retries = 3
        while (retries > 0) {
          if (aborted) break
          try {
            const cfg = loadConfig()
            const customCode = cfg.pairingCode && String(cfg.pairingCode).trim() ? String(cfg.pairingCode).trim().toUpperCase() : undefined
            const code = await sock.requestPairingCode(number, customCode)
            if (aborted) break

            // Cek mode pairing dari config
            const pairingMode = (cfg.jadibotPairingMode || 'v2').toLowerCase()
            // v1 = kirim pairing code ke GC/owner chat
            // v2 = kirim pairing code langsung ke nomor tujuan (private)

            let directPairingSent = false

            if (pairingMode === 'v2' && mainBotSock) {
              // ── V2: Kirim kode langsung ke nomor tujuan ──
              try {
                const fmt = formatPairingCode(code)
                await mainBotSock.sendMessage(`${number}@s.whatsapp.net`, {
                  text:
                    `╔══════════════════════╗\n` +
                    `║   🤖  *J A D I B O T*  ║\n` +
                    `╚══════════════════════╝\n\n` +
                    `🔑 *Kode Pairing untuk nomormu:*\n\n` +
                    `┌─────────────────┐\n` +
                    `│   *${fmt}*   │\n` +
                    `└─────────────────┘\n\n` +
                    `📋 *Cara memasukkan kode:*\n` +
                    `1️⃣ Buka WhatsApp di HP kamu\n` +
                    `2️⃣ Ketuk ⋮ → *Perangkat Tertaut*\n` +
                    `3️⃣ Ketuk *Tautkan Perangkat*\n` +
                    `4️⃣ Pilih *Tautkan dengan nomor telepon*\n` +
                    `5️⃣ Masukkan kode di atas\n\n` +
                    `⏳ *Kode berlaku 3 menit*\n\n` +
                    `\`\`\`${fmt}\`\`\``
                })
                directPairingSent = true
                console.log(`[JADIBOT][V2] ✅ Pairing code terkirim realtime ke +${number}`)

                // Notif singkat ke owner bahwa kode sudah dikirim ke nomor tujuan
                try {
                  const sentInfo = await sendReply(
                    `╔══════════════════════╗\n` +
                    `║   🤖  *J A D I B O T*  ║\n` +
                    `╚══════════════════════╝\n\n` +
                    `✅ *Kode pairing berhasil dikirim!*\n\n` +
                    `📱 Kode langsung dikirim ke nomor:\n` +
                    `*+${number}*\n\n` +
                    `⏳ Suruh mereka segera buka kode tersebut\n` +
                    `dan masukkan di WhatsApp → Perangkat Tertaut.\n\n` +
                    `_Berlaku 3 menit_`
                  )
                  if (sentInfo?.key) pairingMsgKey = sentInfo.key
                } catch {}
              } catch (e) {
                console.log(`[JADIBOT][V2] ⚠️ Gagal kirim pairing code ke +${number}: ${e?.message}`)
              }
            }

            // ── V1 atau fallback jika V2 gagal: kirim kode ke GC/owner chat ──
            if (!directPairingSent) {
              if (sendPairingMsg) {
                const sentInfo = await sendPairingMsg(code, number)
                if (sentInfo?.key) pairingMsgKey = sentInfo.key
              } else {
                // V1: pakai plain text langsung (interactiveMessage/tombol tidak bekerja di GC)
                try {
                  const sentInfo = await sendReply(msgPairingCode(code, number))
                  if (sentInfo?.key) pairingMsgKey = sentInfo.key
                } catch (e) {
                  console.log(`[JADIBOT][V1] ⚠️ Gagal kirim pairing code ke GC: ${e?.message}`)
                }
              }
              if (pairingMode === 'v1') console.log(`[JADIBOT][V1] ✅ Pairing code terkirim ke GC/owner`)
            }
            break
          } catch (err) {
            if (aborted) break
            retries--
            console.error(`[JADIBOT] Gagal request pairing code ${number} (sisa retry: ${retries}):`, err?.message)
            if (retries > 0) await delay(2000)
          }
        }
        if (!aborted && retries === 0) {
          try {
            await sendReply(
              `╔══════════════════════╗\n` +
              `║   ❌  *GAGAL PAIRING*   ║\n` +
              `╚══════════════════════╝\n\n` +
              `⚠️ Gagal mendapatkan kode pairing untuk *${maskNumber(number)}*.\n` +
              `Koneksi terputus sebelum kode berhasil dibuat.\n\n` +
              `💡 Ketik *.jadibot ${number}* untuk coba lagi.`
            )
          } catch {}
        }
      }, 2000)

      // ⏱️ AUTO STOP setelah 3 MENIT jika belum terhubung
      const timeout = setTimeout(async () => {
        if (state.creds?.registered || jadibotMap.has(number)) return

        console.log(`[JADIBOT] ⏰ Pairing timeout 3 menit → ${number} → sesi dihapus`)

        pairingRequested.delete(number)
        pairingTimeout.delete(number)
        activeOrStartingJadibot.delete(number)
        startingSocketMap.delete(number)

        // Tutup socket
        cleanupSocket()

        // Hapus sesi
        setTimeout(() => {
          if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true })
          }
          removeJadibotExpiry(number)
        }, 500)

        // Kirim notif ke pengirim
        try {
          await sendReply(msgPairingExpired(number))
        } catch {}
      }, PAIRING_TIMEOUT_MS)

      pairingTimeout.set(number, timeout)
    }

    /* ===== CONNECTED ===== */
    if (connection === 'open') {
      hasConnectedOnce = true
      const isFreshPairing = pairingRequested.has(number)
      const _connectTs = Date.now()
      jadibotMap.set(number, sock)
      jadibotConnectedAt.set(number, _connectTs)
      persistConnectedAt(number, _connectTs)
      startingSocketMap.delete(number)
      pairingRequested.delete(number)
      if (durationMs === 'permanent') {
        setPermanentJadibot(number, 'active')
      } else if (hasRequestedDuration) {
        ensureJadibotExpiry(number, durationMs, 'active')
        scheduleJadibotExpiry(number, sendReply)
      } else if (getJadibotExpiry(number)) {
        updateJadibotExpiryStatus(number, 'active')
        scheduleJadibotExpiry(number, sendReply)
      } else {
        setPermanentJadibot(number, 'active')
        console.log(`[JADIBOT] ⚠️ ${number} tidak ada data expiry → dijadikan permanent (auto-start/reconnect)`)
      }

      if (pairingTimeout.has(number)) {
        clearTimeout(pairingTimeout.get(number))
        pairingTimeout.delete(number)
      }

      const C = '\x1b[36m', G = '\x1b[32m', R = '\x1b[0m', B = '\x1b[1m';
      console.log(`${C}╔══════════════════════════════════╗${R}`);
      console.log(`${C}║${R}    ${B}${G}✅  J A D I B O T  A K T I F${R}      ${C}║${R}`);
      console.log(`${C}╠══════════════════════════════════╣${R}`);
      console.log(`${C}║${R} ${G}📱${R} Nomor  : ${B}+${number}${R}`);
      console.log(`${C}║${R} ${G}🔗${R} Status : ${B}CONNECTED${R}`);
      console.log(`${C}╚══════════════════════════════════╝${R}`);

      // Edit pesan pairing secara realtime → tandai sudah terhubung
      if (pairingMsgKey && editMsg) {
        try {
          await editMsg(
            pairingMsgKey,
            `╔══════════════════════╗\n` +
            `║   ✅  *J A D I B O T*  ║\n` +
            `╚══════════════════════╝\n\n` +
            `📱 *Nomor:* ${maskNumber(number)}\n\n` +
            `🎉 *Kode berhasil digunakan!*\n` +
            `Jadibot sudah terhubung dan aktif.\n\n` +
            `✅ Pesan ini diperbarui otomatis saat terhubung.`
          )
        } catch {}
      }

      // Kirim pesan sambutan hanya saat fresh pairing (bukan reconnect otomatis)
      if (isFreshPairing) {
        try { if (reactFn) await reactFn('✅') } catch {}

        // Cek mode pairing — v2 = kirim welcome ke nomor tujuan, v1 = tidak
        const connCfg = loadConfig()
        const connPairingMode = (connCfg.jadibotPairingMode || 'v2').toLowerCase()

        if (connPairingMode === 'v2') {
          // Kirim notifikasi langsung ke nomor jadibot via main bot
          let directNotifSent = false
          if (mainBotSock) {
            try {
              await delay(800)
              await mainBotSock.sendMessage(`${number}@s.whatsapp.net`, {
                text: msgDirectWelcome(number)
              })
              directNotifSent = true
              console.log(`[JADIBOT][V2] ✅ Notif realtime terkirim ke +${number} via main bot`)
            } catch (e) {
              console.log(`[JADIBOT][V2] ⚠️ Gagal kirim notif ke +${number} via main bot: ${e?.message}`)
            }
          }

          // Self-notif hanya jika main bot gagal kirim (fallback, cegah duplikat)
          if (!directNotifSent) {
            try {
              await delay(300)
              await sendDirectJadibotNotice(sock, number,
                `🤖 *Jadibot aktif!*\n\n` +
                `Nomor ini (+${number}) kini berjalan sebagai bot.\n` +
                `Semua fitur bot tersedia via bot utama.\n\n` +
                `_Pesan ini dikirim otomatis saat jadibot terhubung._`
              )
            } catch {}
          }
        } else {
          // V1: kirim notif terhubung ke GC/owner
          try {
            await sendReply(msgConnected(number))
            console.log(`[JADIBOT][V1] ✅ Notif terhubung terkirim ke GC/owner`)
          } catch (e) {
            console.log(`[JADIBOT][V1] ⚠️ Gagal kirim notif terhubung ke GC: ${e?.message}`)
          }
        }
      }
    }

    /* ===== DISCONNECTED ===== */
    if (connection === 'close') {
      startingSocketMap.delete(number)
      if (pairingTimeout.has(number)) {
        clearTimeout(pairingTimeout.get(number))
        pairingTimeout.delete(number)
      }

      pairingRequested.delete(number)

      /* STOP MANUAL DARI BOT UTAMA */
      if (stoppingJadibot.has(number)) {
        stoppingJadibot.delete(number)
        jadibotMap.delete(number)
        activeOrStartingJadibot.delete(number)
        console.log(`[JADIBOT] ${number} STOPPED BY MAIN BOT`)
        return
      }

      /* ===== LOGOUT PAKSA DARI WHATSAPP ===== */
      if (reason === DisconnectReason.loggedOut) {
        // Hapus dari map DULU baru ambil sisa list (agar nomor ini tidak muncul di list)
        jadibotMap.delete(number)
        activeOrStartingJadibot.delete(number)

        const _Y = '\x1b[33m', _R = '\x1b[0m', _B = '\x1b[1m';
        console.log(`${_Y}[JADIBOT]${_R} ⚠️  ${_B}${number}${_R} logout paksa → sesi dihapus`);

        // Beri tahu owner via react ❌ (realtime)
        try { if (reactFn) await reactFn('❌') } catch {}

        // Cek mode pairing untuk tentukan kemana notif logout dikirim
        const logoutCfg = loadConfig()
        const logoutMode = (logoutCfg.jadibotPairingMode || 'v2').toLowerCase()

        if (logoutMode === 'v2') {
          // V2: kirim notif langsung ke nomor tujuan via main bot
          if (mainBotSock) {
            try {
              await mainBotSock.sendMessage(`${number}@s.whatsapp.net`, {
                text: msgLoggedOutDirect(number)
              })
              console.log(`[JADIBOT][V2] ✅ Notif logout terkirim ke +${number}`)
            } catch (e) {
              console.log(`[JADIBOT][V2] ⚠️ Gagal kirim notif logout ke +${number}: ${e?.message}`)
            }
          }
        } else {
          // V1: kirim notif ke GC/owner
          const remainingList = [...jadibotMap.keys()]
          try {
            await sendReply(msgLoggedOut(number, remainingList))
            console.log(`[JADIBOT][V1] ✅ Notif logout terkirim ke GC/owner`)
          } catch (e) {
            console.log(`[JADIBOT][V1] ⚠️ Gagal kirim notif logout ke GC: ${e?.message}`)
          }
        }

        // BARU setelah notif terkirim: tutup socket & hapus sesi
        cleanupSocket()
        setTimeout(() => {
          if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true })
          }
          removeJadibotExpiry(number)
        }, 300)
        return
      }

      if (isJadibotExpired(number)) {
        await expireJadibot(number, sendReply)
        return
      }

      /* ===== SESSION SUDAH TIDAK ADA ===== */
      if (!isSessionValid(sessionDir)) {
        jadibotMap.delete(number)
        activeOrStartingJadibot.delete(number)
        console.log(`[JADIBOT] ${number} session tidak ada, tidak restart`)
        return
      }

      /* ===== RECONNECT NORMAL ===== */
      // Guard: cegah duplicate reconnect jika close event terpicu lebih dari sekali
      if (reconnectingJadibot.has(number)) {
        console.log(`\x1b[33m[JADIBOT]\x1b[0m ⚠️ ${number} sudah dalam proses reconnect, skip duplikat`)
        return
      }
      reconnectingJadibot.add(number)

      // Hapus referensi socket lama dari map agar tidak stale
      jadibotMap.delete(number)

      console.log(`\x1b[33m[JADIBOT]\x1b[0m 🔄 ${number} reconnecting...`)
      // Tutup socket lama DULU sebelum buat yang baru
      cleanupSocket()
      setTimeout(() => {
        reconnectingJadibot.delete(number)
        activeOrStartingJadibot.delete(number)
        startJadibot(number, sendReply, mainBotNumber, editMsg, sendPairingMsg, hasConnectedOnce ? undefined : durationMs, mainBotSock)
      }, 3000)
    }
  })

  /* ================= ANTI CALL ================= */
  sock.ev.on('call', async calls => {
    for (const call of calls) {
      try {
        if (call.status !== 'offer') continue
        const jadibotNum = getJadibotNumber(sock)
        const isVideo = call.isVideo === true
        const setting = isVideo ? getJadibotAnticallvid(jadibotNum) : getJadibotAnticall(jadibotNum)
        if (!setting.enabled) continue
        const callerNumber = (call.from || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
        const whitelist = setting.whitelist || []
        const isWhitelisted = whitelist.some(n => {
          const c = n.replace(/[^0-9]/g, '')
          return callerNumber.includes(c) || c.includes(callerNumber)
        })
        if (isWhitelisted) {
          console.log(`[JADIBOT][${isVideo ? 'AntiCallVid' : 'AntiCall'}] +${jadibotNum} → ${callerNumber} WHITELISTED, skip`)
          continue
        }
        await sock.rejectCall(call.id, call.from)
        console.log(`[JADIBOT][${isVideo ? 'AntiCallVid' : 'AntiCall'}] +${jadibotNum} → Rejected ${isVideo ? 'video' : 'voice'} call from ${callerNumber}`)
        if (setting.message) {
          await new Promise(r => setTimeout(r, 1000))
          await sock.sendMessage(call.from, { text: setting.message })
        }
      } catch (err) {
        console.error(`[JADIBOT][AntiCall] Error:`, err.message)
      }
    }
  })

  /* ================= MESSAGE ================= */
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      if (!msg.message) continue

      try {
        await messageHandler(
          { message: msg, type: 'notify' },
          sock
        )
      } catch (err) {
        console.error('[JADIBOT MESSAGE ERROR]', err)
        logError(err instanceof Error ? err : new Error(String(err)), `jadibot-message:${number}`)
      }
    }
  })
}

/* ================= START JADIBOT QR ================= */
async function startJadibotQR(number, sendReply, sendImage, mainBotNumber, durationMs = undefined, mainBotSock = null, reactFn = null) {
  number = number.replace(/[^0-9]/g, '')
  const hasRequestedDuration = durationMs !== undefined && durationMs !== null

  if (hasRequestedDuration) {
    removeJadibotExpiry(number)
  } else if (isJadibotExpired(number)) {
    await expireJadibot(number, sendReply)
    return
  }

  if (activeOrStartingJadibot.has(number)) {
    console.log(`\x1b[33m[JADIBOT QR]\x1b[0m ⚠️ ${number} sudah aktif/dalam proses start, skip duplikat`)
    return
  }
  activeOrStartingJadibot.add(number)
  if (!hasRequestedDuration && getJadibotExpiry(number)) {
    updateJadibotExpiryStatus(number, 'starting')
    scheduleJadibotExpiry(number, sendReply)
  }

  if (typeof global.autoStartedJadibot !== 'undefined') {
    global.autoStartedJadibot.add(number)
  }

  const sessionDir = path.join(process.cwd(), 'jadibot', number)

  fs.mkdirSync(sessionDir, { recursive: true })
  cleanStaleSessionFiles(sessionDir)

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: {
      creds: state.creds,
      keys: state.keys,
    },
    logger: silentLogger,
    printQRInTerminal: false,
    browser: ['Ubuntu', 'Chrome', '136.0.7103.93'],
    keepAliveIntervalMs: 30000,
    syncFullHistory: true,
  })

  sock.isMainBot = false
  sock.mainBotNumber = mainBotNumber

  injectClient(
    sock,
    new Map(),
    new JSONDB('contacts', sessionDir),
    new JSONDB('groups', sessionDir),
    new JSONDB('settings', sessionDir)
  )

  sock.ev.on('creds.update', async (...args) => {
    try { await saveCreds(...args) } catch {}
  })

  let qrSentCount = 0
  let hasConnected = false

  sock.ev.on('connection.update', async ({ connection, lastDisconnect, qr }) => {
    const reason = lastDisconnect?.error?.output?.statusCode

    /* ===== KIRIM QR CODE ===== */
    if (qr) {
      qrSentCount++
      try {
        const qrBuffer = await QRCode.toBuffer(qr, { type: 'png', width: 512, margin: 2 })
        const caption =
          `╔══════════════════════╗\n` +
          `║   🤖  *J A D I B O T*  ║\n` +
          `╚══════════════════════╝\n\n` +
          `📱 *Nomor:* ${maskNumber(number)}\n` +
          `🔄 *QR ke-${qrSentCount}*\n\n` +
          `📋 *Cara Scan:*\n` +
          `1️⃣ Buka WhatsApp di HP kamu\n` +
          `2️⃣ Ketuk ⋮ (titik tiga) → *Perangkat Tertaut*\n` +
          `3️⃣ Ketuk *Tautkan Perangkat*\n` +
          `4️⃣ Scan QR di atas\n\n` +
          `⏳ QR berlaku ±60 detik\n` +
          `⚠️ Jika QR expired, QR baru akan dikirim otomatis`
        await sendImage(qrBuffer, caption)
        console.log(`[JADIBOT QR] QR ke-${qrSentCount} dikirim untuk ${number}`)
      } catch (err) {
        console.error(`[JADIBOT QR] Gagal kirim QR ${number}:`, err?.message)
      }
    }

    /* ===== CONNECTED ===== */
    if (connection === 'open') {
      hasConnected = true
      const _connectTs = Date.now()
      jadibotMap.set(number, sock)
      jadibotConnectedAt.set(number, _connectTs)
      persistConnectedAt(number, _connectTs)
      if (durationMs === 'permanent') {
        setPermanentJadibot(number, 'active')
      } else if (hasRequestedDuration) {
        ensureJadibotExpiry(number, durationMs, 'active')
        scheduleJadibotExpiry(number, sendReply)
      } else if (getJadibotExpiry(number)) {
        updateJadibotExpiryStatus(number, 'active')
        scheduleJadibotExpiry(number, sendReply)
      } else {
        setPermanentJadibot(number, 'active')
        console.log(`[JADIBOT QR] ⚠️ ${number} tidak ada data expiry → dijadikan permanent (auto-start/reconnect)`)
      }
      console.log(`[JADIBOT QR] ✅ ${number} CONNECTED via QR`)
      try { if (reactFn) await reactFn('✅') } catch {}

      // Cek mode pairing — v2 = kirim welcome ke nomor tujuan, v1 = tidak
      const connCfgQR = loadConfig()
      const connPairingModeQR = (connCfgQR.jadibotPairingMode || 'v2').toLowerCase()

      if (connPairingModeQR === 'v2') {
        // Kirim notifikasi langsung ke nomor jadibot via main bot
        let directNotifSentQR = false
        if (mainBotSock) {
          try {
            await delay(800)
            await mainBotSock.sendMessage(`${number}@s.whatsapp.net`, {
              text: msgDirectWelcome(number)
            })
            directNotifSentQR = true
            console.log(`[JADIBOT QR][V2] ✅ Notif realtime terkirim ke +${number} via main bot`)
          } catch (e) {
            console.log(`[JADIBOT QR][V2] ⚠️ Gagal kirim notif ke +${number} via main bot: ${e?.message}`)
          }
        }

        // Self-notif hanya jika main bot gagal kirim (fallback, cegah duplikat)
        if (!directNotifSentQR) {
          try {
            await delay(300)
            await sendDirectJadibotNotice(sock, number,
              `🤖 *Jadibot aktif!*\n\n` +
              `Nomor ini (+${number}) kini berjalan sebagai bot.\n` +
              `Semua fitur bot tersedia via bot utama.\n\n` +
              `_Pesan ini dikirim otomatis saat jadibot terhubung._`
            )
          } catch {}
        }
      } else {
        // V1: kirim notif terhubung ke GC/owner
        try {
          await sendReply(msgConnected(number))
          console.log(`[JADIBOT QR][V1] ✅ Notif terhubung terkirim ke GC/owner`)
        } catch (e) {
          console.log(`[JADIBOT QR][V1] ⚠️ Gagal kirim notif terhubung ke GC: ${e?.message}`)
        }
      }
    }

    /* ===== DISCONNECTED ===== */
    if (connection === 'close') {
      if (stoppingJadibot.has(number)) {
        stoppingJadibot.delete(number)
        jadibotMap.delete(number)
        activeOrStartingJadibot.delete(number)
        console.log(`[JADIBOT QR] ${number} STOPPED BY MAIN BOT`)
        return
      }

      if (reason === DisconnectReason.loggedOut) {
        jadibotMap.delete(number)
        activeOrStartingJadibot.delete(number)
        console.log(`[JADIBOT QR] ⚠️ ${number} LOGOUT PAKSA → session dihapus`)

        // Beri tahu owner via react ❌ (realtime)
        try { if (reactFn) await reactFn('❌') } catch {}

        // Cek mode pairing untuk tentukan kemana notif logout dikirim
        const logoutCfgQR = loadConfig()
        const logoutModeQR = (logoutCfgQR.jadibotPairingMode || 'v2').toLowerCase()

        if (logoutModeQR === 'v2') {
          // V2: kirim notif langsung ke nomor tujuan via main bot
          if (mainBotSock) {
            try {
              await mainBotSock.sendMessage(`${number}@s.whatsapp.net`, {
                text: msgLoggedOutDirect(number)
              })
              console.log(`[JADIBOT QR][V2] ✅ Notif logout terkirim ke +${number}`)
            } catch (e) {
              console.log(`[JADIBOT QR][V2] ⚠️ Gagal kirim notif logout ke +${number}: ${e?.message}`)
            }
          }
        } else {
          // V1: kirim notif ke GC/owner
          const remainingListQR = [...jadibotMap.keys()]
          try {
            await sendReply(msgLoggedOut(number, remainingListQR))
            console.log(`[JADIBOT QR][V1] ✅ Notif logout terkirim ke GC/owner`)
          } catch (e) {
            console.log(`[JADIBOT QR][V1] ⚠️ Gagal kirim notif logout ke GC: ${e?.message}`)
          }
        }

        // BARU hapus sesi setelah notif terkirim
        setTimeout(() => {
          if (fs.existsSync(sessionDir)) {
            fs.rmSync(sessionDir, { recursive: true, force: true })
          }
          removeJadibotExpiry(number)
        }, 300)
        return
      }

      if (isJadibotExpired(number)) {
        await expireJadibot(number, sendReply)
        return
      }

      // Jika sudah pernah connect via QR, selalu coba reconnect
      // (creds.json mungkin belum tersimpan tepat waktu sebelum disconnect sesaat)
      if (hasConnected || isSessionValid(sessionDir)) {
        // Guard: cegah duplicate reconnect
        if (reconnectingJadibot.has(number)) {
          console.log(`[JADIBOT QR] ⚠️ ${number} sudah dalam proses reconnect, skip duplikat`)
          return
        }
        reconnectingJadibot.add(number)
        jadibotMap.delete(number)
        console.log(`[JADIBOT QR] ${number} reconnecting via QR...`)
        // Tutup socket lama DULU sebelum buat yang baru
        // agar WA tidak kick socket lama dengan alasan loggedOut
        // yang akan memicu penghapusan sesi secara salah
        try {
          sock.ev.removeAllListeners()
          if (sock.ws) sock.ws.close()
        } catch {}
        setTimeout(() => {
          reconnectingJadibot.delete(number)
          activeOrStartingJadibot.delete(number)
          startJadibotQR(number, sendReply, sendImage, mainBotNumber, hasConnected ? undefined : durationMs, mainBotSock)
        }, 3000)
        return
      }

      jadibotMap.delete(number)
      activeOrStartingJadibot.delete(number)
      console.log(`[JADIBOT QR] ${number} session tidak ada, tidak restart`)
    }
  })

  /* ================= ANTI CALL (QR) ================= */
  sock.ev.on('call', async calls => {
    for (const call of calls) {
      try {
        if (call.status !== 'offer') continue
        const jadibotNum = getJadibotNumber(sock)
        const isVideo = call.isVideo === true
        const setting = isVideo ? getJadibotAnticallvid(jadibotNum) : getJadibotAnticall(jadibotNum)
        if (!setting.enabled) continue
        const callerNumber = (call.from || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
        const whitelist = setting.whitelist || []
        const isWhitelisted = whitelist.some(n => {
          const c = n.replace(/[^0-9]/g, '')
          return callerNumber.includes(c) || c.includes(callerNumber)
        })
        if (isWhitelisted) {
          console.log(`[JADIBOT QR][${isVideo ? 'AntiCallVid' : 'AntiCall'}] +${jadibotNum} → ${callerNumber} WHITELISTED, skip`)
          continue
        }
        await sock.rejectCall(call.id, call.from)
        console.log(`[JADIBOT QR][${isVideo ? 'AntiCallVid' : 'AntiCall'}] +${jadibotNum} → Rejected ${isVideo ? 'video' : 'voice'} call from ${callerNumber}`)
        if (setting.message) {
          await new Promise(r => setTimeout(r, 1000))
          await sock.sendMessage(call.from, { text: setting.message })
        }
      } catch (err) {
        console.error(`[JADIBOT QR][AntiCall] Error:`, err.message)
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    for (const msg of messages) {
      if (!msg.message) continue
      try {
        await messageHandler({ message: msg, type: 'notify' }, sock)
      } catch (err) {
        console.error('[JADIBOT QR MESSAGE ERROR]', err)
      }
    }
  })
}

/* ================= STOP JADIBOT ================= */
async function stopJadibot(number, sendReply) {
  number = number.replace(/[^0-9]/g, '')
  const sock = jadibotMap.get(number)
  const sessionDir = path.join(process.cwd(), 'jadibot', number)

  if (!sock) {
    const hadData = fs.existsSync(sessionDir) || !!getJadibotExpiry(number)
    jadibotMap.delete(number)
    pairingRequested.delete(number)
    reconnectingJadibot.delete(number)
    activeOrStartingJadibot.delete(number)
    if (pairingTimeout.has(number)) {
      clearTimeout(pairingTimeout.get(number))
      pairingTimeout.delete(number)
    }
    // Tutup socket yang mungkin masih dalam proses pairing di background
    const stuckSock = startingSocketMap.get(number)
    if (stuckSock) {
      try {
        stuckSock.ev.removeAllListeners()
        if (stuckSock.ws) stuckSock.ws.close()
      } catch {}
      startingSocketMap.delete(number)
    }
    removeJadibotExpiry(number)
    try {
      if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true })
    } catch {}
    return await sendReply(
      hadData
        ? (
          `╔══════════════════════╗\n` +
          `║  🛑  *JADIBOT STOP*  ║\n` +
          `╚══════════════════════╝\n\n` +
          `✅ Data jadibot *${maskNumber(number)}* berhasil dibersihkan.\n` +
          `📴 Status sebelumnya tidak aktif/terputus.\n` +
          `🗑️ Sesi lama sudah dihapus.`
        )
        : (
          `╔══════════════════════╗\n` +
          `║   ❌  *GAGAL STOP*   ║\n` +
          `╚══════════════════════╝\n\n` +
          `Jadibot *${maskNumber(number)}* tidak aktif atau sudah dihentikan.`
        )
    )
  }

  stoppingJadibot.add(number)

  try {
    sock.ev.removeAllListeners()
    if (sock.ws) sock.ws.close()
  } catch {}

  jadibotMap.delete(number)
  stoppingJadibot.delete(number)
  activeOrStartingJadibot.delete(number)
  pairingRequested.delete(number)
  if (pairingTimeout.has(number)) {
    clearTimeout(pairingTimeout.get(number))
    pairingTimeout.delete(number)
  }
  startingSocketMap.delete(number)

  setTimeout(() => {
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true })
    }
    removeJadibotExpiry(number)
  }, 500)

  await sendReply(
    `╔══════════════════════╗\n` +
    `║  🛑  *JADIBOT STOP*  ║\n` +
    `╚══════════════════════╝\n\n` +
    `✅ Jadibot *${maskNumber(number)}* berhasil dihentikan.\n` +
    `🗑️ Sesi telah dihapus.\n\n` +
    `💡 Ketik *.jadibot ${number}* untuk aktifkan kembali.`
  )
}

/* ================= PAUSE / RESUME TIMER ================= */

function pauseAllJadibotTimers() {
  const data = loadJadibotRealtimeData()
  const now = Date.now()
  let changed = false
  for (const [number, meta] of Object.entries(data.bots)) {
    if (meta.isPaused) continue
    if (meta.permanent === true) continue
    const remaining = Number(meta.expiresAt) - now
    if (remaining <= 0) continue
    data.bots[number] = {
      ...meta,
      isPaused: true,
      pausedAt: now,
      pausedRemainingMs: remaining,
    }
    changed = true
  }
  if (changed) saveJadibotRealtimeData(data)
  return changed
}

function resumeAllJadibotTimers() {
  const data = loadJadibotRealtimeData()
  const now = Date.now()
  let changed = false
  for (const [number, meta] of Object.entries(data.bots)) {
    if (meta.permanent === true) continue
    if (!meta.isPaused) continue
    const remaining = Number(meta.pausedRemainingMs) || 0
    if (remaining <= 0) {
      delete data.bots[number]
      changed = true
      continue
    }
    data.bots[number] = {
      ...meta,
      expiresAt: now + remaining,
      isPaused: false,
      pausedAt: undefined,
      pausedRemainingMs: undefined,
      updatedAt: now,
    }
    changed = true
  }
  if (changed) saveJadibotRealtimeData(data)
  return changed
}

/* ================= EXPORT ================= */
export {
  startJadibot,
  startJadibotQR,
  stopJadibot,
  jadibotMap,
  jadibotConnectedAt,
  pendingJadibotChoices,
  formatPairingCode,
  maskNumber,
  parseJadibotDuration,
  getJadibotExpiry,
  formatRemainingTime,
  formatJadibotExpiryTime,
  getJadibotExpirySummary,
  cleanupExpiredJadibots,
  purgeExpiredJadibotSessions,
  removeJadibotExpiry,
  setPermanentJadibot,
  ensureJadibotExpiry,
  extendJadibotExpiry,
  updateJadibotExpiryStatus,
  scheduleJadibotExpiry,
  pauseAllJadibotTimers,
  resumeAllJadibotTimers,
  restoreConnectedAtMap
}
