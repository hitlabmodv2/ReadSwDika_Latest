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

const JADIBOT_SETTINGS_PATH = path.join(process.cwd(), 'data', 'jadibot', 'settings.json')

function ensureDir() {
  fs.mkdirSync(path.dirname(JADIBOT_SETTINGS_PATH), { recursive: true })
}

export function loadAllJadibotSettings() {
  try {
    ensureDir()
    if (!fs.existsSync(JADIBOT_SETTINGS_PATH)) return {}
    const parsed = JSON.parse(fs.readFileSync(JADIBOT_SETTINGS_PATH, 'utf-8'))
    return (parsed && typeof parsed === 'object') ? parsed : {}
  } catch {
    return {}
  }
}

export function saveAllJadibotSettings(data) {
  ensureDir()
  const tmp = `${JADIBOT_SETTINGS_PATH}.tmp`
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8')
  fs.renameSync(tmp, JADIBOT_SETTINGS_PATH)
}

export function getJadibotUserSettings(number) {
  number = String(number || '').replace(/[^0-9]/g, '')
  const all = loadAllJadibotSettings()
  return all[number] || {}
}

export function setJadibotUserSetting(number, key, value) {
  number = String(number || '').replace(/[^0-9]/g, '')
  const all = loadAllJadibotSettings()
  if (!all[number]) all[number] = {}
  all[number][key] = value
  all[number].updatedAt = Date.now()
  saveAllJadibotSettings(all)
}

export function removeJadibotUserSettings(number) {
  number = String(number || '').replace(/[^0-9]/g, '')
  const all = loadAllJadibotSettings()
  if (all[number]) {
    delete all[number]
    saveAllJadibotSettings(all)
  }
}

export function getJadibotAntidel(number) {
  const settings = getJadibotUserSettings(number)
  return settings.antidel || { enabled: false, privateChat: true, groupChat: true, sendTo: 'self' }
}

export function getJadibotReadsw(number) {
  const settings = getJadibotUserSettings(number)
  return settings.readsw || {
    enabled: true,
    autoReaction: true,
    randomDelay: true,
    delayMinMs: 1000,
    delayMaxMs: 20000,
    fixedDelayMs: 3000
  }
}

export function getJadibotAnticall(number) {
  const settings = getJadibotUserSettings(number)
  return settings.anticall || { enabled: false, message: '', whitelist: [] }
}

export function getJadibotAnticallvid(number) {
  const settings = getJadibotUserSettings(number)
  return settings.anticallvid || { enabled: false, message: '', whitelist: [] }
}

export function getJadibotNumber(hisoka) {
  return String(hisoka?.user?.id || '').split('@')[0].split(':')[0].replace(/[^0-9]/g, '')
}
