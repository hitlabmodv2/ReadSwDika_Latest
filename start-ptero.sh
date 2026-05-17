#!/usr/bin/env bash
# ─────────────────────────────────────
#  Start script untuk PTERODACTYL
#  Startup Command di panel: bash start-ptero.sh
# ─────────────────────────────────────

CONFIG_FILE="./config.json"

# ── Ambil config Telegram dari config.json ──
tg_enabled=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8'));console.log(c.telegram?.enabled||false)}catch(e){console.log(false)}")
tg_token=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8'));console.log(c.telegram?.token||'')}catch(e){console.log('')}")
tg_chat=$(node -e "try{const c=JSON.parse(require('fs').readFileSync('$CONFIG_FILE','utf8'));console.log(c.telegram?.chatId||'')}catch(e){console.log('')}")

# ── Fungsi kirim notif Telegram ──
send_tg() {
  local msg="$1"
  if [ "$tg_enabled" = "true" ] && [ -n "$tg_token" ] && [ -n "$tg_chat" ]; then
    curl -s -X POST "https://api.telegram.org/bot${tg_token}/sendMessage" \
      -d chat_id="$tg_chat" \
      -d parse_mode="Markdown" \
      --data-urlencode text="$msg" > /dev/null 2>&1
  fi
}

# ── Fungsi format durasi detik → jam/menit/detik ──
format_uptime() {
  local secs=$1
  local h=$((secs / 3600))
  local m=$(((secs % 3600) / 60))
  local s=$((secs % 60))
  echo "${h}j ${m}m ${s}d"
}

echo "▶ Wily Bot - Pterodactyl Mode"

# Install node_modules jika belum ada
if [ ! -d "node_modules" ]; then
  echo "▶ node_modules tidak ditemukan, install dulu..."
  npm install
fi

# Install PM2 global jika belum ada
if ! command -v pm2 &>/dev/null; then
  echo "▶ PM2 tidak ditemukan, install PM2..."
  npm install pm2 -g
fi

echo "▶ Update PM2..."
pm2 update

BOT_START_TIME=$(date +%s)

send_tg "✅ *Wily Bot - Pterodactyl*
Bot berhasil dijalankan.
🕐 $(date '+%Y-%m-%d %H:%M:%S')"

# ── Daily report (background, setiap 24 jam) ──
daily_report() {
  while true; do
    sleep 86400
    NOW=$(date '+%Y-%m-%d %H:%M:%S')
    ELAPSED=$(( $(date +%s) - BOT_START_TIME ))
    UPTIME_STR=$(format_uptime $ELAPSED)

    # Ambil memori dari /proc/meminfo
    MEM_USED_KB=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
    MEM_TOTAL_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
    MEM_USED_MB=$(( (MEM_TOTAL_KB - MEM_USED_KB) / 1024 ))
    MEM_TOTAL_MB=$(( MEM_TOTAL_KB / 1024 ))

    send_tg "📊 *Wily Bot - Laporan Harian (Pterodactyl)*

🟢 Status: \`Online\`
⏱ Uptime sejak start: \`${UPTIME_STR}\`
🔄 Total Crash & Restart: \`${RESTART_COUNT}x\`
💾 Memori Server: \`${MEM_USED_MB} MB / ${MEM_TOTAL_MB} MB\`
🕐 Waktu: $NOW"
  done
}

# Jalankan daily report di background
daily_report &
DAILY_PID=$!

# ── Auto-restart loop ──
RESTART_COUNT=0
MAX_RESTARTS=10
RESTART_DELAY=5

echo "✅ Menjalankan bot dengan auto-restart..."
while true; do
  node index.js
  EXIT_CODE=$?
  RESTART_COUNT=$((RESTART_COUNT + 1))
  NOW=$(date '+%Y-%m-%d %H:%M:%S')

  echo "⚠️  [$NOW] Bot berhenti (exit code: $EXIT_CODE), restart ke-$RESTART_COUNT dalam ${RESTART_DELAY}s..."

  if [ "$RESTART_COUNT" -ge "$MAX_RESTARTS" ]; then
    echo "❌ Terlalu banyak restart ($MAX_RESTARTS kali), bot dihentikan."
    send_tg "❌ *Wily Bot - Pterodactyl*
Bot dihentikan setelah $MAX_RESTARTS kali crash.
Exit Code terakhir: \`$EXIT_CODE\`
🕐 $NOW"
    kill $DAILY_PID 2>/dev/null
    exit 1
  fi

  send_tg "⚠️ *Wily Bot - Pterodactyl*
Bot crash (exit code: \`$EXIT_CODE\`), restart ke-$RESTART_COUNT dalam ${RESTART_DELAY}s...
🕐 $NOW"

  sleep $RESTART_DELAY
  echo "▶ Menjalankan ulang bot..."
done
