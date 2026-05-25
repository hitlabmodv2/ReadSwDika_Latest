#!/usr/bin/env bash
# ╔══════════════════════════════════════════════════════════╗
# ║                                                          ║
# ║              🚀  PUSH SCRIPT — BANG WILY  🚀             ║
# ║                                                          ║
# ║   Author : Bang Wily (Wilykun1994)                       ║
# ║   Telegram: @Wilykun1994                                 ║
# ║   Versi  : 1.1  •  Auto Commit + Multi-Branch Push       ║
# ║                                                          ║
# ╚══════════════════════════════════════════════════════════╝
#
# 📌 Deskripsi:
#   Script otomatis untuk commit & push ke GitHub.
#   - Pesan commit di-generate otomatis (Conventional Commits)
#   - Menu pemilih branch tujuan (default / pilih / semua)
#   - Setelah sukses, otomatis balik ke menu awal
#
# 📱 Cara pakai (cocok di Termux / mobile shell):
#   bash push.sh                       → tampilkan menu branch
#   bash push.sh "pesan commit kamu"   → pakai pesan custom
#
# 🔐 Keamanan:
#   Token GitHub disimpan di file .token (di-ignore git, aman).
#   Bikin file pertama kali :  echo 'ghp_xxxxxxxx' > .token
#
# ⚙️  Konfigurasi:
#   Edit variabel USER, REPO, DEFAULT_BRANCH di bawah.
#
# ─────────────────────────────────────────────────────────────

USER="hitlabmodv2"
REPO="ReadSwDika_BangWily"
# DEFAULT_BRANCH di-auto-detect realtime dari GitHub (lihat detect_default_branch).
# Nilai di sini cuma fallback kalau koneksi ke GitHub bermasalah.
DEFAULT_BRANCH="BANGWILY"

# Versi script ini — dipakai untuk cek update otomatis
SCRIPT_VERSION="1.1"
# File flag update (disimpan di /tmp, tidak ikut git)
_UPDATE_FLAG="/tmp/.pushwily_update_$(echo "$PWD" | tr '/' '_').flag"

# Branch yang disembunyikan dari menu (system / internal).
# Pisahkan dengan spasi. Contoh: "replit-agent gh-pages backup"
IGNORE_BRANCHES="replit-agent HEAD"

# File log riwayat push (disimpan lokal, tidak ke-upload ke GitHub)
PUSH_LOG_FILE=".push_history.log"

# Batas ukuran folder node_modules (MB) — folder >= nilai ini akan di-skip saat push.
# Ubah angka ini kalau mau lebih ketat atau lebih longgar.
NM_SKIP_MB=5

# Telegram notifikasi (push.sh only — tidak berhubungan dengan bot WA)
TG_TOKEN="7603636186:AAHKB27UPqcCZswPiGJJuRBnNXBmk4hJad0"
TG_CHAT_ID="5810736154"

# ===== Kirim notifikasi Telegram (dengan opsional inline button) =====
# Usage: send_telegram "teks" '{"inline_keyboard":[[...]]}'
send_telegram() {
  local _text="$1"
  local _markup="${2:-}"
  [ -z "$TG_TOKEN" ] || [ -z "$TG_CHAT_ID" ] && return 0
  if [ -n "$_markup" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
      -H "Content-Type: application/json" \
      -d "{\"chat_id\":\"${TG_CHAT_ID}\",\"parse_mode\":\"HTML\",\"text\":$(printf '%s' "$_text" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '"%s"' "$_text"),\"reply_markup\":${_markup}}" \
      >/dev/null 2>&1 &
  else
    curl -s -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendMessage" \
      -d chat_id="${TG_CHAT_ID}" \
      -d parse_mode="HTML" \
      -d text="${_text}" \
      >/dev/null 2>&1 &
  fi
}

# ===== Kirim notifikasi Telegram dengan foto/thumbnail =====
# Usage: send_telegram_photo "url_foto" "caption" '{"inline_keyboard":[[...]]}'
send_telegram_photo() {
  local _photo="$1"
  local _caption="$2"
  local _markup="${3:-}"
  [ -z "$TG_TOKEN" ] || [ -z "$TG_CHAT_ID" ] && return 0
  local _cap_json
  _cap_json=$(printf '%s' "$_caption" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))' 2>/dev/null || printf '"%s"' "$_caption")
  if [ -n "$_markup" ]; then
    curl -s -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendPhoto" \
      -H "Content-Type: application/json" \
      -d "{\"chat_id\":\"${TG_CHAT_ID}\",\"photo\":\"${_photo}\",\"caption\":${_cap_json},\"parse_mode\":\"HTML\",\"reply_markup\":${_markup}}" \
      >/dev/null 2>&1 &
  else
    curl -s -X POST "https://api.telegram.org/bot${TG_TOKEN}/sendPhoto" \
      -H "Content-Type: application/json" \
      -d "{\"chat_id\":\"${TG_CHAT_ID}\",\"photo\":\"${_photo}\",\"caption\":${_cap_json},\"parse_mode\":\"HTML\"}" \
      >/dev/null 2>&1 &
  fi
}

set -o pipefail
# Catatan: sengaja TIDAK pakai `set -e` biar error per-branch nggak
# langsung kill seluruh script — biar bisa kembali ke menu.

# ===== Warna (opsional, aman di Termux) =====
if [ -t 1 ]; then
  C_RESET="\033[0m"; C_DIM="\033[2m"; C_BOLD="\033[1m"
  C_GREEN="\033[32m"; C_RED="\033[31m"; C_YELLOW="\033[33m"
  C_CYAN="\033[36m"; C_BLUE="\033[34m"; C_MAGENTA="\033[35m"
  C_ERASE="\033[2K"; C_CR="\r"
else
  C_RESET=""; C_DIM=""; C_BOLD=""
  C_GREEN=""; C_RED=""; C_YELLOW=""
  C_CYAN=""; C_BLUE=""; C_MAGENTA=""
  C_ERASE=""; C_CR=""
fi

# ===== Spinner animasi loading =====
# Style pilihan:
#   default → ⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏  (dots — umum)
#   fetch   → ◐◓◑◒            (circular — network/fetch)
#   build   → ⣾⣽⣻⢿⡿⣟⣯⣷      (heavy — commit/build)
#   check   → ◇◈◆◈            (diamond — verifikasi)
#   wave    → ▁▂▃▄▅▆▇█▇▆▅▄▃▂  (wave — loading list)
_SPIN_PID=""
_PROGRESS_PID=""
_BAR_W=22

_spin_loop() {
  local label="$1" style="$2"
  local i=0
  local arr=()
  case "$style" in
    fetch)  arr=(◐ ◓ ◑ ◒) ;;
    build)  arr=(⣾ ⣽ ⣻ ⢿ ⡿ ⣟ ⣯ ⣷) ;;
    check)  arr=(◇ ◈ ◆ ◈) ;;
    wave)   arr=(▁ ▂ ▃ ▄ ▅ ▆ ▇ █ ▇ ▆ ▅ ▄ ▃ ▂) ;;
    *)      arr=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏) ;;
  esac
  local n=${#arr[@]}
  while true; do
    printf "${C_CR}${C_ERASE}  ${C_CYAN}%s${C_RESET} ${C_BOLD}%s${C_RESET}${C_DIM}...${C_RESET}" \
      "${arr[$((i % n))]}" "$label" >/dev/tty 2>/dev/null
    i=$(( i + 1 ))
    sleep 0.09
  done
}

spinner_start() {
  local label="${1:-Memproses}"
  local style="${2:-default}"
  [ -z "$C_CYAN" ] && { printf "  %s...\n" "$label" >/dev/tty 2>/dev/null; return; }
  _spin_loop "$label" "$style" &
  _SPIN_PID=$!
}

spinner_stop() {
  if [ -n "$_SPIN_PID" ]; then
    kill "$_SPIN_PID" 2>/dev/null
    wait "$_SPIN_PID" 2>/dev/null
    _SPIN_PID=""
    printf "${C_CR}${C_ERASE}" >/dev/tty 2>/dev/null
  fi
}

spinner_ok() {
  spinner_stop
  local msg="${1:-Selesai}"
  echo -e "  ${C_GREEN}✅${C_RESET} ${msg}"
}

spinner_fail() {
  spinner_stop
  local msg="${1:-Gagal}"
  echo -e "  ${C_RED}❌${C_RESET} ${msg}"
}

# ── Progress bar 0-100% (untuk upload & buat branch) ──────────────────────
_progress_loop() {
  local label="$1" est="$2" icon="$3"
  local tick=0 total=$(( est * 10 )) bw=$_BAR_W
  while true; do
    local raw=$(( tick * 100 / ( total > 0 ? total : 1 ) ))
    local pct=$(( raw > 98 ? 98 : raw ))
    local filled=$(( pct * bw / 100 ))
    local empty=$(( bw - filled ))
    local bf="" be="" j=0
    while [ $j -lt $filled ]; do bf="${bf}█"; j=$(( j+1 )); done
    while [ $j -lt $(( filled + empty )) ]; do be="${be}░"; j=$(( j+1 )); done
    printf "${C_CR}${C_ERASE}  ${C_CYAN}%s${C_RESET}  ${C_BOLD}%-18s${C_RESET} [${C_GREEN}%s${C_RESET}${C_DIM}%s${C_RESET}] ${C_CYAN}${C_BOLD}%3d%%${C_RESET}" \
      "$icon" "$label" "$bf" "$be" "$pct" >/dev/tty 2>/dev/null
    tick=$(( tick + 1 ))
    sleep 0.1
  done
}

progress_start() {
  local label="${1:-Upload}"
  local est_secs="${2:-10}"
  local icon="${3:-📤}"
  [ -z "$C_CYAN" ] && { printf "  %s...\n" "$label" >/dev/tty 2>/dev/null; return; }
  _progress_loop "$label" "$est_secs" "$icon" &
  _PROGRESS_PID=$!
}

progress_stop() {
  local success="${1:-ok}"
  if [ -n "$_PROGRESS_PID" ]; then
    kill "$_PROGRESS_PID" 2>/dev/null
    wait "$_PROGRESS_PID" 2>/dev/null
    _PROGRESS_PID=""
  fi
  local bw=$_BAR_W
  local full="" j=0
  while [ $j -lt $bw ]; do full="${full}█"; j=$(( j+1 )); done
  if [ "$success" = "ok" ]; then
    printf "${C_CR}${C_ERASE}  ${C_GREEN}✅${C_RESET}  ${C_BOLD}%-18s${C_RESET} [${C_GREEN}%s${C_RESET}] ${C_GREEN}${C_BOLD}100%%${C_RESET}\n" \
      "" "$full" >/dev/tty 2>/dev/null
  else
    local half="" j=0
    while [ $j -lt $bw ]; do half="${half}▒"; j=$(( j+1 )); done
    printf "${C_CR}${C_ERASE}  ${C_RED}❌${C_RESET}  ${C_BOLD}%-18s${C_RESET} [${C_RED}%s${C_RESET}] ${C_RED}${C_BOLD}GAGAL${C_RESET}\n" \
      "" "$half" >/dev/tty 2>/dev/null
  fi
}

# ── Mini progress bar 0-100% untuk tiap operasi (realtime, akurat) ──────────
_MB_W=22          # lebar bar mini
_MB_BG_PID=""

mini_bar_start() {
  local label="$1" delay="${2:-0.04}"
  _MB_BG_PID=""
  {
    local p=0
    while [ "$p" -le 92 ]; do
      local f=$(( p * _MB_W / 100 ))
      local bf="" be="" j=0
      while [ $j -lt $f ];      do bf="${bf}█"; j=$(( j+1 )); done
      while [ $j -lt $_MB_W ]; do be="${be}░"; j=$(( j+1 )); done
      printf "\r  [\033[36m%s\033[0m\033[2m%s\033[0m] \033[1;36m%3d%%\033[0m  \033[2m%s\033[0m   " \
        "$bf" "$be" "$p" "$label" >/dev/tty 2>/dev/null
      p=$(( p + 1 ))
      sleep "$delay"
    done
    # Tahan di 92% sampai di-kill
    local bf92="" j=0
    while [ $j -lt $(( 92 * _MB_W / 100 )) ]; do bf92="${bf92}█"; j=$(( j+1 )); done
    local be92=""
    while [ $j -lt $_MB_W ]; do be92="${be92}░"; j=$(( j+1 )); done
    while true; do
      printf "\r  [\033[36m%s\033[0m\033[2m%s\033[0m] \033[1;36m 92%%\033[0m  \033[2m%s\033[0m   " \
        "$bf92" "$be92" "$label" >/dev/tty 2>/dev/null
      sleep 0.3
    done
  } &
  _MB_BG_PID=$!
}

mini_bar_ok() {
  local label="${1:-Selesai}"
  [ -n "$_MB_BG_PID" ] && { kill "$_MB_BG_PID" 2>/dev/null; wait "$_MB_BG_PID" 2>/dev/null; _MB_BG_PID=""; }
  local full="" j=0
  while [ $j -lt $_MB_W ]; do full="${full}█"; j=$(( j+1 )); done
  printf "\r  [\033[32m%s\033[0m] \033[1;32m100%%\033[0m  \033[32m✅ %s\033[0m            \n" \
    "$full" "$label" >/dev/tty 2>/dev/null
}

mini_bar_fail() {
  local label="${1:-Gagal}"
  [ -n "$_MB_BG_PID" ] && { kill "$_MB_BG_PID" 2>/dev/null; wait "$_MB_BG_PID" 2>/dev/null; _MB_BG_PID=""; }
  local half="" be="" j=0
  while [ $j -lt $(( _MB_W * 9 / 10 )) ]; do half="${half}▒"; j=$(( j+1 )); done
  while [ $j -lt $_MB_W ]; do be="${be}░"; j=$(( j+1 )); done
  printf "\r  [\033[31m%s\033[0m\033[2m%s\033[0m] \033[1;31m ERR\033[0m  \033[31m❌ %s\033[0m            \n" \
    "$half" "$be" "$label" >/dev/tty 2>/dev/null
}

# ── Varian 2-baris: bar (baris 1) + spinner & info kontekstual (baris 2) ──────
# _MB_SUB_FILE : opsional — kalau di-set, baris 2 dibaca live dari file ini
_MB_SUB_FILE=""

mini_bar2_start() {
  local label="$1" sub="${2:-}" delay="${3:-0.04}"
  _MB_BG_PID=""
  local _sf="$_MB_SUB_FILE"          # tangkap path file sebelum fork
  printf "\n" >/dev/tty 2>/dev/null  # baris kosong untuk area baris-2
  {
    local p=0 si=0
    local spin=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)
    while [ "$p" -le 92 ]; do
      local f=$(( p * _MB_W / 100 )) bf="" be="" j=0
      while [ $j -lt $f ];      do bf="${bf}█"; j=$(( j+1 )); done
      while [ $j -lt $_MB_W ]; do be="${be}░"; j=$(( j+1 )); done
      local sp="${spin[$(( si % 10 ))]}"
      local _s="$sub"
      [ -n "$_sf" ] && [ -f "$_sf" ] && _s=$(tr -d '\n' < "$_sf" 2>/dev/null | cut -c1-50)
      printf "\033[2A\r\033[K  [\033[36m%s\033[0m\033[2m%s\033[0m] \033[1;36m%3d%%\033[0m  \033[2m%s\033[0m\n\033[K  \033[36m%s\033[0m \033[2m%s\033[0m\n" \
        "$bf" "$be" "$p" "$label" "$sp" "$_s" >/dev/tty 2>/dev/null
      p=$(( p+1 )); si=$(( si+1 ))
      sleep "$delay"
    done
    local bf92="" j=0
    while [ $j -lt $(( 92 * _MB_W / 100 )) ]; do bf92="${bf92}█"; j=$(( j+1 )); done
    local be92="" ; while [ $j -lt $_MB_W ]; do be92="${be92}░"; j=$(( j+1 )); done
    while true; do
      local sp="${spin[$(( si % 10 ))]}"
      local _s="$sub"
      [ -n "$_sf" ] && [ -f "$_sf" ] && _s=$(tr -d '\n' < "$_sf" 2>/dev/null | cut -c1-50)
      printf "\033[2A\r\033[K  [\033[36m%s\033[0m\033[2m%s\033[0m] \033[1;36m 92%%\033[0m  \033[2m%s\033[0m\n\033[K  \033[36m%s\033[0m \033[2m%s\033[0m\n" \
        "$bf92" "$be92" "$label" "$sp" "$_s" >/dev/tty 2>/dev/null
      si=$(( si+1 ))
      sleep 0.15
    done
  } &
  _MB_BG_PID=$!
}

mini_bar2_ok() {
  local label="${1:-Selesai}" sub="${2:-}"
  [ -n "$_MB_BG_PID" ] && { kill "$_MB_BG_PID" 2>/dev/null; wait "$_MB_BG_PID" 2>/dev/null; _MB_BG_PID=""; }
  local full="" j=0
  while [ $j -lt $_MB_W ]; do full="${full}█"; j=$(( j+1 )); done
  printf "\033[2A\r\033[K  [\033[32m%s\033[0m] \033[1;32m100%%\033[0m  \033[32m✅ %s\033[0m            \n\033[K  \033[32m   %s\033[0m\n" \
    "$full" "$label" "$sub" >/dev/tty 2>/dev/null
}

mini_bar2_fail() {
  local label="${1:-Gagal}" sub="${2:-}"
  [ -n "$_MB_BG_PID" ] && { kill "$_MB_BG_PID" 2>/dev/null; wait "$_MB_BG_PID" 2>/dev/null; _MB_BG_PID=""; }
  local half="" be="" j=0
  while [ $j -lt $(( _MB_W * 9 / 10 )) ]; do half="${half}▒"; j=$(( j+1 )); done
  while [ $j -lt $_MB_W ]; do be="${be}░"; j=$(( j+1 )); done
  printf "\033[2A\r\033[K  [\033[31m%s\033[0m\033[2m%s\033[0m] \033[1;31m ERR\033[0m  \033[31m❌ %s\033[0m            \n\033[K  \033[31m   %s\033[0m\n" \
    "$half" "$be" "$label" "$sub" >/dev/tty 2>/dev/null
}

CUSTOM_MSG="${1:-}"

# ===== Startup loading — realtime step-by-step (0–100%) =====
_SB_W=26          # lebar bar
_SB_BG_PID=""     # PID background sweeper (untuk step lambat / network)

_sbar_draw() {
  local pct=$1 msg="$2"
  [ "$pct" -gt 100 ] && pct=100
  local f=$(( pct * _SB_W / 100 ))
  local bf="" be="" j=0
  while [ $j -lt $f ];        do bf="${bf}█"; j=$(( j+1 )); done
  while [ $j -lt $_SB_W ];   do be="${be}░"; j=$(( j+1 )); done
  if [ "$pct" -ge 100 ]; then
    printf "\r  [\033[32m%s\033[0m] \033[1;32m100%%\033[0m  \033[1m%s\033[0m            " \
      "$bf" "$msg" >/dev/tty 2>/dev/null
  else
    printf "\r  [\033[32m%s\033[0m\033[2m%s\033[0m] \033[1;36m%3d%%\033[0m  \033[2m%s\033[0m   " \
      "$bf" "$be" "$pct" "$msg" >/dev/tty 2>/dev/null
  fi
}

# Sweep pct from→to dengan delay antar langkah
_sbar_sweep() {
  local from=$1 to=$2 delay=$3 msg="$4"
  local p=$from
  while [ "$p" -le "$to" ]; do
    _sbar_draw "$p" "$msg"
    p=$(( p + 1 ))
    sleep "$delay"
  done
}

# Background sweeper untuk operasi lambat (network).
# Maju pelan dari from→to lalu diam di to sampai di-kill.
_sbar_bg_start() {
  local from=$1 to=$2 delay=$3 msg="$4"
  {
    local p=$from
    while [ "$p" -le "$to" ]; do
      _sbar_draw "$p" "$msg"
      p=$(( p + 1 ))
      sleep "$delay"
    done
    while true; do _sbar_draw "$to" "$msg"; sleep 0.4; done
  } &
  _SB_BG_PID=$!
}

_sbar_bg_stop() {
  if [ -n "$_SB_BG_PID" ]; then
    kill "$_SB_BG_PID" 2>/dev/null
    wait "$_SB_BG_PID" 2>/dev/null
    _SB_BG_PID=""
  fi
}

# Tampilkan banner + bar di 0%
startup_begin() {
  clear >/dev/tty 2>/dev/null || true
  printf "\n  \033[1m╔══════════════════════════════════════╗\033[0m\n" >/dev/tty
  printf "  \033[1m║   🚀  PUSH SCRIPT — BANG WILY        ║\033[0m\n" >/dev/tty
  printf "  \033[1m╚══════════════════════════════════════╝\033[0m\n\n" >/dev/tty
  printf "  \033[2m👤 %-16s  📁 %s\033[0m\n\n" "$USER" "${USER}/${REPO}" >/dev/tty
  _sbar_draw 0 "Inisialisasi ..."
}

# Tampilkan 100% + pesan sukses
startup_done() {
  _sbar_bg_stop
  _sbar_draw 100 "Siap!"
  printf "\n\n  \033[32m✅\033[0m  Login berhasil — \033[1m%s\033[0m  →  \033[1;32m%s\033[0m\n" \
    "$USER" "$REPO" >/dev/tty 2>/dev/null
  printf "  \033[2m   Default branch : %s\033[0m\n\n" "$DEFAULT_BRANCH" >/dev/tty 2>/dev/null
  sleep 0.4
}

# ===== Helper: buka URL di browser (Termux / Linux / macOS) =====
open_url() {
  local url="$1"
  if command -v termux-open-url >/dev/null 2>&1; then
    termux-open-url "$url" 2>/dev/null &
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" 2>/dev/null &
  elif command -v open >/dev/null 2>&1; then
    open "$url" 2>/dev/null &
  else
    return 1
  fi
  return 0
}

# ===== Layar generate token otomatis =====
# Buka halaman GitHub pre-filled → scope repo sudah tercentang otomatis.
screen_generate_token() {
  # Semua scope dari GitHub PAT classic — tercentang otomatis saat halaman terbuka
  local _ALL_SCOPES="repo,repo:status,repo_deployment,public_repo,repo:invite,security_events"
  _ALL_SCOPES="${_ALL_SCOPES},workflow"
  _ALL_SCOPES="${_ALL_SCOPES},write:packages,read:packages,delete:packages"
  _ALL_SCOPES="${_ALL_SCOPES},admin:org,write:org,read:org,manage_runners:org"
  _ALL_SCOPES="${_ALL_SCOPES},admin:public_key,write:public_key,read:public_key"
  _ALL_SCOPES="${_ALL_SCOPES},admin:repo_hook,write:repo_hook,read:repo_hook"
  _ALL_SCOPES="${_ALL_SCOPES},admin:org_hook"
  _ALL_SCOPES="${_ALL_SCOPES},gist,notifications"
  _ALL_SCOPES="${_ALL_SCOPES},user,read:user,user:email,user:follow"
  _ALL_SCOPES="${_ALL_SCOPES},delete_repo"
  _ALL_SCOPES="${_ALL_SCOPES},write:discussion,read:discussion"
  _ALL_SCOPES="${_ALL_SCOPES},admin:enterprise,manage_runners:enterprise,manage_billing:enterprise,read:enterprise,scim:enterprise"
  _ALL_SCOPES="${_ALL_SCOPES},audit_log,read:audit_log"
  _ALL_SCOPES="${_ALL_SCOPES},codespace,codespace:secrets"
  _ALL_SCOPES="${_ALL_SCOPES},copilot,manage_billing:copilot"
  _ALL_SCOPES="${_ALL_SCOPES},write:network_configurations,read:network_configurations"
  _ALL_SCOPES="${_ALL_SCOPES},project,read:project"
  _ALL_SCOPES="${_ALL_SCOPES},admin:gpg_key,write:gpg_key,read:gpg_key"
  _ALL_SCOPES="${_ALL_SCOPES},admin:ssh_signing_key,write:ssh_signing_key,read:ssh_signing_key"
  local _BASE_URL="https://github.com/settings/tokens/new?description=BangWilyPushScript&scopes=${_ALL_SCOPES}"

  # ── Pilih Expiration ──
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╔══════════════════════════════════════════════════╗${C_RESET}" >&2
  echo -e "${C_BOLD}║     🔑  GENERATE TOKEN OTOMATIS — BANG WILY      ║${C_RESET}" >&2
  echo -e "${C_BOLD}╚══════════════════════════════════════════════════╝${C_RESET}" >&2
  echo "" >&2
  echo -e "${C_BOLD}Pilih masa berlaku token:${C_RESET}" >&2
  echo "" >&2
  echo -e "  ${C_GREEN}1${C_RESET} No expiration  ${C_DIM}(tidak ada batas waktu — praktis)${C_RESET}" >&2
  echo -e "  ${C_CYAN}2${C_RESET} 1 tahun        ${C_DIM}(365 hari)${C_RESET}" >&2
  echo -e "  ${C_CYAN}3${C_RESET} 90 hari" >&2
  echo -e "  ${C_CYAN}4${C_RESET} 30 hari" >&2
  echo "" >&2
  printf "${C_BOLD}  Pilih [1/2/3/4] ▸ ${C_RESET}" >&2

  local exp_pick="" exp_label="" exp_param=""
  read -r exp_pick </dev/tty
  exp_pick="${exp_pick:-1}"

  # URL dibangun SETELAH pilihan expiration agar parameter &expiration= ikut terkirim ke GitHub
  case "$exp_pick" in
    2) exp_label="1 tahun (365 hari)"; exp_param="365" ;;
    3) exp_label="90 hari";            exp_param="90"  ;;
    4) exp_label="30 hari";            exp_param="30"  ;;
    *) exp_pick="1"; exp_label="No expiration"; exp_param="no_expiry" ;;
  esac

  local TOKEN_URL="${_BASE_URL}&expiration=${exp_param}"

  # ── Buka browser & tampilkan instruksi ──
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╔══════════════════════════════════════════════════╗${C_RESET}" >&2
  echo -e "${C_BOLD}║     🔑  GENERATE TOKEN OTOMATIS — BANG WILY      ║${C_RESET}" >&2
  echo -e "${C_BOLD}╚══════════════════════════════════════════════════╝${C_RESET}" >&2
  echo "" >&2
  echo -e "${C_DIM}  Semua scope sudah tercentang • nama token sudah terisi${C_RESET}" >&2
  echo -e "${C_DIM}  Expiration sudah di-set: ${C_RESET}${C_GREEN}${C_BOLD}${exp_label}${C_RESET}" >&2
  echo "" >&2

  if open_url "$TOKEN_URL"; then
    echo -e "  ${C_GREEN}✅ Browser terbuka!${C_RESET}" >&2
    echo -e "  ${C_DIM}   Kalau tidak terbuka, copy URL di bawah:${C_RESET}" >&2
  else
    echo -e "  ${C_YELLOW}⚠️  Tidak bisa buka browser otomatis.${C_RESET}" >&2
    echo -e "  ${C_DIM}   Copy URL berikut → buka di browser kamu:${C_RESET}" >&2
  fi

  echo "" >&2
  echo -e "  ${C_BLUE}${TOKEN_URL}${C_RESET}" >&2
  echo "" >&2
  echo -e "${C_DIM}─────────────────────────────────────────────────${C_RESET}" >&2
  echo -e "${C_BOLD}Langkah di GitHub:${C_RESET}" >&2
  echo -e "  ${C_CYAN}1.${C_RESET} Pastikan kolom ${C_BOLD}Expiration${C_RESET} sudah menampilkan ${C_GREEN}${C_BOLD}${exp_label}${C_RESET}" >&2
  echo -e "       ${C_YELLOW}(GitHub default 30 hari — cek & ubah kalau perlu!)${C_RESET}" >&2
  echo -e "  ${C_CYAN}2.${C_RESET} Klik ${C_BOLD}Generate token${C_RESET} (tombol hijau, paling bawah)" >&2
  echo -e "  ${C_CYAN}3.${C_RESET} Copy token yang muncul → paste di sini" >&2
  echo "" >&2
  echo -e "${C_DIM}─────────────────────────────────────────────────${C_RESET}" >&2
  printf "${C_BOLD}  Paste token baru ▸ ${C_RESET}" >&2

  local input_tok=""
  read -rs input_tok </dev/tty
  echo "" >&2
  input_tok=$(echo "$input_tok" | tr -d '\n\r ')

  if [ -z "$input_tok" ] || echo "$input_tok" | grep -qE '^(#|ghp_x|TOKEN_KAMU|ISI_TOKEN|CONTOH|<|your)'; then
    echo -e "  ${C_RED}❌ Token kosong atau tidak valid.${C_RESET}" >&2
    sleep 1
    echo ""
    return
  fi

  printf '%s' "$input_tok" > .token.secret
  _save_token_backup "$input_tok"
  echo "" >&2
  echo -e "  ${C_GREEN}✅ Token disimpan ke .token.secret${C_RESET}" >&2
  echo -e "  ${C_DIM}   File ini gitignored — aman, tidak ke-upload ke GitHub${C_RESET}" >&2
  echo "" >&2
  local _ts_tok; _ts_tok=$(date '+%H:%M:%S %d %b %Y')
  local _masked_tok="${input_tok:0:10}****${input_tok: -4}"
  local _btn_tok1='{"inline_keyboard":[[{"text":"🔑 Kelola Token","url":"https://github.com/settings/tokens"},{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"}],[{"text":"🔒 Security","url":"https://github.com/settings/security"},{"text":"⚙️ Settings","url":"https://github.com/settings/profile"}]]}'
  send_telegram_photo "https://w.wallhaven.cc/full/0q/wallhaven-0qe5er.png" "🔐 <b>TOKEN BARU DISIMPAN</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${USER}</code>
📁 <code>${USER}/${REPO}</code>
🏷 Generate Token Baru
🔑 <code>${_masked_tok}</code>
━━━━━━━━━━━━━━━━━━━━
🕐 ${_ts_tok}" "$_btn_tok1" 2>/dev/null &
  sleep 1
  echo "$input_tok"
}

# ===== Layar input token manual =====
screen_manual_token() {
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╔══════════════════════════════════════════════════╗${C_RESET}" >&2
  echo -e "${C_BOLD}║        🔐  INPUT TOKEN MANUAL — BANG WILY        ║${C_RESET}" >&2
  echo -e "${C_BOLD}╚══════════════════════════════════════════════════╝${C_RESET}" >&2
  echo "" >&2
  echo -e "${C_DIM}  Pastikan token punya scope: ${C_BOLD}repo${C_RESET}${C_DIM} (full control)${C_RESET}" >&2
  echo "" >&2
  echo -e "${C_DIM}─────────────────────────────────────────────────${C_RESET}" >&2
  printf "${C_BOLD}  Paste token kamu ▸ ${C_RESET}" >&2

  local input_tok=""
  read -rs input_tok </dev/tty
  echo "" >&2
  input_tok=$(echo "$input_tok" | tr -d '\n\r ')

  if [ -z "$input_tok" ] || echo "$input_tok" | grep -qE '^(#|ghp_x|TOKEN_KAMU|ISI_TOKEN|CONTOH|<|your)'; then
    echo -e "  ${C_RED}❌ Token kosong atau tidak valid.${C_RESET}" >&2
    sleep 1
    echo ""
    return
  fi

  printf '%s' "$input_tok" > .token.secret
  _save_token_backup "$input_tok"
  echo "" >&2
  echo -e "  ${C_GREEN}✅ Token disimpan ke .token.secret${C_RESET}" >&2
  echo -e "  ${C_DIM}   File ini gitignored — aman, tidak ke-upload ke GitHub${C_RESET}" >&2
  echo "" >&2
  local _ts_tok2; _ts_tok2=$(date '+%H:%M:%S %d %b %Y')
  local _masked_tok2="${input_tok:0:10}****${input_tok: -4}"
  local _btn_tok2='{"inline_keyboard":[[{"text":"🔑 Kelola Token","url":"https://github.com/settings/tokens"},{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"}],[{"text":"🔒 Security","url":"https://github.com/settings/security"},{"text":"⚙️ Settings","url":"https://github.com/settings/profile"}]]}'
  send_telegram_photo "https://w.wallhaven.cc/full/0q/wallhaven-0qe5yl.jpg" "🔐 <b>TOKEN MANUAL DISIMPAN</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${USER}</code>
📁 <code>${USER}/${REPO}</code>
🏷 Input Manual
🔑 <code>${_masked_tok2}</code>
━━━━━━━━━━━━━━━━━━━━
🕐 ${_ts_tok2}" "$_btn_tok2" 2>/dev/null &
  sleep 1
  echo "$input_tok"
}

# ===== Baca token =====
# Urutan prioritas:
#   1. .token.secret  → file token asli (GITIGNORED, aman)
#   2. ~/.wily_token_backup → backup di home dir (persist di Replit)
#   3. Belum ada / tidak valid → langsung minta paste token
_TOKEN_BACKUP="$HOME/.wily_token_backup"

_save_token_backup() {
  local _t="$1"
  [ -n "$_t" ] && printf '%s' "$_t" > "$_TOKEN_BACKUP" 2>/dev/null
  chmod 600 "$_TOKEN_BACKUP" 2>/dev/null || true
}

_delete_token_backup() {
  rm -f "$_TOKEN_BACKUP" 2>/dev/null
}

setup_token() {
  local tok=""

  # Coba baca dari .token.secret
  if [ -f .token.secret ]; then
    tok=$(tr -d '\n\r ' < .token.secret)
  fi

  # Fallback: baca dari backup di home dir (jika .token.secret hilang di Replit)
  if [ -z "$tok" ] && [ -f "$_TOKEN_BACKUP" ]; then
    tok=$(tr -d '\n\r ' < "$_TOKEN_BACKUP")
    if [ -n "$tok" ] && ! echo "$tok" | grep -qE '^(#|TOKEN_KAMU|ISI_TOKEN|CONTOH|<|your_)'; then
      printf '%s' "$tok" > .token.secret 2>/dev/null
      echo -e "  ${C_GREEN}✅ Token dipulihkan dari backup${C_RESET}" >&2
    else
      tok=""
    fi
  fi

  # Kalau masih kosong atau placeholder, langsung minta input token
  # Catatan: ghp_x SENGAJA tidak dimasukkan — token valid bisa berawalan ghp_x
  while [ -z "$tok" ] || echo "$tok" | grep -qE '^(#|TOKEN_KAMU|ISI_TOKEN|CONTOH|<|your_)'; do

    # ── Layar 1: Pilih jenis token ──────────────────────────────────────────
    clear >/dev/tty 2>/dev/null || true
    echo -e "${C_BOLD}╔══════════════════════════════════════════════════╗${C_RESET}" >&2
    echo -e "${C_BOLD}║        🔐  TOKEN GITHUB — BANG WILY              ║${C_RESET}" >&2
    echo -e "${C_BOLD}╚══════════════════════════════════════════════════╝${C_RESET}" >&2
    echo "" >&2
    if [ ! -f .token.secret ]; then
      echo -e "  ${C_YELLOW}⚠️  File .token.secret belum ada.${C_RESET}" >&2
    else
      echo -e "  ${C_YELLOW}⚠️  Token tidak valid / placeholder.${C_RESET}" >&2
    fi

    # ── Status node_modules ──────────────────────────────────────────────────
    local _nm_missing=0
    if [ ! -d node_modules ] || [ ! -f node_modules/.package-lock.json ] && [ ! -f package-lock.json ] || [ ! -d node_modules/.bin ]; then
      if [ ! -d node_modules ] || [ ! -d node_modules/.bin ]; then
        _nm_missing=1
      fi
    fi
    if [ "$_nm_missing" = "1" ]; then
      echo -e "  ${C_RED}📦  node_modules belum ada / belum di-install.${C_RESET}" >&2
    else
      echo -e "  ${C_GREEN}📦  node_modules${C_RESET}${C_DIM} — sudah terinstall ✓${C_RESET}" >&2
    fi
    echo "" >&2

    echo -e "  ${C_BOLD}Pilih opsi:${C_RESET}" >&2
    echo "" >&2
    echo -e "  ${C_CYAN}[1]${C_RESET} ${C_BOLD}Classic Token${C_RESET}         ${C_DIM}— belum punya, buat baru  (ghp_...)${C_RESET}" >&2
    echo -e "  ${C_CYAN}[2]${C_RESET} ${C_BOLD}Fine-grained Token${C_RESET}    ${C_DIM}— belum punya, buat baru  (github_pat_...)${C_RESET}" >&2
    echo -e "  ${C_CYAN}[3]${C_RESET} ${C_BOLD}Sudah punya token${C_RESET}     ${C_DIM}— langsung paste token lama / yang sudah ada${C_RESET}" >&2
    # Opsi 4 hanya muncul kalau file .token.secret benar-benar ada
    if [ -f .token.secret ]; then
      echo -e "  ${C_RED}[4]${C_RESET} ${C_BOLD}Hapus token tersimpan${C_RESET} ${C_DIM}— reset .token.secret${C_RESET}" >&2
    fi
    # Opsi 5: install node_modules (selalu tampil)
    if [ "$_nm_missing" = "1" ]; then
      echo -e "  ${C_MAGENTA}[5]${C_RESET} ${C_BOLD}Install node_modules${C_RESET}  ${C_DIM}— jalankan npm install sekarang${C_RESET}  ${C_RED}⚠ belum ada${C_RESET}" >&2
    else
      echo -e "  ${C_MAGENTA}[5]${C_RESET} ${C_BOLD}Install node_modules${C_RESET}  ${C_DIM}— jalankan npm install ulang${C_RESET}" >&2
    fi
    echo -e "  ${C_DIM}[0]${C_RESET} ${C_DIM}Keluar${C_RESET}" >&2
    echo "" >&2
    echo -e "${C_DIM}  ─────────────────────────────────────────────────${C_RESET}" >&2
    if [ -f .token.secret ]; then
      printf "  ${C_BOLD}Pilih [0/1/2/3/4/5] ▸ ${C_RESET}" >&2
    else
      printf "  ${C_BOLD}Pilih [0/1/2/3/5] ▸ ${C_RESET}" >&2
    fi
    local _tok_type=""
    read -r _tok_type </dev/tty
    _tok_type=$(echo "$_tok_type" | tr -d '\n\r ')

    # ── Pilihan 0: keluar ────────────────────────────────────────────────────
    if [ "$_tok_type" = "0" ]; then
      clear >/dev/tty 2>/dev/null || true
      echo -e "\n  ${C_GREEN}👋  Keluar dari Push Script — sampai jumpa, Bang!${C_RESET}\n" >&2
      sleep 0.4
      echo "__EXIT__"
      exit 0
    fi

    # ── Pilihan 5: install node_modules ─────────────────────────────────────
    if [ "$_tok_type" = "5" ]; then
      action_install_node_modules
      tok=""
      continue
    fi

    # ── Pilihan 4: hapus token tersimpan ────────────────────────────────────
    if [ "$_tok_type" = "4" ]; then
      if [ -f .token.secret ]; then
        rm -f .token.secret
        _delete_token_backup
        clear >/dev/tty 2>/dev/null || true
        echo -e "${C_BOLD}╔══════════════════════════════════════════════════╗${C_RESET}" >&2
        echo -e "${C_BOLD}║        🔐  TOKEN GITHUB — BANG WILY              ║${C_RESET}" >&2
        echo -e "${C_BOLD}╚══════════════════════════════════════════════════╝${C_RESET}" >&2
        echo "" >&2
        echo -e "  ${C_GREEN}✅ .token.secret berhasil dihapus.${C_RESET}" >&2
        echo -e "  ${C_DIM}   Silakan pilih opsi 1, 2, atau 3 untuk memasukkan token baru.${C_RESET}" >&2
        echo "" >&2
        local _ts_del; _ts_del=$(date '+%H:%M:%S %d %b %Y')
        local _btn_tokdel='{"inline_keyboard":[[{"text":"🔑 Buat Token Baru","url":"https://github.com/settings/tokens/new"},{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"}],[{"text":"⚙️ Settings GitHub","url":"https://github.com/settings"},{"text":"🔒 Security","url":"https://github.com/settings/security"}]]}'
        send_telegram_photo "https://w.wallhaven.cc/full/28/wallhaven-28mlj9.jpg" "🗑 <b>TOKEN DIHAPUS</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${USER}</code>
📁 <code>${USER}/${REPO}</code>
⚠️ .token.secret dihapus dari perangkat
🔓 Script butuh token baru untuk push
━━━━━━━━━━━━━━━━━━━━
🕐 ${_ts_del}" "$_btn_tokdel" 2>/dev/null &
        sleep 2
      fi
      tok=""
      continue
    fi

    # ── Pilihan 3: langsung paste, skip instruksi ────────────────────────────
    if [ "$_tok_type" = "3" ]; then
      clear >/dev/tty 2>/dev/null || true
      echo -e "${C_BOLD}╔══════════════════════════════════════════════════╗${C_RESET}" >&2
      echo -e "${C_BOLD}║        🔐  TOKEN GITHUB — BANG WILY              ║${C_RESET}" >&2
      echo -e "${C_BOLD}╚══════════════════════════════════════════════════╝${C_RESET}" >&2
      echo "" >&2
      echo -e "  ${C_DIM}Paste token kamu di bawah (Classic / Fine-grained, keduanya diterima).${C_RESET}" >&2
      echo -e "  ${C_DIM}Ketik ${C_RESET}${C_BOLD}0${C_RESET}${C_DIM} lalu Enter untuk kembali ke menu.${C_RESET}" >&2
      echo "" >&2
      echo -e "${C_DIM}  ─────────────────────────────────────────────────${C_RESET}" >&2
      printf "  ${C_BOLD}Paste token  [0 = kembali] ▸ ${C_RESET}" >&2

      local input_tok3=""
      read -rs input_tok3 </dev/tty
      echo "" >&2
      input_tok3=$(echo "$input_tok3" | tr -d '\n\r ')

      if [ "$input_tok3" = "0" ]; then
        tok=""
        continue
      fi

      if [ -z "$input_tok3" ] || echo "$input_tok3" | grep -qE '^(#|TOKEN_KAMU|ISI_TOKEN|CONTOH|<|your_)'; then
        echo -e "  ${C_RED}❌ Token kosong atau tidak valid. Coba lagi.${C_RESET}" >&2
        sleep 1
        tok=""
        continue
      fi

      # Auto-detect jenis token dari prefix
      local _det3_label="" _det3_color="$C_GREEN"
      case "$input_tok3" in
        ghp_*)          _det3_label="Classic Token  (ghp_...)" ;;
        github_pat_*)   _det3_label="Fine-grained Token  (github_pat_...)" ;;
        ghs_*)          _det3_label="Server-to-Server Token  (ghs_...)"; _det3_color="$C_YELLOW" ;;
        gho_*)          _det3_label="OAuth App Token  (gho_...)";         _det3_color="$C_YELLOW" ;;
        ghu_*)          _det3_label="OAuth User Token  (ghu_...)";        _det3_color="$C_YELLOW" ;;
        *)              _det3_label="Token tidak dikenal / format non-standar"; _det3_color="$C_RED" ;;
      esac

      printf '%s' "$input_tok3" > .token.secret
      clear >/dev/tty 2>/dev/null || true
      echo -e "${C_BOLD}╔══════════════════════════════════════════════════╗${C_RESET}" >&2
      echo -e "${C_BOLD}║        🔐  TOKEN GITHUB — BANG WILY              ║${C_RESET}" >&2
      echo -e "${C_BOLD}╚══════════════════════════════════════════════════╝${C_RESET}" >&2
      echo "" >&2
      echo -e "  ${C_DIM}Jenis token terdeteksi:${C_RESET}" >&2
      echo -e "  ${_det3_color}${C_BOLD}▶ ${_det3_label}${C_RESET}" >&2
      echo "" >&2
      echo -e "  ${C_GREEN}✅ Token disimpan ke .token.secret${C_RESET}" >&2
      echo -e "  ${C_DIM}   File ini gitignored — aman, tidak ke-upload ke GitHub${C_RESET}" >&2
      echo "" >&2
      local _ts_tok3; _ts_tok3=$(date '+%H:%M:%S %d %b %Y')
      local _masked_tok3="${input_tok3:0:10}****${input_tok3: -4}"
      _save_token_backup "$input_tok3"
      local _btn_tok3='{"inline_keyboard":[[{"text":"🔑 Kelola Token","url":"https://github.com/settings/tokens"},{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"}],[{"text":"🔒 Security","url":"https://github.com/settings/security"},{"text":"⚙️ Settings","url":"https://github.com/settings/profile"}]]}'
      send_telegram_photo "https://w.wallhaven.cc/full/8x/wallhaven-8x9er2.jpg" "🔐 <b>TOKEN DISIMPAN (PASTE)</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${USER}</code>
📁 <code>${USER}/${REPO}</code>
🏷 ${_det3_label}
🔑 <code>${_masked_tok3}</code>
━━━━━━━━━━━━━━━━━━━━
🕐 ${_ts_tok3}" "$_btn_tok3" 2>/dev/null &
      sleep 1
      tok="$input_tok3"
      continue
    fi

    # ── Layar 2: Instruksi sesuai pilihan 1 / 2 ─────────────────────────────
    clear >/dev/tty 2>/dev/null || true
    echo -e "${C_BOLD}╔══════════════════════════════════════════════════╗${C_RESET}" >&2
    echo -e "${C_BOLD}║        🔐  TOKEN GITHUB — BANG WILY              ║${C_RESET}" >&2
    echo -e "${C_BOLD}╚══════════════════════════════════════════════════╝${C_RESET}" >&2
    echo "" >&2

    # URL pre-filled: name/note, scope/permissions sudah otomatis terisi saat dibuka
    local _all_scopes="repo,repo%3Astatus,repo_deployment,public_repo,repo%3Ainvite,security_events,workflow,write%3Apackages,read%3Apackages,delete%3Apackages,admin%3Aorg,write%3Aorg,read%3Aorg,manage_runners%3Aorg,admin%3Apublic_key,write%3Apublic_key,read%3Apublic_key,admin%3Arepo_hook,write%3Arepo_hook,read%3Arepo_hook,admin%3Aorg_hook,gist,notifications,user,read%3Auser,user%3Aemail,user%3Afollow,delete_repo,write%3Adiscussion,read%3Adiscussion,admin%3Aenterprise,manage_runners%3Aenterprise,manage_billing%3Aenterprise,read%3Aenterprise,scim%3Aenterprise,audit_log,read%3Aaudit_log,codespace,codespace%3Asecrets,copilot,manage_billing%3Acopilot,write%3Anetwork_configurations,read%3Anetwork_configurations,project,read%3Aproject,admin%3Agpg_key,write%3Agpg_key,read%3Agpg_key,admin%3Assh_signing_key,write%3Assh_signing_key,read%3Assh_signing_key"
    local _url_classic="https://github.com/settings/tokens/new?description=${REPO}&scopes=${_all_scopes}"
    local _url_finegrained="https://github.com/settings/personal-access-tokens/new?name=${REPO}&description=Token+push+script+WilyBot&repository_access=all&permissions%5Bcontents%5D=write&permissions%5Bmetadata%5D=read"

    if [ "$_tok_type" = "2" ]; then
      echo -e "  ${C_BOLD}Fine-grained Token${C_RESET} ${C_DIM}(berawalan github_pat_...)${C_RESET}" >&2
      echo "" >&2
      echo -e "  ${C_CYAN}1.${C_RESET} Buka URL ini ${C_DIM}(form sudah otomatis terisi)${C_RESET}:" >&2
      echo -e "     ${C_BLUE}${_url_finegrained}${C_RESET}" >&2
      echo "" >&2
      echo -e "  ${C_CYAN}2.${C_RESET} Cek isian yang sudah auto-terisi:" >&2
      echo -e "     ${C_DIM}• Token name       :${C_RESET} ${C_BOLD}${REPO}${C_RESET} ${C_DIM}(bisa diganti)${C_RESET}" >&2
      echo -e "     ${C_DIM}• Repository access:${C_RESET} ${C_BOLD}All repositories${C_RESET}" >&2
      echo -e "     ${C_DIM}• Contents         :${C_RESET} ${C_BOLD}Read and write${C_RESET} ${C_DIM}(sudah tercentang)${C_RESET}" >&2
      echo -e "     ${C_DIM}• Metadata         :${C_RESET} ${C_BOLD}Read-only${C_RESET} ${C_DIM}(sudah tercentang)${C_RESET}" >&2
      echo "" >&2
      echo -e "  ${C_CYAN}3.${C_RESET} Set ${C_BOLD}Expiration → No expiration${C_RESET} ${C_DIM}(disarankan)${C_RESET}" >&2
      echo "" >&2
      echo -e "  ${C_CYAN}4.${C_RESET} Scroll bawah → klik ${C_BOLD}Generate token${C_RESET} → copy token-nya" >&2
    else
      echo -e "  ${C_BOLD}Classic Token${C_RESET} ${C_DIM}(berawalan ghp_...)${C_RESET}" >&2
      echo "" >&2
      echo -e "  ${C_CYAN}1.${C_RESET} Buka URL ini ${C_DIM}(form sudah otomatis terisi)${C_RESET}:" >&2
      echo -e "     ${C_BLUE}${_url_classic}${C_RESET}" >&2
      echo "" >&2
      echo -e "  ${C_CYAN}2.${C_RESET} Cek isian yang sudah auto-terisi:" >&2
      echo -e "     ${C_DIM}• Note  :${C_RESET} ${C_BOLD}${REPO}${C_RESET} ${C_DIM}(bisa diganti)${C_RESET}" >&2
      echo -e "     ${C_DIM}• Scope :${C_RESET} ${C_BOLD}repo${C_RESET} ${C_DIM}(sudah tercentang — full control)${C_RESET}" >&2
      echo "" >&2
      echo -e "  ${C_CYAN}3.${C_RESET} Set ${C_BOLD}Expiration → No expiration${C_RESET} ${C_DIM}(disarankan)${C_RESET}" >&2
      echo "" >&2
      echo -e "  ${C_CYAN}4.${C_RESET} Scroll bawah → klik ${C_BOLD}Generate token${C_RESET} → copy token-nya" >&2
    fi

    echo "" >&2
    echo -e "  ${C_DIM}Ketik ${C_RESET}${C_BOLD}0${C_RESET}${C_DIM} lalu Enter untuk kembali ke menu awal.${C_RESET}" >&2
    echo -e "${C_DIM}  ─────────────────────────────────────────────────${C_RESET}" >&2
    printf "  ${C_BOLD}Paste token  [0 = kembali] ▸ ${C_RESET}" >&2

    local input_tok=""
    read -rs input_tok </dev/tty
    echo "" >&2
    input_tok=$(echo "$input_tok" | tr -d '\n\r ')

    if [ "$input_tok" = "0" ]; then
      tok=""
      continue
    fi

    if [ -z "$input_tok" ] || echo "$input_tok" | grep -qE '^(#|TOKEN_KAMU|ISI_TOKEN|CONTOH|<|your_)'; then
      echo -e "  ${C_RED}❌ Token kosong atau tidak valid. Coba lagi.${C_RESET}" >&2
      sleep 1
      tok=""
      continue
    fi

    # ── Auto-detect jenis token dari prefix ────────────────────────────────
    local _detected_type="" _detected_label="" _detected_color=""
    case "$input_tok" in
      ghp_*)
        _detected_type="classic"
        _detected_label="Classic Token  (ghp_...)"
        _detected_color="$C_GREEN"
        ;;
      github_pat_*)
        _detected_type="finegrained"
        _detected_label="Fine-grained Token  (github_pat_...)"
        _detected_color="$C_GREEN"
        ;;
      ghs_*)
        _detected_type="server"
        _detected_label="Server-to-Server Token  (ghs_...)"
        _detected_color="$C_YELLOW"
        ;;
      gho_*)
        _detected_type="oauth"
        _detected_label="OAuth App Token  (gho_...)"
        _detected_color="$C_YELLOW"
        ;;
      ghu_*)
        _detected_type="oauth_user"
        _detected_label="OAuth User Token  (ghu_...)"
        _detected_color="$C_YELLOW"
        ;;
      *)
        _detected_type="unknown"
        _detected_label="Token tidak dikenal / format non-standar"
        _detected_color="$C_RED"
        ;;
    esac

    # Cek mismatch: user pilih tipe X tapi paste token tipe Y
    local _mismatch=0
    if [ "$_tok_type" = "1" ] && [ "$_detected_type" != "classic" ]; then
      _mismatch=1
    elif [ "$_tok_type" = "2" ] && [ "$_detected_type" != "finegrained" ]; then
      _mismatch=1
    fi

    # ── Layar 3: Konfirmasi simpan ─────────────────────────────────────────
    clear >/dev/tty 2>/dev/null || true
    echo -e "${C_BOLD}╔══════════════════════════════════════════════════╗${C_RESET}" >&2
    echo -e "${C_BOLD}║        🔐  TOKEN GITHUB — BANG WILY              ║${C_RESET}" >&2
    echo -e "${C_BOLD}╚══════════════════════════════════════════════════╝${C_RESET}" >&2
    echo "" >&2
    echo -e "  ${C_DIM}Jenis token terdeteksi:${C_RESET}" >&2
    echo -e "  ${_detected_color}${C_BOLD}▶ ${_detected_label}${C_RESET}" >&2
    echo "" >&2

    if [ "$_mismatch" -eq 1 ]; then
      if [ "$_tok_type" = "1" ]; then
        echo -e "  ${C_YELLOW}⚠️  Kamu pilih Classic tapi paste token ${_detected_label}.${C_RESET}" >&2
      else
        echo -e "  ${C_YELLOW}⚠️  Kamu pilih Fine-grained tapi paste token ${_detected_label}.${C_RESET}" >&2
      fi
      echo -e "  ${C_DIM}   Token tetap disimpan — validasi ke GitHub akan menentukan.${C_RESET}" >&2
      echo "" >&2
    fi

    printf '%s' "$input_tok" > .token.secret
    _save_token_backup "$input_tok"
    echo -e "  ${C_GREEN}✅ Token disimpan ke .token.secret${C_RESET}" >&2
    echo -e "  ${C_DIM}   File ini gitignored — aman, tidak ke-upload ke GitHub${C_RESET}" >&2
    echo "" >&2
    local _ts_t12; _ts_t12=$(date '+%H:%M:%S %d %b %Y')
    local _masked_t12="${input_tok:0:10}****${input_tok: -4}"
    local _btn_t12='{"inline_keyboard":[[{"text":"🔑 Kelola Token","url":"https://github.com/settings/tokens"},{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"}],[{"text":"🔒 Security","url":"https://github.com/settings/security"},{"text":"⚙️ Settings","url":"https://github.com/settings/profile"}]]}'
    send_telegram_photo "https://w.wallhaven.cc/full/8x/wallhaven-8xejz2.jpg" "🔐 <b>TOKEN DISIMPAN (INSTRUKSI)</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${USER}</code>
📁 <code>${USER}/${REPO}</code>
🏷 ${_detected_label:-Token}
🔑 <code>${_masked_t12}</code>
━━━━━━━━━━━━━━━━━━━━
🕐 ${_ts_t12}" "$_btn_t12" 2>/dev/null &
    sleep 1
    tok="$input_tok"
  done

  echo "$tok"
}

# ===== Hitung sisa hari dari tanggal expiry token =====
# $1 = string tanggal dari header GitHub-Authentication-Token-Expiration
#      contoh format: "2026-05-31 00:00:00 UTC"
# Output: angka sisa hari (bisa 0 atau negatif jika sudah lewat)
_token_days_left() {
  local exp_str="$1"
  # Ambil bagian tanggal saja (YYYY-MM-DD)
  local exp_date
  exp_date=$(echo "$exp_str" | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' | head -1)
  [ -z "$exp_date" ] && echo "?" && return

  local exp_epoch now_epoch
  exp_epoch=$(date -d "$exp_date" +%s 2>/dev/null || date -j -f "%Y-%m-%d" "$exp_date" +%s 2>/dev/null)
  now_epoch=$(date +%s)

  [ -z "$exp_epoch" ] && echo "?" && return
  echo $(( (exp_epoch - now_epoch) / 86400 ))
}

# ===== Tampilkan status masa berlaku token =====
# $1 = nilai header GitHub-Authentication-Token-Expiration (kosong = no expiry)
_print_token_expiry() {
  local exp_str="$1"

  if [ -z "$exp_str" ]; then
    echo -e "  ${C_GREEN}♾️  Masa berlaku: ${C_BOLD}No expiration${C_RESET}${C_GREEN} — token tidak akan expired${C_RESET}" >&2
    return
  fi

  local days_left
  days_left=$(_token_days_left "$exp_str")

  if [ "$days_left" = "?" ]; then
    echo -e "  ${C_DIM}  Masa berlaku: ${exp_str} (gagal parse tanggal)${C_RESET}" >&2
    return
  fi

  if [ "$days_left" -lt 0 ]; then
    echo -e "  ${C_RED}💀 Token SUDAH EXPIRED sejak ${exp_str}!${C_RESET}" >&2
  elif [ "$days_left" -eq 0 ]; then
    echo -e "  ${C_RED}🚨 Token EXPIRES HARI INI! Segera generate token baru.${C_RESET}" >&2
  elif [ "$days_left" -le 3 ]; then
    echo -e "  ${C_RED}🔴 Token expires dalam ${C_BOLD}${days_left} hari${C_RESET}${C_RED} (${exp_str}) — SEGERA perbarui!${C_RESET}" >&2
  elif [ "$days_left" -le 7 ]; then
    echo -e "  ${C_YELLOW}🟡 Token expires dalam ${C_BOLD}${days_left} hari${C_RESET}${C_YELLOW} (${exp_str}) — segera perbarui.${C_RESET}" >&2
  elif [ "$days_left" -le 30 ]; then
    echo -e "  ${C_YELLOW}🟠 Token expires dalam ${C_BOLD}${days_left} hari${C_RESET}${C_YELLOW} (${exp_str}).${C_RESET}" >&2
  else
    echo -e "  ${C_GREEN}✅ Masa berlaku: ${C_BOLD}${days_left} hari lagi${C_RESET}${C_GREEN} (${exp_str})${C_RESET}" >&2
  fi
}

# ===== Validasi token ke GitHub API secara real-time =====
# Cek apakah token benar-benar valid/aktif sebelum lanjut.
# Sekaligus cek & tampilkan masa berlaku token dari response header.
# Return 0 = valid, 1 = invalid/expired, 2 = tidak bisa cek (network error)
validate_token() {
  local tok="$1"
  local http_code login expiry_header

  echo -e "${C_DIM}  🔄 Memvalidasi token ke GitHub...${C_RESET}" >&2

  # Simpan headers ke file terpisah agar bisa baca GitHub-Authentication-Token-Expiration
  http_code=$(curl -s \
    -o /tmp/_gh_validate.json \
    -D /tmp/_gh_validate_headers.txt \
    -w "%{http_code}" \
    -H "Authorization: token ${tok}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/user" 2>/dev/null)

  case "$http_code" in
    200)
      login=$(grep -o '"login":"[^"]*"' /tmp/_gh_validate.json 2>/dev/null | head -1 | sed 's/"login":"//;s/"//')
      # Baca header masa berlaku token (kosong = no expiry)
      expiry_header=$(grep -i '^github-authentication-token-expiration:' /tmp/_gh_validate_headers.txt 2>/dev/null \
                      | sed 's/^[^:]*: *//;s/\r//' | head -1)
      echo -e "  ${C_GREEN}✅ Token valid!${C_RESET} Login sebagai: ${C_BOLD}${login}${C_RESET}" >&2
      _print_token_expiry "$expiry_header"
      rm -f /tmp/_gh_validate.json /tmp/_gh_validate_headers.txt
      return 0
      ;;
    401)
      rm -f /tmp/_gh_validate.json /tmp/_gh_validate_headers.txt
      echo "" >&2
      echo -e "  ${C_RED}❌ Token ditolak GitHub (HTTP 401).${C_RESET}" >&2
      echo -e "  ${C_YELLOW}   Token baru kadang butuh beberapa detik untuk aktif.${C_RESET}" >&2
      echo "" >&2
      printf "  ${C_BOLD}Tekan Enter untuk coba lagi, atau ketik 'baru' untuk ganti token ▸ ${C_RESET}" >&2
      local _retry_pick=""
      read -r _retry_pick </dev/tty
      _retry_pick=$(echo "$_retry_pick" | tr -d '\n\r ' | tr '[:upper:]' '[:lower:]')
      if [ "$_retry_pick" = "baru" ]; then
        rm -f .token.secret 2>/dev/null
        _delete_token_backup
        return 1
      fi
      # Coba lagi dengan token yang sama (jangan hapus file)
      return 1
      ;;
    403)
      rm -f /tmp/_gh_validate.json /tmp/_gh_validate_headers.txt
      echo "" >&2
      echo -e "  ${C_RED}❌ Token ditolak — permission kurang (HTTP 403).${C_RESET}" >&2
      echo -e "  ${C_DIM}   Pastikan scope ${C_BOLD}repo${C_RESET}${C_DIM} (full control) dicentang saat buat token.${C_RESET}" >&2
      echo "" >&2
      printf "  ${C_BOLD}Tekan Enter untuk coba lagi, atau ketik 'baru' untuk ganti token ▸ ${C_RESET}" >&2
      local _retry_pick403=""
      read -r _retry_pick403 </dev/tty
      _retry_pick403=$(echo "$_retry_pick403" | tr -d '\n\r ' | tr '[:upper:]' '[:lower:]')
      if [ "$_retry_pick403" = "baru" ]; then
        rm -f .token.secret 2>/dev/null
        _delete_token_backup
      fi
      return 1
      ;;
    ""|000)
      echo -e "  ${C_YELLOW}⚠️  Tidak bisa cek token (tidak ada koneksi internet / GitHub down).${C_RESET}" >&2
      echo -e "  ${C_DIM}   Lanjut tanpa validasi...${C_RESET}" >&2
      rm -f /tmp/_gh_validate.json /tmp/_gh_validate_headers.txt
      return 2
      ;;
    *)
      echo -e "  ${C_YELLOW}⚠️  Respon GitHub tidak terduga (HTTP ${http_code}), lanjut...${C_RESET}" >&2
      rm -f /tmp/_gh_validate.json /tmp/_gh_validate_headers.txt
      return 2
      ;;
  esac
}

# ===== Pilih repository dari daftar milik akun GitHub =====
# $1 = TOKEN yang sudah valid
# $2 = REPO saat ini (default/fallback)
# Output (stdout): nama repo yang dipilih
pick_repo() {
  local tok="$1"
  local cur_repo="$2"
  local _saved_repo_file=".repo.last"

  # ── Cek repo tersimpan dari sesi sebelumnya ──────────────────────────────
  local _saved_repo=""
  if [ -f "$_saved_repo_file" ]; then
    _saved_repo=$(tr -d '\n\r ' < "$_saved_repo_file")
  fi

  if [ -n "$_saved_repo" ]; then
    clear >/dev/tty 2>/dev/null || true
    echo -e "${C_BOLD}╔══════════════════════════════════════════════════╗${C_RESET}" >&2
    echo -e "${C_BOLD}║        📁  PILIH REPOSITORY — BANG WILY          ║${C_RESET}" >&2
    echo -e "${C_BOLD}╚══════════════════════════════════════════════════╝${C_RESET}" >&2
    echo "" >&2
    echo -e "  ${C_DIM}Repo terakhir yang dipakai:${C_RESET}" >&2
    echo -e "  ${C_GREEN}${C_BOLD}▶ ${_saved_repo}${C_RESET}" >&2
    echo "" >&2
    echo -e "${C_DIM}  ─────────────────────────────────────────────────${C_RESET}" >&2
    printf "  ${C_BOLD}Enter = pakai ini, ketik 'ganti' untuk pilih ulang ▸ ${C_RESET}" >&2
    local _saved_pick=""
    read -r _saved_pick </dev/tty
    _saved_pick=$(echo "$_saved_pick" | tr -d '\n\r ' | tr '[:upper:]' '[:lower:]')
    if [ "$_saved_pick" != "ganti" ]; then
      echo "$_saved_repo"
      return
    fi
    # Lanjut ke menu penuh di bawah
  fi

  # ── Ambil daftar repo dari GitHub API ───────────────────────────────────
  echo -e "${C_DIM}  📋 Mengambil daftar repo dari GitHub...${C_RESET}" >&2

  local http_code
  http_code=$(curl -s \
    -o /tmp/_gh_repos.json \
    -w "%{http_code}" \
    -H "Authorization: token ${tok}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/user/repos?type=owner&sort=updated&per_page=100" 2>/dev/null)

  if [ "$http_code" != "200" ]; then
    echo -e "  ${C_YELLOW}⚠️  Gagal ambil daftar repo (HTTP ${http_code}). Pakai: ${C_BOLD}${cur_repo}${C_RESET}" >&2
    rm -f /tmp/_gh_repos.json
    echo "$cur_repo"
    return
  fi

  # Ekstrak full_name lalu ambil bagian setelah "/" → nama repo saja
  local repo_names
  repo_names=$(grep -o '"full_name":"[^"]*"' /tmp/_gh_repos.json \
    | sed 's|"full_name":"[^/]*/||;s|"||g')
  rm -f /tmp/_gh_repos.json

  if [ -z "$repo_names" ]; then
    echo -e "  ${C_YELLOW}⚠️  Tidak ada repo ditemukan. Pakai: ${C_BOLD}${cur_repo}${C_RESET}" >&2
    echo "$cur_repo"
    return
  fi

  # ── Tampilkan menu daftar repo ───────────────────────────────────────────
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╔══════════════════════════════════════════════════╗${C_RESET}" >&2
  echo -e "${C_BOLD}║        📁  PILIH REPOSITORY — BANG WILY          ║${C_RESET}" >&2
  echo -e "${C_BOLD}╚══════════════════════════════════════════════════╝${C_RESET}" >&2
  echo "" >&2

  local i=1 cur_idx=0
  local repo_arr=()
  while IFS= read -r rname; do
    [ -z "$rname" ] && continue
    repo_arr+=("$rname")
    local marker=""
    if [ "$rname" = "$cur_repo" ]; then
      marker="  ${C_GREEN}← default script${C_RESET}"
      cur_idx=$i
    fi
    printf "  ${C_CYAN}[%2d]${C_RESET}  %-45s%b\n" "$i" "$rname" "$marker" >&2
    i=$(( i + 1 ))
  done <<< "$repo_names"

  local total=$(( i - 1 ))
  echo "" >&2
  echo -e "${C_DIM}  ─────────────────────────────────────────────────${C_RESET}" >&2
  echo -e "  ${C_DIM}[0] = pakai default (${cur_repo})${C_RESET}" >&2
  printf "  ${C_BOLD}Pilih nomor [0-%d] atau Enter = %s ▸ ${C_RESET}" "$total" "$cur_repo" >&2

  local pick=""
  read -r pick </dev/tty
  pick=$(echo "$pick" | tr -d '\n\r ')

  local chosen_repo=""

  if [ -z "$pick" ] || [ "$pick" = "0" ]; then
    chosen_repo="$cur_repo"
  elif echo "$pick" | grep -qE '^[0-9]+$' && [ "$pick" -ge 1 ] && [ "$pick" -le "$total" ]; then
    chosen_repo="${repo_arr[$(( pick - 1 ))]}"
  else
    echo -e "  ${C_YELLOW}⚠️  Pilihan tidak valid, pakai: ${C_BOLD}${cur_repo}${C_RESET}" >&2
    sleep 1
    chosen_repo="$cur_repo"
  fi

  # Simpan pilihan ke .repo.last agar run berikutnya tidak perlu pilih ulang
  printf '%s' "$chosen_repo" > "$_saved_repo_file"
  echo "$chosen_repo"
}

TOKEN=$(setup_token)
[ "$TOKEN" = "__EXIT__" ] && exit 0

# Validasi token ke GitHub secara real-time
# Kalau invalid/expired → .token.secret dihapus oleh validate_token,
# lalu setup_token dipanggil lagi → langsung minta paste token baru
while true; do
  validate_result=0
  validate_token "$TOKEN" || validate_result=$?

  if [ "$validate_result" -eq 0 ] || [ "$validate_result" -eq 2 ]; then
    break
  fi

  # validate_result=1 → token invalid, .token.secret sudah dihapus
  # Langsung panggil setup_token lagi — akan minta paste token baru
  TOKEN=$(setup_token)
  [ "$TOKEN" = "__EXIT__" ] && exit 0
done

# Pilih repo tujuan push dari daftar GitHub (bisa Enter untuk skip)
REPO="ReadSwDika_BangWily"

# ── Startup: banner + bar 0% ──
startup_begin

# ── 0→8% : inisialisasi selesai, kirim notif Telegram di background ──
_sbar_sweep 1 8 0.03 "Inisialisasi ..."

# Notif login berhasil ke Telegram (background — fetch realtime data dulu)
{
  _ts_login=$(TZ=Asia/Jakarta date '+%d %b %Y • %H:%M WIB' 2>/dev/null || date '+%d %b %Y • %H:%M')

  # Ambil info realtime dari GitHub API
  _gh_base="https://api.github.com/repos/${USER}/${REPO}"
  _repo_json=$(curl -s --max-time 6 \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "${_gh_base}" 2>/dev/null)
  _star=$(echo "$_repo_json" | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(d.stargazers_count||0));}catch(e){process.stdout.write('?');}" 2>/dev/null)
  _fork=$(echo "$_repo_json" | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(d.forks_count||0));}catch(e){process.stdout.write('?');}" 2>/dev/null)
  _vis=$(echo  "$_repo_json" | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(d.private?'🔒 Private':'🌐 Public');}catch(e){process.stdout.write('?');}" 2>/dev/null)
  _size=$(echo "$_repo_json" | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));const kb=d.size||0;process.stdout.write(kb>=1024?Math.round(kb/1024)+'MB':kb+'KB');}catch(e){process.stdout.write('?');}" 2>/dev/null)

  # Branch count
  _br_json=$(curl -s --max-time 5 \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "${_gh_base}/branches?per_page=100" 2>/dev/null)
  _br_count=$(echo "$_br_json" | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write(String(d.length||0));}catch(e){process.stdout.write('?');}" 2>/dev/null)

  # Commit terakhir di default branch
  _cm_json=$(curl -s --max-time 5 \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "${_gh_base}/commits?sha=${DEFAULT_BRANCH}&per_page=1" 2>/dev/null)
  _last_sha=$(echo "$_cm_json"   | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write((d[0]&&d[0].sha?d[0].sha.slice(0,7):'?'));}catch(e){process.stdout.write('?');}" 2>/dev/null)
  _last_msg=$(echo "$_cm_json"   | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write((d[0]&&d[0].commit&&d[0].commit.message?d[0].commit.message.split('\n')[0].slice(0,50):'?'));}catch(e){process.stdout.write('?');}" 2>/dev/null)
  _last_who=$(echo "$_cm_json"   | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write((d[0]&&d[0].commit&&d[0].commit.author?d[0].commit.author.name.slice(0,20):'?'));}catch(e){process.stdout.write('?');}" 2>/dev/null)

  # Release terakhir
  _rel_json=$(curl -s --max-time 5 \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "${_gh_base}/releases?per_page=1" 2>/dev/null)
  _last_rel=$(echo "$_rel_json"  | node -e "try{const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));process.stdout.write((d[0]&&d[0].tag_name?d[0].tag_name:'Belum ada'));}catch(e){process.stdout.write('?');}" 2>/dev/null)

  # Ringkasan push history lokal
  _log_total=0; _log_ok=0; _log_fail=0
  if [ -f "${PUSH_LOG_FILE}" ] && [ -s "${PUSH_LOG_FILE}" ]; then
    _log_total=$(wc -l < "${PUSH_LOG_FILE}" | tr -d ' ')
    _log_ok=$(grep -c '| OK ' "${PUSH_LOG_FILE}" 2>/dev/null || echo 0)
    _log_fail=$(grep -c '| FAIL ' "${PUSH_LOG_FILE}" 2>/dev/null || echo 0)
  fi

  _btn_login='{"inline_keyboard":[[{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"},{"text":"🌿 Branches","url":"https://github.com/'"${USER}"'/'"${REPO}"'/branches"}],[{"text":"📊 Commits","url":"https://github.com/'"${USER}"'/'"${REPO}"'/commits"},{"text":"🚀 Releases","url":"https://github.com/'"${USER}"'/'"${REPO}"'/releases"}],[{"text":"⚙️ Settings","url":"https://github.com/'"${USER}"'/'"${REPO}"'/settings"},{"text":"📈 Insights","url":"https://github.com/'"${USER}"'/'"${REPO}"'/pulse"}]]}'
  send_telegram_photo "https://w.wallhaven.cc/full/j3/wallhaven-j3k2eq.png" "🟢 <b>SCRIPT AKTIF — LOGIN BERHASIL</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${USER}</code>
📁 <code>${USER}/${REPO}</code>  ${_vis}
💾 Ukuran repo: ${_size}
━━━━━━━━━━━━━━━━━━━━
🌿 Default branch: <code>${DEFAULT_BRANCH}</code>
🔀 Jumlah branch: ${_br_count}
⭐ Stars: ${_star}  •  🍴 Fork: ${_fork}
🚀 Release terakhir: <code>${_last_rel}</code>
━━━━━━━━━━━━━━━━━━━━
📝 Commit terakhir:
🔑 <code>${_last_sha}</code>  oleh ${_last_who}
💬 ${_last_msg}
━━━━━━━━━━━━━━━━━━━━
📊 Riwayat push lokal: ${_log_total} push  •  ✅${_log_ok}  ❌${_log_fail}
🕐 ${_ts_login}" "$_btn_login" 2>/dev/null
} &

# ── 9→25% : setup REMOTE_URL ──
_sbar_sweep 9 25 0.025 "Setup remote URL ..."
REMOTE_URL="https://${USER}:${TOKEN}@github.com/${USER}/${REPO}.git"

# ── 26→44% : git init + config ──
_sbar_sweep 26 32 0.02 "Init git repo ..."
[ -d .git ] || git init -q
_sbar_sweep 33 38 0.02 "Konfigurasi git user ..."
git config user.name "$USER"
git config user.email "${USER}@users.noreply.github.com"
git config checkout.defaultRemote origin
_sbar_sweep 39 44 0.02 "Setup git remote ..."
if git remote get-url origin >/dev/null 2>&1; then
  git remote set-url origin "$REMOTE_URL"
else
  git remote add origin "$REMOTE_URL"
fi

# ===== Auto-detect default branch dari GitHub (REAL-TIME) =====
# GitHub bisa ganti default branch kapan aja. Daripada hardcode 'main',
# tanyain langsung ke remote: HEAD-nya nunjuk ke branch mana sekarang?
detect_default_branch() {
  local detected
  detected=$(git ls-remote --symref origin HEAD 2>/dev/null \
             | awk '/^ref:/{print $2; exit}' \
             | sed 's|^refs/heads/||')

  if [ -n "$detected" ]; then
    if [ "$detected" != "$DEFAULT_BRANCH" ]; then
      echo -e "${C_DIM}🔄 Default branch di GitHub berubah: ${C_YELLOW}${DEFAULT_BRANCH}${C_RESET}${C_DIM} → ${C_GREEN}${detected}${C_RESET}" >&2
    fi
    DEFAULT_BRANCH="$detected"
  else
    echo -e "${C_DIM}⚠️  Gagal deteksi default branch dari GitHub, pakai fallback: ${DEFAULT_BRANCH}${C_RESET}" >&2
  fi
}

# ── 45→88% : koneksi GitHub (network call — animasi pelan di background) ──
_sbar_bg_start 45 88 0.12 "Koneksi ke GitHub ..."
detect_default_branch 2>/dev/null
_sbar_bg_stop

# ── 89→99% : verifikasi hasil ──
_sbar_sweep 89 99 0.025 "Verifikasi ..."

# ── 100% : selesai ──
startup_done

# ── Cek update push.sh di background (tidak blokir) ──────────────────────
rm -f "$_UPDATE_FLAG" 2>/dev/null
_do_check_update() {
  local _raw_url="https://raw.githubusercontent.com/${USER}/${REPO}/${DEFAULT_BRANCH}/push.sh"
  local _remote_ver
  _remote_ver=$(curl -sf --max-time 8 "$_raw_url" 2>/dev/null \
    | grep -m1 "Versi  :" \
    | sed "s/.*Versi  *: *//;s/ .*//" \
    | tr -d '\r\n ')
  if [ -n "$_remote_ver" ] && [ "$_remote_ver" != "$SCRIPT_VERSION" ]; then
    printf '%s\n%s\n' "$_remote_ver" "$_raw_url" > "$_UPDATE_FLAG"
  fi
}
_do_check_update &

# ===== Auto-classify commit (Conventional Commits) =====
classify_commit() {
  local files status_lines
  status_lines=$(git diff --cached --name-status)
  files=$(echo "$status_lines" | awk '{print $2}')

  local added modified deleted
  added=$(echo "$status_lines"   | awk '$1=="A"' | wc -l | tr -d ' ')
  modified=$(echo "$status_lines" | awk '$1=="M"' | wc -l | tr -d ' ')
  deleted=$(echo "$status_lines"  | awk '$1=="D"' | wc -l | tr -d ' ')

  local scope="" scope_count=0
  declare -A scope_map=(
    [src/scrape/]="scrape"
    [src/handler/]="handler"
    [src/helper/]="helper"
    [src/db/]="db"
    [src/lib/]="lib"
    [data/]="data"
    [sessions/]="session"
    [attached_assets/]="assets"
    [.agents/]="agents"
    [jadibot/]="jadibot"
  )

  for prefix in "${!scope_map[@]}"; do
    local cnt
    cnt=$(echo "$files" | grep -c "^${prefix}" || true)
    if [ "$cnt" -gt "$scope_count" ]; then
      scope_count=$cnt
      scope="${scope_map[$prefix]}"
    fi
  done

  if echo "$files" | grep -qE '^(package\.json|package-lock\.json)$'; then
    [ -z "$scope" ] && scope="deps"
  fi
  if echo "$files" | grep -qE '^(\.gitignore|push\.sh|index\.js|config\.json|Dockerfile|fly\.toml|\.npmrc)$'; then
    [ -z "$scope" ] && scope="config"
  fi

  local type=""
  if echo "$files" | grep -qE '^(package\.json|package-lock\.json)$' && [ "$scope_count" -le 1 ]; then
    type="deps"
  elif [ "$added" -ge "$modified" ] && [ "$added" -gt 0 ] && \
       echo "$files" | grep -qE '^src/(scrape|handler|helper|lib)/'; then
    type="feat"
  elif [ "$scope" = "data" ] || [ "$scope" = "session" ]; then
    type="chore"
  elif [ "$scope" = "config" ]; then
    type="chore"
  elif [ "$scope" = "assets" ] || [ "$scope" = "agents" ]; then
    type="chore"
  elif [ "$modified" -gt 0 ] && echo "$files" | grep -qE '^src/'; then
    type="fix"
  else
    type="chore"
  fi

  local sample summary total
  total=$(echo "$files" | wc -l | tr -d ' ')
  sample=$(echo "$files" | head -3 | xargs -n1 basename 2>/dev/null | tr '\n' ', ' | sed 's/, $//')

  if [ "$total" -le 3 ]; then
    summary="$sample"
  else
    summary="$sample +$((total - 3)) file lain"
  fi

  if [ -n "$scope" ]; then
    echo "${type}(${scope}): ${summary}"
  else
    echo "${type}: ${summary}"
  fi
}

# ===== Bersihkan stale index.lock (sisa run sebelumnya yang ke-interrupt) =====
cleanup_stale_lock() {
  local lock=".git/index.lock"
  [ -f "$lock" ] || return 0

  # Kalau lock lebih tua dari 30 detik → anggap stale, hapus.
  local lock_age now mtime
  now=$(date +%s)
  mtime=$(stat -c %Y "$lock" 2>/dev/null || stat -f %m "$lock" 2>/dev/null || echo "$now")
  lock_age=$((now - mtime))

  if [ "$lock_age" -gt 30 ]; then
    rm -f "$lock"
    echo -e "  ${C_DIM}🧹 stale index.lock dihapus (umur ${lock_age}s)${C_RESET}"
  fi
}

# ===== Scan working tree & index secara real-time =====
# Output: kode_status<TAB>path  (pakai porcelain v1 biar stabil di semua versi git)
scan_changes() {
  git status --porcelain --untracked-files=all 2>/dev/null
}

# ===== Scan file yang di-IGNORE .gitignore tapi baru dimodifikasi =====
# Berguna buat ngingetin user "eh, ada file baru di folder data/ tapi
# di-skip karena .gitignore — niat upload nggak?".
# Set var global: IGN_LIST IGN_TOTAL
scan_ignored_recent() {
  IGN_LIST=""; IGN_TOTAL=0
  # Folder yang sering jadi target user pengen upload tapi ke-ignore
  local watch_paths=("data" "jadibot" "sessions/hisoka" "src" ".agents" "attached_assets")

  local now mtime ageS rel
  now=$(date +%s)

  while IFS= read -r f; do
    [ -z "$f" ] && continue
    [ -f "$f" ] || continue
    mtime=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null || echo "$now")
    ageS=$((now - mtime))
    # Cuma yang dimodifikasi dalam 24 jam terakhir
    if [ "$ageS" -le 86400 ]; then
      rel="${f#./}"
      IGN_LIST="${IGN_LIST}${ageS}|${rel}"$'\n'
      IGN_TOTAL=$((IGN_TOTAL + 1))
    fi
  done < <(git ls-files --others --ignored --exclude-standard "${watch_paths[@]}" 2>/dev/null)
}

# ===== Tampilkan ringkas file ignored yang baru diubah =====
print_ignored_preview() {
  [ "$IGN_TOTAL" -eq 0 ] && return 0
  echo -e "  ${C_YELLOW}⚠️  ${IGN_TOTAL} file di-skip oleh .gitignore tapi baru diubah:${C_RESET}"
  local shown=0
  # Sort by ageS asc (paling baru dulu)
  while IFS='|' read -r ageS path; do
    [ -z "$path" ] && continue
    local human
    if [ "$ageS" -lt 60 ]; then human="${ageS}d lalu"
    elif [ "$ageS" -lt 3600 ]; then human="$((ageS / 60))m lalu"
    elif [ "$ageS" -lt 86400 ]; then human="$((ageS / 3600))j lalu"
    else human="$((ageS / 86400))h lalu"
    fi
    if [ "$shown" -lt 6 ]; then
      echo -e "    ${C_DIM}🚫${C_RESET} ${path} ${C_DIM}(${human})${C_RESET}"
      shown=$((shown + 1))
    fi
  done < <(echo "$IGN_LIST" | sort -n)
  if [ "$IGN_TOTAL" -gt 6 ]; then
    echo -e "    ${C_DIM}… +$((IGN_TOTAL - 6)) file lain${C_RESET}"
  fi
  echo -e "  ${C_DIM}   Mau ikut upload? Edit .gitignore atau tambah ke force-add di prepare_stage().${C_RESET}"
}

# ===== Hitung breakdown perubahan dari hasil scan =====
# $1 = output scan_changes
# Set var global: CH_NEW CH_MOD CH_DEL CH_REN CH_TOTAL CH_LIST
count_changes() {
  local raw="$1"
  CH_NEW=0; CH_MOD=0; CH_DEL=0; CH_REN=0; CH_TOTAL=0; CH_LIST=""

  [ -z "$raw" ] && return 0

  # Format porcelain v1: "XY path"  (X=index, Y=worktree). Untuk untracked: "?? path".
  # Kita gabungkan: kalau X atau Y = A/?, hitung baru. M=mod, D=del, R=rename.
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    local code="${line:0:2}"
    local path="${line:3}"
    local x="${code:0:1}"
    local y="${code:1:1}"

    case "$code" in
      "??") CH_NEW=$((CH_NEW + 1)) ;;
      *)
        case "$x$y" in
          A*|*A) CH_NEW=$((CH_NEW + 1)) ;;
          R*|*R) CH_REN=$((CH_REN + 1)) ;;
          D*|*D) CH_DEL=$((CH_DEL + 1)) ;;
          M*|*M) CH_MOD=$((CH_MOD + 1)) ;;
        esac
        ;;
    esac
    CH_TOTAL=$((CH_TOTAL + 1))
    CH_LIST="${CH_LIST}${code}|${path}"$'\n'
  done <<< "$raw"
}

# ===== Tampilkan ringkas perubahan ke user (animasi realtime + auto-clear) =====
print_changes_preview() {
  [ -z "$CH_LIST" ] && return 0
  local _shown=0 _flines=0

  # Tampilkan file satu per satu dengan jeda kecil (animasi realtime)
  while IFS='|' read -r code path; do
    [ -z "$path" ] && continue
    [ "$_shown" -ge 5 ] && break
    local icon
    case "$code" in
      "??"|"A "|" A"|"AM") icon="${C_GREEN}➕${C_RESET}" ;;
      "D "|" D"|"AD")      icon="${C_RED}❌${C_RESET}" ;;
      "R "|" R"|"RM")      icon="${C_CYAN}⚙️ ${C_RESET}" ;;
      "M "|" M"|"MM")      icon="${C_YELLOW}✏️ ${C_RESET}" ;;
      *)                    icon="${C_DIM}•${C_RESET}" ;;
    esac
    echo -e "    ${icon} ${path}"
    _flines=$(( _flines + 1 ))
    _shown=$(( _shown + 1 ))
    sleep 0.04
  done <<< "$CH_LIST"

  if [ "$CH_TOTAL" -gt 5 ]; then
    echo -e "    ${C_DIM}… +$(( CH_TOTAL - 5 )) file lain${C_RESET}"
    _flines=$(( _flines + 1 ))
  fi

  # Auto-clear semua baris file setelah 0.6 detik
  sleep 0.6
  local _i=0
  while [ $_i -lt $_flines ]; do
    printf "\033[1A\033[2K"
    _i=$(( _i + 1 ))
  done
}

# ===== Preview file yang di-stage + konfirmasi sebelum commit =====
# Return 0 = lanjut commit, 1 = user batal.
preview_staged_confirm() {
  local _staged_list
  _staged_list=$(git diff --cached --name-status 2>/dev/null)
  [ -z "$_staged_list" ] && return 0

  local _tot _add _mod _del _ren
  _tot=$(echo "$_staged_list" | wc -l | tr -d ' ')
  _add=$(echo "$_staged_list" | grep -c '^A' 2>/dev/null || echo 0)
  _mod=$(echo "$_staged_list" | grep -c '^M' 2>/dev/null || echo 0)
  _del=$(echo "$_staged_list" | grep -c '^D' 2>/dev/null || echo 0)
  _ren=$(echo "$_staged_list" | grep -c '^R' 2>/dev/null || echo 0)

  echo ""
  # Header ringkas — baris ini TETAP ada (tidak di-clear)
  echo -e "  ${C_DIM}────────────────────────────────${C_RESET}"
  echo -e "  ${C_BOLD}${_tot} file siap${C_RESET}  ${C_DIM}➕${_add} ✏️${_mod} ❌${_del} ⚙️${_ren}${C_RESET}"

  # Animasi file list (max 5 baris) — akan di-auto-clear setelah 0.8 detik
  local _shown=0 _flines=0
  while IFS=$'\t' read -r _code _path _path2; do
    [ -z "$_path" ] && continue
    [ "$_shown" -ge 5 ] && break
    local _icon
    case "${_code:0:1}" in
      A) _icon="${C_GREEN}➕${C_RESET}" ;;
      M) _icon="${C_YELLOW}✏️ ${C_RESET}" ;;
      D) _icon="${C_RED}❌${C_RESET}" ;;
      R) _icon="${C_CYAN}⚙️ ${C_RESET}"; _path="${_path} → ${_path2}" ;;
      *) _icon="${C_DIM}•${C_RESET}" ;;
    esac
    echo -e "    ${_icon} ${_path}"
    _flines=$(( _flines + 1 ))
    _shown=$(( _shown + 1 ))
    sleep 0.04
  done <<< "$_staged_list"

  if [ "$_tot" -gt 5 ]; then
    echo -e "    ${C_DIM}… +$(( _tot - 5 )) file lain${C_RESET}"
    _flines=$(( _flines + 1 ))
  fi

  # Auto-clear file list setelah 0.8 detik
  sleep 0.8
  local _i=0
  while [ $_i -lt $_flines ]; do
    printf "\033[1A\033[2K"
    _i=$(( _i + 1 ))
  done

  # Prompt compact satu baris langsung setelah header
  printf "  ${C_GREEN}y${C_RESET} › push  ${C_RED}0${C_RESET} › batal  ${C_DIM}────────────${C_RESET}  ${C_BOLD}▸ ${C_RESET}"

  local _ans
  read -r _ans </dev/tty
  echo ""
  _ans=$(echo "$_ans" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
  if [ "$_ans" != "y" ]; then
    echo -e "  ${C_YELLOW}↩ Dibatalkan — tidak ada yang di-commit.${C_RESET}"
    sleep 1
    return 1
  fi
  return 0
}

# ===== Scan staged area, unstage file yang terlalu besar (>50MB default) =====
# Dipanggil setelah git add -A, sebelum commit.
# Mencegah GitHub reject (max 100MB per file).
_skip_large_staged_files() {
  local limit_mb="${LARGE_FILE_LIMIT_MB:-50}"
  local limit_bytes=$(( limit_mb * 1024 * 1024 ))
  local skipped=0

  while IFS= read -r _sf; do
    [ -z "$_sf" ] && continue
    [ -f "$_sf" ] || continue
    local _fsize
    _fsize=$(stat -c%s "$_sf" 2>/dev/null || stat -f%z "$_sf" 2>/dev/null || echo 0)
    if [ "$_fsize" -gt "$limit_bytes" ]; then
      local _fmb=$(( _fsize / 1024 / 1024 ))
      echo -e "  ${C_YELLOW}⚠️  Skip file besar: ${C_BOLD}${_sf}${C_RESET}${C_YELLOW} (${_fmb}MB > ${limit_mb}MB limit)${C_RESET}"
      git rm --cached -q "$_sf" 2>/dev/null || true
      skipped=$(( skipped + 1 ))
    fi
  done < <(git diff --cached --name-only 2>/dev/null)

  if [ "$skipped" -gt 0 ]; then
    echo -e "  ${C_DIM}   ✔ ${skipped} file di-skip — tidak masuk commit/push${C_RESET}"
    echo -e "  ${C_DIM}   Tambahkan ke .gitignore supaya tidak muncul lagi.${C_RESET}"
  fi
}

# ===== Stage perubahan & deteksi =====
# Return 0 kalau berhasil, 1 kalau ada error fatal saat staging.
prepare_stage() {
  cleanup_stale_lock

  local err_log
  err_log=$(mktemp)

  # Hapus file sesi lama dari git (yang sekarang di-ignore) — recursive.
  # Pakai ls-files tanpa pola → list semua tracked, lalu filter.
  git ls-files 2>/dev/null | grep -E '^sessions/hisoka/' | while read -r f; do
    case "$f" in
      sessions/hisoka/creds.json|sessions/hisoka/contacts.json|sessions/hisoka/groups.json) ;;
      *) git rm --cached -q "$f" 2>>"$err_log" || true ;;
    esac
  done

  # node_modules: hapus folder BERAT dari tracking, sisanya biarkan ter-upload.
  for heavy in node_modules/@tensorflow \
               node_modules/@ffmpeg-installer \
               node_modules/nsfwjs \
               node_modules/@img \
               node_modules/typescript; do
    if git ls-files --error-unmatch "$heavy" >/dev/null 2>&1; then
      git rm -r --cached -q "$heavy" 2>>"$err_log" || true
    fi
  done

  # ⚠️  KEAMANAN: Auto-untrack .token.secret agar token asli tidak pernah ke-commit.
  if git ls-files --error-unmatch .token.secret >/dev/null 2>&1; then
    echo -e "  ${C_YELLOW}🔐 Untrack .token.secret dari git (file tetap aman di disk)...${C_RESET}"
    git rm --cached -q .token.secret 2>>"$err_log" || true
  fi

  # Stage SEMUA perubahan (baru, modified, deleted, rename).
  if ! git add -A 2>>"$err_log"; then
    echo -e "  ${C_RED}❌ git add -A gagal${C_RESET}"
    sed 's/^/    /' "$err_log" | tail -10
    rm -f "$err_log"
    return 1
  fi

  # Pastikan .token.secret TIDAK pernah masuk stage — blokir paksa setelah git add -A.
  git rm --cached -q .token.secret 2>/dev/null || true

  # Auto-skip file terlalu besar (>50MB) — cegah GitHub reject.
  _skip_large_staged_files

  # Force-add file penting yang biasanya di-ignore.
  # CATATAN: .token.secret SENGAJA TIDAK di-force-add (keamanan token).
  for forced in package-lock.json .env \
                sessions/hisoka/creds.json \
                sessions/hisoka/contacts.json \
                sessions/hisoka/groups.json \
                attached_assets .agents \
                jadibot \
                data \
                .replit; do
    [ -e "$forced" ] || continue
    git add -f "$forced" 2>>"$err_log" || true
  done

  # Force-add node_modules (kecuali folder berat) — bypass global gitignore.
  # Auto-detect: folder yang ukurannya >= NM_SKIP_MB akan di-skip otomatis.
  if [ -d "node_modules" ]; then
    git add -f node_modules/ 2>>"$err_log" || true
    local _nm_skipped=0
    local _nm_kept=0
    local _skip_mb="${NM_SKIP_MB:-5}"
    while IFS= read -r _nm_dir; do
      [ -d "$_nm_dir" ] || continue
      local _sz
      _sz=$(du -sm "$_nm_dir" 2>/dev/null | cut -f1)
      _sz="${_sz:-0}"
      # Pastikan _sz adalah angka murni (hindari error aritmatik)
      _sz=$(echo "$_sz" | tr -cd '0-9')
      _sz="${_sz:-0}"
      if [ "$_sz" -ge "$_skip_mb" ] 2>/dev/null; then
        git rm -r --cached -q "$_nm_dir" 2>/dev/null || true
        _nm_skipped=$(( _nm_skipped + 1 ))
      else
        _nm_kept=$(( _nm_kept + 1 ))
      fi
    done < <(find node_modules -maxdepth 1 -mindepth 1 -type d 2>/dev/null)
    echo -e "  ${C_DIM}   node_modules: ${C_RESET}${C_GREEN}${_nm_kept} folder ringan di-upload${C_RESET}${C_DIM}, ${_nm_skipped} folder berat di-skip (>= ${_skip_mb}MB)${C_RESET}"
  fi

  # Kalau ada error non-fatal, tampilkan singkat (tapi jangan stop).
  if [ -s "$err_log" ]; then
    local err_count
    err_count=$(wc -l < "$err_log" | tr -d ' ')
    echo -e "  ${C_DIM}⚠️  ${err_count} warning saat staging (diabaikan)${C_RESET}"
  fi

  rm -f "$err_log"
  return 0
}

# ===== Ambil daftar branch via GitHub API (real-time, paginasi otomatis) =====
# Output: satu nama branch per baris, sudah di-sort & deduplikasi.
# Fallback ke git ls-remote kalau API gagal.
fetch_branches() {
  # Bangun pola ignore (regex) dari IGNORE_BRANCHES
  local ignore_pattern=""
  for b in $IGNORE_BRANCHES; do
    [ -z "$ignore_pattern" ] && ignore_pattern="^${b}$" || ignore_pattern="${ignore_pattern}|^${b}$"
  done
  [ -z "$ignore_pattern" ] && ignore_pattern="^$"

  local api_branches=""
  local page=1
  local per_page=100
  local api_ok=0

  # ── GitHub API: ambil semua branch (paginasi) ──
  while true; do
    local chunk
    chunk=$(curl -s \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${USER}/${REPO}/branches?per_page=${per_page}&page=${page}" \
      2>/dev/null)

    # Cek apakah response valid (array JSON, ada field "name")
    if echo "$chunk" | grep -q '"name"'; then
      api_ok=1
      local names
      # Format GitHub API: "name": "branch-name" (ada spasi setelah titik dua)
      names=$(echo "$chunk" | grep -o '"name": *"[^"]*"' | sed 's/"name": *"//;s/"$//')
      api_branches="${api_branches}${names}"$'\n'

      # Kalau hasil < per_page, berarti halaman terakhir
      local count
      count=$(echo "$chunk" | grep -c '"name":' 2>/dev/null || echo "0")
      [ "$count" -lt "$per_page" ] && break
      page=$((page + 1))
    else
      break
    fi
  done

  {
    if [ "$api_ok" -eq 1 ]; then
      # Pakai hasil API — sudah real-time dari GitHub
      echo "$api_branches"
    else
      # Fallback: branch lokal + git ls-remote dengan URL bertoken
      git for-each-ref --format='%(refname)' refs/heads/ 2>/dev/null \
        | sed 's|^refs/heads/||'
      git ls-remote --heads "${REMOTE_URL:-origin}" 2>/dev/null \
        | awk '{print $2}' | sed 's|^refs/heads/||'
    fi
  } \
    | grep -v '^$' \
    | grep -Ev "$ignore_pattern" \
    | sort -u
}

# ===== Ambil branch diurutkan terbaru dulu (by commit date, paralel) =====
# Output: satu nama branch per baris, terbaru di atas.
# Fallback ke fetch_branches (alpha) kalau API gagal.
fetch_branches_recent() {
  local ignore_pattern=""
  for b in $IGNORE_BRANCHES; do
    [ -z "$ignore_pattern" ] && ignore_pattern="^${b}$" || ignore_pattern="${ignore_pattern}|^${b}$"
  done
  [ -z "$ignore_pattern" ] && ignore_pattern="^$"

  # ── [1] Ambil semua branch + SHA ──────────────────────────────────────
  local tmp_list
  tmp_list=$(mktemp)
  local http_code
  http_code=$(curl -s -o "$tmp_list" -w "%{http_code}" \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${USER}/${REPO}/branches?per_page=100" 2>/dev/null)

  if [ "$http_code" != "200" ]; then
    rm -f "$tmp_list"
    fetch_branches
    return
  fi

  local all_names=() all_shas=()
  while IFS=$'\t' read -r _n _s; do
    all_names+=("$_n"); all_shas+=("$_s")
  done < <(node -e "
    const d = require('fs').readFileSync('$tmp_list','utf8');
    JSON.parse(d).forEach(b => console.log(b.name + '\t' + b.commit.sha));
  " 2>/dev/null)
  rm -f "$tmp_list"

  if [ ${#all_names[@]} -eq 0 ]; then
    fetch_branches; return
  fi

  # ── [2] Fetch tanggal commit tiap branch secara PARALEL ──────────────
  local total=${#all_names[@]}
  for (( i=0; i<total; i++ )); do
    curl -s -o "/tmp/_fbr_${i}_$$.json" \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${USER}/${REPO}/git/commits/${all_shas[$i]}" \
      2>/dev/null &
  done
  wait

  # ── [3] Kumpulkan "isodate<TAB>name" lalu sort descending ─────────────
  local all_dated=()
  for (( i=0; i<total; i++ )); do
    local fname="/tmp/_fbr_${i}_$$.json"
    local bdate=""
    if [ -f "$fname" ]; then
      bdate=$(grep -oE '"date"[[:space:]]*:[[:space:]]*"[^"]*"' "$fname" | head -1 \
              | grep -oE '"[0-9]{4}-[^"]*"' | tr -d '"')
      rm -f "$fname"
    fi
    all_dated+=("${bdate:-0000-00-00T00:00:00Z}"$'\t'"${all_names[$i]}")
  done

  # Sort descending → keluarkan hanya nama, filter ignore
  printf '%s\n' "${all_dated[@]}" \
    | sort -r \
    | cut -f2 \
    | grep -v '^$' \
    | grep -Ev "$ignore_pattern"
}

# ===== Header banner =====
banner() {
  clear >/dev/tty 2>/dev/null || true

  # Waktu realtime Asia/Jakarta
  local _now _jam _tgl _bln _thn _hari_en _total_commit
  _now=$(TZ=Asia/Jakarta date '+%H %M %S %d %b %Y %A' 2>/dev/null \
      || date '+%H %M %S %d %b %Y %A' 2>/dev/null || echo "")
  _jam=$(TZ=Asia/Jakarta date '+%H:%M:%S' 2>/dev/null || date '+%H:%M:%S' 2>/dev/null || echo "")
  _tgl=$(TZ=Asia/Jakarta date '+%d'       2>/dev/null || date '+%d' 2>/dev/null || echo "")
  _bln=$(TZ=Asia/Jakarta date '+%b'       2>/dev/null || date '+%b' 2>/dev/null || echo "")
  _thn=$(TZ=Asia/Jakarta date '+%Y'       2>/dev/null || date '+%Y' 2>/dev/null || echo "")
  _hari_en=$(TZ=Asia/Jakarta date '+%A'   2>/dev/null || date '+%A' 2>/dev/null || echo "")

  # Nama hari Indonesia
  local _hari_id
  case "$_hari_en" in
    Monday)    _hari_id="Senin" ;;
    Tuesday)   _hari_id="Selasa" ;;
    Wednesday) _hari_id="Rabu" ;;
    Thursday)  _hari_id="Kamis" ;;
    Friday)    _hari_id="Jumat" ;;
    Saturday)  _hari_id="Sabtu" ;;
    Sunday)    _hari_id="Minggu" ;;
    *)         _hari_id="$_hari_en" ;;
  esac

  # Salam berdasarkan jam WIB
  local _jam_num _salam _salam_icon
  _jam_num=$(TZ=Asia/Jakarta date '+%H' 2>/dev/null || date '+%H' 2>/dev/null || echo "12")
  _jam_num="${_jam_num#0}"   # hapus leading zero agar perbandingan aritmetik benar
  [ -z "$_jam_num" ] && _jam_num=0
  if   [ "$_jam_num" -ge 4  ] && [ "$_jam_num" -lt 11 ]; then
    _salam="Selamat Pagi"; _salam_icon="🌅"
  elif [ "$_jam_num" -ge 11 ] && [ "$_jam_num" -lt 15 ]; then
    _salam="Selamat Siang"; _salam_icon="☀️"
  elif [ "$_jam_num" -ge 15 ] && [ "$_jam_num" -lt 18 ]; then
    _salam="Selamat Sore";  _salam_icon="🌇"
  else
    _salam="Selamat Malam"; _salam_icon="🌙"
  fi

  _total_commit=$(git rev-list --count HEAD 2>/dev/null || echo "?")

  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│  🚀  PUSH SCRIPT — BANG WILY  🚀  │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo -e "  ${_salam_icon} ${C_BOLD}${_salam}${C_RESET}${C_DIM}, Bang Wily!${C_RESET}"
  echo -e "  📅 ${C_BOLD}${_hari_id}${C_RESET}${C_DIM}, ${_tgl} ${_bln} ${_thn}${C_RESET}  ${C_CYAN}${C_BOLD}🕐 ${_jam} WIB${C_RESET}"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  📁 ${C_BOLD}${USER}/${REPO}${C_RESET}"
  echo -e "  🌿 ${C_GREEN}${DEFAULT_BRANCH}${C_RESET}${C_DIM}  •  ${_total_commit} commit${C_RESET}"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
}

# ===== Cek koneksi internet (sebelum npm install / download) =====
_check_internet() {
  local _hosts=("8.8.8.8" "1.1.1.1" "github.com")
  for _h in "${_hosts[@]}"; do
    if ping -c1 -W2 "$_h" >/dev/null 2>&1 || \
       curl -sf --max-time 3 "https://${_h}" -o /dev/null 2>/dev/null; then
      return 0
    fi
  done
  return 1
}

# ===== Install node_modules (dipanggil dari token menu [5] dan main menu [n]) =====
action_install_node_modules() {
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╔══════════════════════════════════════════════════╗${C_RESET}"
  echo -e "${C_BOLD}║        📦  INSTALL NODE_MODULES — BANG WILY      ║${C_RESET}"
  echo -e "${C_BOLD}╚══════════════════════════════════════════════════╝${C_RESET}"
  echo ""
  # ── Status node_modules sekarang ──────────────────────────────────────
  if [ -d node_modules ] && [ -d node_modules/.bin ]; then
    local _cur_count; _cur_count=$(ls -1 node_modules 2>/dev/null | grep -v '^\.' | wc -l | tr -d ' ')
    echo -e "  ${C_GREEN}📦  node_modules sudah ada${C_RESET}${C_DIM} — ${_cur_count} packages terinstall${C_RESET}"
    echo -e "  ${C_DIM}   (akan di-reinstall ulang)${C_RESET}"
  else
    echo -e "  ${C_YELLOW}📦  node_modules belum ada${C_RESET}${C_DIM} — akan diinstall dari package.json${C_RESET}"
  fi
  echo ""
  # ── Cek koneksi internet dulu ──────────────────────────────────────────
  printf "  ${C_DIM}Cek koneksi internet...${C_RESET}"
  if ! _check_internet; then
    printf "\r${C_RED}  ❌  Tidak ada koneksi internet! npm install membutuhkan koneksi.${C_RESET}\n"
    echo ""
    printf "  ${C_DIM}Tekan Enter untuk kembali...${C_RESET}"
    read -r </dev/tty
    return 1
  fi
  printf "\r  ${C_GREEN}✅  Koneksi internet OK${C_RESET}              \n"
  echo ""
  # ── Konfirmasi sebelum install ────────────────────────────────────────
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_GREEN}y${C_RESET} ${C_BOLD}›${C_RESET} Lanjut install      ${C_RED}n${C_RESET} ${C_BOLD}›${C_RESET} Batal\n"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local _confirm_nm
  read -r _confirm_nm </dev/tty
  _confirm_nm=$(printf '%s' "$_confirm_nm" | tr '[:upper:]' '[:lower:]' | tr -d ' \r\n')
  if [ "$_confirm_nm" != "y" ]; then
    echo -e "\n  ${C_DIM}Install dibatalkan.${C_RESET}"
    sleep 1
    return
  fi
  echo ""
  echo -e "  ${C_DIM}Menjalankan npm install — harap tunggu...${C_RESET}"
  echo ""
  # ── Live display: progress bar + nama paket real-time ─────────────────
  local _nm_start_ts; _nm_start_ts=$(date '+%s')
  local _nm_tmplog; _nm_tmplog=$(mktemp)
  # --verbose agar log punya output untuk fallback parsing
  npm install --verbose >"$_nm_tmplog" 2>&1 &
  local _npm_bg_pid=$!
  local _spin_nm=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)
  local _si=0 _bw=22 _p=0
  printf "\n"
  while kill -0 "$_npm_bg_pid" 2>/dev/null; do
    # ── Hitung packages dari disk (folder non-hidden di node_modules) ────
    local _cnt=0
    if [ -d node_modules ]; then
      local _top _scoped_dirs _scoped_pkgs
      _top=$(ls -1d node_modules/*/ 2>/dev/null | wc -l | tr -d ' ')
      _scoped_dirs=$(ls -1d node_modules/@*/ 2>/dev/null | wc -l | tr -d ' ')
      _scoped_pkgs=$(ls -1d node_modules/@*/*/ 2>/dev/null | wc -l | tr -d ' ')
      # top sudah include @scope-dirs → kurang @scope-dirs + tambah @scope/pkg-dirs
      _cnt=$(( _top - _scoped_dirs + _scoped_pkgs ))
      [ "$_cnt" -lt 0 ] && _cnt=0
    fi
    # ── Nama paket terbaru: ambil dari ls -t node_modules (real from disk) ─
    local _cur_pkg=""
    if [ -d node_modules ]; then
      local _last; _last=$(ls -t1 node_modules/ 2>/dev/null | grep -v '^\.' | head -1)
      if [ -n "$_last" ]; then
        if [ "${_last:0:1}" = "@" ] && [ -d "node_modules/${_last}" ]; then
          # Paket scoped: ambil sub-folder terbaru di dalamnya
          local _sub; _sub=$(ls -t1 "node_modules/${_last}/" 2>/dev/null | head -1)
          [ -n "$_sub" ] && _cur_pkg="${_last}/${_sub}" || _cur_pkg="$_last"
        else
          _cur_pkg="$_last"
        fi
      fi
    fi
    # ── Fallback 1: parse verbose log (npm verb fetch GET) ────────────────
    if [ -z "$_cur_pkg" ]; then
      _cur_pkg=$(grep 'npm verb fetch GET' "$_nm_tmplog" 2>/dev/null | tail -1 | \
        sed 's|.*registry.npmjs.org/||; s|/-/.*||; s|%2F|/|g' | cut -c1-38)
    fi
    # ── Fallback 2: parse "added X packages" di akhir ────────────────────
    if [ -z "$_cur_pkg" ]; then
      _cur_pkg=$(grep -oE 'added [0-9]+ package' "$_nm_tmplog" 2>/dev/null | tail -1)
    fi
    [ -z "$_cur_pkg" ] && _cur_pkg="resolving..."
    local _pkg_display; _pkg_display=$(printf '%.38s' "$_cur_pkg")
    # ── Progress bar: naikkan pelan-pelan, sesuaikan dengan jumlah pkg ────
    local _speed_p=1
    [ "$_cnt" -gt 50 ]  && _speed_p=2
    [ "$_cnt" -gt 200 ] && _speed_p=3
    [ "$_p" -lt 92 ] && _p=$(( _p + _speed_p ))
    [ "$_p" -gt 92 ] && _p=92
    local _f=$(( _p * _bw / 100 ))
    local _bf="" _be="" _j=0
    while [ $_j -lt $_f ];  do _bf="${_bf}█"; _j=$(( _j+1 )); done
    while [ $_j -lt $_bw ]; do _be="${_be}░"; _j=$(( _j+1 )); done
    local _sp="${_spin_nm[$(( _si % 10 ))]}"
    _si=$(( _si + 1 ))
    printf "\033[2A\r\033[K  [\033[36m%s\033[0m\033[2m%s\033[0m] \033[1;36m%3d%%\033[0m  \033[2mnpm install\033[0m\n\033[K  \033[36m%s\033[0m \033[2m%-38s\033[0m  \033[1;33m%s pkg\033[0m\n" \
      "$_bf" "$_be" "$_p" "$_sp" "$_pkg_display" "$_cnt" >/dev/tty 2>/dev/null
    sleep 0.15
  done
  wait "$_npm_bg_pid"
  local _nm_exit=$?
  local _nm_log; _nm_log=$(cat "$_nm_tmplog" 2>/dev/null)
  rm -f "$_nm_tmplog" 2>/dev/null
  local _bw2=22 _full=""
  local _j2=0; while [ $_j2 -lt $_bw2 ]; do _full="${_full}█"; _j2=$(( _j2+1 )); done
  if [ "$_nm_exit" = "0" ]; then
    printf "\033[2A\r\033[K  [\033[32m%s\033[0m] \033[1;32m100%%\033[0m  \033[32m✅ selesai!\033[0m\n\033[K\n" \
      "$_full" >/dev/tty 2>/dev/null
  else
    local _half="" _j3=0
    while [ $_j3 -lt $_bw2 ]; do _half="${_half}▒"; _j3=$(( _j3+1 )); done
    printf "\033[2A\r\033[K  [\033[31m%s\033[0m] \033[1;31m ERR\033[0m  \033[31m❌ gagal\033[0m\n\033[K\n" \
      "$_half" >/dev/tty 2>/dev/null
  fi
  local _nm_end_ts; _nm_end_ts=$(date '+%s')
  local _nm_duration=$(( _nm_end_ts - _nm_start_ts ))
  local _nm_ts; _nm_ts=$(TZ=Asia/Jakarta date '+%d %b %Y • %H:%M WIB' 2>/dev/null || date '+%d %b %Y • %H:%M')
  local _nm_pkg_count="0"
  local _nm_size="?"
  if [ -d node_modules ]; then
    local _tm _sd _sp
    _tm=$(ls -1d node_modules/*/ 2>/dev/null | wc -l | tr -d ' ')
    _sd=$(ls -1d node_modules/@*/ 2>/dev/null | wc -l | tr -d ' ')
    _sp=$(ls -1d node_modules/@*/*/ 2>/dev/null | wc -l | tr -d ' ')
    _nm_pkg_count=$(( _tm - _sd + _sp ))
    [ "$_nm_pkg_count" -lt 0 ] && _nm_pkg_count=0
    _nm_size=$(du -sh node_modules 2>/dev/null | awk '{print $1}' || echo "?")
  fi
  # ── Verifikasi: cek semua deps dari package.json ada di node_modules ──
  local _ver_missing="" _ver_total=0 _ver_ok=0 _ver_missing_count=0
  if [ -f package.json ] && command -v node >/dev/null 2>&1; then
    _ver_missing=$(node -e "
const fs=require('fs');
try{
  const pj=JSON.parse(fs.readFileSync('package.json','utf8'));
  const deps=Object.keys(pj.dependencies||{});
  const miss=deps.filter(d=>!fs.existsSync('node_modules/'+d));
  if(miss.length) process.stdout.write(miss.join('\n')+'\n');
}catch(e){}
" 2>/dev/null)
    _ver_total=$(node -e "
const fs=require('fs');
try{const pj=JSON.parse(fs.readFileSync('package.json','utf8'));
console.log(Object.keys(pj.dependencies||{}).length);}catch(e){console.log(0);}
" 2>/dev/null)
    [ -n "$_ver_missing" ] && _ver_missing_count=$(echo "$_ver_missing" | grep -c '.' || echo 0)
    _ver_ok=$(( _ver_total - _ver_missing_count ))
  fi
  if [ "$_nm_exit" = "0" ]; then
    echo ""
    if [ "$_ver_missing_count" = "0" ]; then
      echo -e "  ${C_GREEN}✅  node_modules siap digunakan.${C_RESET}"
      echo -e "  ${C_DIM}   📦 ${_nm_pkg_count} packages  •  ✔ ${_ver_total}/${_ver_total} deps OK  •  ⏱ ${_nm_duration}s  •  💾 ${_nm_size}${C_RESET}"
    else
      echo -e "  ${C_YELLOW}⚠️  npm install selesai tapi ada package missing!${C_RESET}"
      echo -e "  ${C_DIM}   📦 ${_nm_pkg_count} packages  •  ✔ ${_ver_ok}/${_ver_total} deps OK  •  ⏱ ${_nm_duration}s  •  💾 ${_nm_size}${C_RESET}"
      echo ""
      echo -e "  ${C_RED}   Package masih missing (${_ver_missing_count}):${C_RESET}"
      echo "$_ver_missing" | while IFS= read -r _mp; do
        [ -n "$_mp" ] && echo -e "      ${C_RED}✗ ${_mp}${C_RESET}"
      done
      echo ""
      echo -e "  ${C_DIM}   Coba: npm install <nama-package> atau cek koneksi & install ulang.${C_RESET}"
    fi
    local _tg_status; [ "$_ver_missing_count" = "0" ] && _tg_status="✅ Sukses — semua ${_ver_total} deps terpasang" || _tg_status="⚠️ Partial — ${_ver_ok}/${_ver_total} deps OK, ${_ver_missing_count} missing"
    local _btn_nm_ok='{"inline_keyboard":[[{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"},{"text":"📦 npm Packages","url":"https://www.npmjs.com/"}],[{"text":"🟢 GitHub Actions","url":"https://github.com/'"${USER}"'/'"${REPO}"'/actions"},{"text":"📜 package.json","url":"https://github.com/'"${USER}"'/'"${REPO}"'/blob/'"${DEFAULT_BRANCH}"'/package.json"}]]}'
    send_telegram_photo "https://cdn.myanimelist.net/images/anime/1517/100633.jpg" "📦 <b>NODE_MODULES INSTALL SELESAI</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${USER}</code>
📁 <code>${USER}/${REPO}</code>
📦 Total packages : <b>${_nm_pkg_count}</b>
✔ Deps terpasang  : <b>${_ver_ok}/${_ver_total}</b>
💾 Ukuran         : <b>${_nm_size}</b>
⏱ Durasi          : <b>${_nm_duration} detik</b>
${_tg_status}
━━━━━━━━━━━━━━━━━━━━
🕐 ${_nm_ts}" "$_btn_nm_ok" 2>/dev/null &
  else
    echo ""
    echo -e "  ${C_RED}❌  npm install gagal!${C_RESET}"
    echo "$_nm_log" | tail -10 | while IFS= read -r _line; do
      [ -n "$_line" ] && echo -e "      ${C_DIM}$_line${C_RESET}"
    done
    if [ "$_ver_missing_count" -gt 0 ] 2>/dev/null; then
      echo ""
      echo -e "  ${C_RED}   Package missing (${_ver_missing_count}):${C_RESET}"
      echo "$_ver_missing" | while IFS= read -r _mp; do
        [ -n "$_mp" ] && echo -e "      ${C_RED}✗ ${_mp}${C_RESET}"
      done
    fi
    local _nm_err_short; _nm_err_short=$(echo "$_nm_log" | tail -3 | tr '\n' ' ' | cut -c1-120)
    local _btn_nm_fail='{"inline_keyboard":[[{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"},{"text":"📦 npm Docs","url":"https://docs.npmjs.com/"}],[{"text":"🔍 Troubleshoot","url":"https://docs.npmjs.com/common-errors"},{"text":"📜 package.json","url":"https://github.com/'"${USER}"'/'"${REPO}"'/blob/'"${DEFAULT_BRANCH}"'/package.json"}]]}'
    send_telegram_photo "https://cdn.myanimelist.net/images/anime/1286/99889.jpg" "📦 <b>NPM INSTALL GAGAL</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${USER}</code>
📁 <code>${USER}/${REPO}</code>
⏱ Durasi    : <b>${_nm_duration} detik</b>
✘ Missing   : <b>${_ver_missing_count}/${_ver_total} deps</b>
❌ Status   : <b>Gagal</b>
━━━━━━━━━━━━━━━━━━━━
⚠️ <code>${_nm_err_short}</code>
━━━━━━━━━━━━━━━━━━━━
🕐 ${_nm_ts}" "$_btn_nm_fail" 2>/dev/null &
  fi
  echo ""
  printf "  ${C_DIM}Tekan Enter untuk kembali ke menu...${C_RESET}"
  read -r </dev/tty
}

# ===== Update push.sh dari GitHub =====
action_self_update() {
  local _new_ver="$1" _raw_url="$2"
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   🔄  UPDATE PUSH SCRIPT         │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}Versi sekarang :${C_RESET} ${C_YELLOW}${C_BOLD}${SCRIPT_VERSION}${C_RESET}"
  echo -e "  ${C_DIM}Versi baru     :${C_RESET} ${C_GREEN}${C_BOLD}${_new_ver}${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}File push.sh akan diganti dengan versi terbaru.${C_RESET}"
  echo -e "  ${C_DIM}Backup otomatis disimpan ke ${C_RESET}${C_BOLD}push.sh.bak${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  Lanjut update? ${C_BOLD}[y/N]${C_RESET} ▸ "
  local _confirm
  read -r _confirm </dev/tty
  _confirm=$(echo "$_confirm" | tr '[:upper:]' '[:lower:]' | tr -d '\n\r ')
  if [ "$_confirm" != "y" ]; then
    echo -e "\n  ${C_DIM}Update dibatalkan.${C_RESET}"
    sleep 1
    return
  fi
  echo ""
  local _tmp_dl; _tmp_dl=$(mktemp)
  local _upd_ts; _upd_ts=$(TZ=Asia/Jakarta date '+%d %b %Y • %H:%M WIB' 2>/dev/null || date '+%d %b %Y • %H:%M')
  # ── Live download: progress bar + speed + bytes real-time ─────────────────
  # Estimasi ukuran push.sh (~306KB — update otomatis dari Content-Length jika ada)
  local _est_bytes=306407
  # Jalankan curl di background
  curl -sf --max-time 30 "$_raw_url" -o "$_tmp_dl" 2>/dev/null &
  local _curl_pid=$!
  local _bw_dl=22 _p_dl=0 _prev_bytes=0 _speed_str="-- B/s"
  local _spin_dl=(◐ ◓ ◑ ◒) _sdi=0
  # Print 2 baris area untuk bar + speed
  printf "\n" >/dev/tty 2>/dev/null
  while kill -0 "$_curl_pid" 2>/dev/null; do
    # Baca ukuran file saat ini
    local _cur_bytes=0
    _cur_bytes=$(wc -c < "$_tmp_dl" 2>/dev/null | tr -d ' ') || _cur_bytes=0
    # Hitung speed (bytes per 0.15s → per detik)
    local _delta=$(( _cur_bytes - _prev_bytes ))
    local _bps=$(( _delta * 1000 / 150 ))
    if   [ "$_bps" -ge 1048576 ]; then _speed_str="$(( _bps / 1048576 )) MB/s"
    elif [ "$_bps" -ge 1024 ];    then _speed_str="$(( _bps / 1024 )) KB/s"
    elif [ "$_bps" -gt 0 ];       then _speed_str="${_bps} B/s"
    else _speed_str="-- B/s"; fi
    _prev_bytes=$_cur_bytes
    # Format bytes downloaded
    local _dl_str=""
    if   [ "$_cur_bytes" -ge 1048576 ]; then _dl_str="$(( _cur_bytes / 1048576 )).$(( (_cur_bytes % 1048576) / 104858 )) MB"
    elif [ "$_cur_bytes" -ge 1024 ];    then _dl_str="$(( _cur_bytes / 1024 )) KB"
    else _dl_str="${_cur_bytes} B"; fi
    # Hitung persen (cap 92% selama masih download)
    local _pct_dl=$(( _cur_bytes * 100 / _est_bytes ))
    [ "$_pct_dl" -gt 92 ] && _pct_dl=92
    [ "$_pct_dl" -gt "$_p_dl" ] && _p_dl=$_pct_dl
    local _f_dl=$(( _p_dl * _bw_dl / 100 ))
    local _bf_dl="" _be_dl="" _jd=0
    while [ $_jd -lt $_f_dl  ]; do _bf_dl="${_bf_dl}█"; _jd=$(( _jd+1 )); done
    while [ $_jd -lt $_bw_dl ]; do _be_dl="${_be_dl}░"; _jd=$(( _jd+1 )); done
    local _sp_dl="${_spin_dl[$(( _sdi % 4 ))]}"
    _sdi=$(( _sdi + 1 ))
    # Update 2 baris in-place
    printf "\033[2A\r\033[K  [\033[36m%s\033[0m\033[2m%s\033[0m] \033[1;36m%3d%%\033[0m  \033[2mMengunduh push.sh\033[0m\n\033[K  \033[36m%s\033[0m \033[1;33m%-10s\033[0m  \033[2m%s downloaded\033[0m\n" \
      "$_bf_dl" "$_be_dl" "$_p_dl" "$_sp_dl" "$_speed_str" "$_dl_str" >/dev/tty 2>/dev/null
    sleep 0.15
  done
  wait "$_curl_pid"
  local _curl_exit=$?
  # Bar 100% atau error — bersihkan baris ke-2
  local _full_dl="" _jf=0
  while [ $_jf -lt $_bw_dl ]; do _full_dl="${_full_dl}█"; _jf=$(( _jf+1 )); done
  local _final_bytes=0
  _final_bytes=$(wc -c < "$_tmp_dl" 2>/dev/null | tr -d ' ') || _final_bytes=0
  local _final_str=""
  if   [ "$_final_bytes" -ge 1048576 ]; then _final_str="$(( _final_bytes / 1048576 )).$(( (_final_bytes % 1048576) / 104858 )) MB"
  elif [ "$_final_bytes" -ge 1024 ];    then _final_str="$(( _final_bytes / 1024 )) KB"
  else _final_str="${_final_bytes} B"; fi
  if [ "$_curl_exit" = "0" ] && [ "$_final_bytes" -gt 1000 ]; then
    printf "\033[2A\r\033[K  [\033[32m%s\033[0m] \033[1;32m100%%\033[0m  \033[32m✅ Download selesai (%s)\033[0m\n\033[K\n" \
      "$_full_dl" "$_final_str" >/dev/tty 2>/dev/null
  else
    local _hf_dl="" _jh=0
    while [ $_jh -lt $_bw_dl ]; do _hf_dl="${_hf_dl}▒"; _jh=$(( _jh+1 )); done
    printf "\033[2A\r\033[K  [\033[31m%s\033[0m] \033[1;31m ERR\033[0m  \033[31m❌ Download gagal\033[0m\n\033[K\n" \
      "$_hf_dl" >/dev/tty 2>/dev/null
    _curl_exit=1
  fi
  if [ "$_curl_exit" = "0" ]; then
    cp push.sh push.sh.bak 2>/dev/null
    mv "$_tmp_dl" push.sh
    chmod +x push.sh
    rm -f "$_UPDATE_FLAG" 2>/dev/null
    echo ""
    echo -e "  ${C_GREEN}✅  push.sh berhasil diupdate ke versi ${C_BOLD}${_new_ver}${C_RESET}"
    echo -e "  ${C_DIM}   Backup tersimpan di ${C_BOLD}push.sh.bak${C_RESET}"
    echo ""
    echo -e "  ${C_YELLOW}🔄  Jalankan ulang script:  ${C_BOLD}bash push.sh${C_RESET}"
    echo ""
    # ── Notif Telegram: update sukses ────────────────────────────────────
    local _btn_upd_ok='{"inline_keyboard":[[{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"},{"text":"🔄 Lihat Commits","url":"https://github.com/'"${USER}"'/'"${REPO}"'/commits/'"${DEFAULT_BRANCH}"'"}],[{"text":"📝 push.sh Baru","url":"https://github.com/'"${USER}"'/'"${REPO}"'/blob/'"${DEFAULT_BRANCH}"'/push.sh"},{"text":"🚀 Releases","url":"https://github.com/'"${USER}"'/'"${REPO}"'/releases"}]]}'
    send_telegram_photo "https://cdn.myanimelist.net/images/anime/1337/99013.jpg" "🔄 <b>PUSH SCRIPT BERHASIL DIUPDATE</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${USER}</code>
📁 <code>${USER}/${REPO}</code>
📌 Versi lama : <b>${SCRIPT_VERSION}</b>
🆕 Versi baru : <b>${_new_ver}</b>
✅ Status     : <b>Update Sukses</b>
━━━━━━━━━━━━━━━━━━━━
🕐 ${_upd_ts}" "$_btn_upd_ok" 2>/dev/null &
    printf "  ${C_DIM}Tekan Enter untuk keluar...${C_RESET}"
    read -r </dev/tty
    exit 0
  else
    rm -f "$_tmp_dl" 2>/dev/null
    echo ""
    echo -e "  ${C_RED}❌  Gagal mengunduh update. Coba lagi nanti.${C_RESET}"
    # ── Notif Telegram: update gagal ─────────────────────────────────────
    local _btn_upd_fail='{"inline_keyboard":[[{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"},{"text":"🔄 Coba Lagi","url":"https://github.com/'"${USER}"'/'"${REPO}"'/blob/'"${DEFAULT_BRANCH}"'/push.sh"}],[{"text":"🌐 GitHub Status","url":"https://githubstatus.com/"}]]}'
    send_telegram_photo "https://cdn.myanimelist.net/images/anime/1286/99889.jpg" "🔄 <b>UPDATE PUSH SCRIPT GAGAL</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${USER}</code>
📁 <code>${USER}/${REPO}</code>
📌 Versi lama : <b>${SCRIPT_VERSION}</b>
🆕 Versi target : <b>${_new_ver}</b>
❌ Status     : <b>Download Gagal</b>
━━━━━━━━━━━━━━━━━━━━
🕐 ${_upd_ts}" "$_btn_upd_fail" 2>/dev/null &
    sleep 2
  fi
}

# ===== Menu utama =====
show_main_menu() {
  banner

  # ── Banner update (muncul kalau ada versi baru) ───────────────────────────
  local _upd_ver="" _upd_url=""
  if [ -f "$_UPDATE_FLAG" ]; then
    _upd_ver=$(sed -n '1p' "$_UPDATE_FLAG")
    _upd_url=$(sed -n '2p' "$_UPDATE_FLAG")
  fi
  if [ -n "$_upd_ver" ]; then
    echo -e "  ${C_BOLD}${C_GREEN}╔══════════════════════════════════╗${C_RESET}"
    echo -e "  ${C_BOLD}${C_GREEN}║  🆕  UPDATE TERSEDIA!  ▸ [u]     ║${C_RESET}"
    printf  "  ${C_GREEN}║  Versi baru : %-20s║${C_RESET}\n" "${_upd_ver}"
    echo -e "  ${C_BOLD}${C_GREEN}╚══════════════════════════════════╝${C_RESET}"
    echo ""
  fi

  # ── Grup: Branch 1–7 ─────────────────
  echo -e "  ${C_DIM}🌿 BRANCH${C_RESET}"
  echo -e "  ${C_DIM}──────────────────────────────────${C_RESET}"
  printf "  ${C_GREEN} 1${C_RESET} › %-16s  ${C_CYAN} 2${C_RESET} › %s\n"    "Upload branch"  "Buat branch"
  printf "  ${C_YELLOW} 3${C_RESET} › %-16s  ${C_MAGENTA} 4${C_RESET} › %s\n" "Hapus branch"  "Ganti default"
  printf "  ${C_BLUE} 5${C_RESET} › %-16s  ${C_BLUE} 6${C_RESET} › %s\n"     "Cek token"      "Edit nama branch"
  printf "  ${C_GREEN} 7${C_RESET} › %-16s\n"                                 "Status branch"
  echo -e "  ${C_DIM}  default: ${C_RESET}${C_GREEN}${DEFAULT_BRANCH}${C_RESET}"
  echo ""
  # ── Grup: Repository 8–14 ─────────────
  echo -e "  ${C_DIM}📁 REPOSITORY${C_RESET}"
  echo -e "  ${C_DIM}──────────────────────────────────${C_RESET}"
  printf "  ${C_BLUE} 8${C_RESET} › %-16s  ${C_YELLOW} 9${C_RESET} › %s\n"   "Rename repo"    "Buat repo baru"
  printf "  ${C_BLUE}10${C_RESET} › %-16s  ${C_RED}11${C_RESET} › %s\n"      "Import repo"    "Hapus repo"
  printf "  ${C_MAGENTA}12${C_RESET} › %-16s  ${C_CYAN}13${C_RESET} › %s\n"  "Semua repo"     "Releases & Tags"
  printf "  ${C_GREEN}14${C_RESET} › %-16s\n"                                 "Ganti repo"
  echo -e "  ${C_DIM}  repo   : ${C_RESET}${C_BOLD}${USER}/${REPO}${C_RESET}"
  echo ""
  # ── Grup: Lainnya ─────────────────────
  # Cek status node_modules untuk label di menu
  local _nm_label _nm_status_str
  if [ -d node_modules ] && [ -d node_modules/.bin ]; then
    local _nm_c; _nm_c=$(ls -1 node_modules 2>/dev/null | grep -v '^\.' | wc -l | tr -d ' ')
    _nm_label="Install node_modules"
    _nm_status_str="${C_GREEN}✓ ${_nm_c} pkg${C_RESET}"
  else
    _nm_label="Install node_modules"
    _nm_status_str="${C_RED}⚠ belum ada${C_RESET}"
  fi
  echo -e "  ${C_DIM}⚡ LAINNYA${C_RESET}"
  echo -e "  ${C_DIM}──────────────────────────────────${C_RESET}"
  printf "  ${C_GREEN} p${C_RESET} › %-16s  ${C_MAGENTA} l${C_RESET} › %s\n" "Quick Push"     "Riwayat push"
  printf "  ${C_YELLOW} c${C_RESET} › %-16s  ${C_CYAN} n${C_RESET} › %-16s  %b\n" \
    "Bersihkan history" "$_nm_label" "$_nm_status_str"
  if [ -n "$_upd_ver" ]; then
    printf "  ${C_GREEN} u${C_RESET} › ${C_BOLD}%-16s${C_RESET}  ${C_DIM}versi sekarang: %s → baru: %s${C_RESET}\n" \
      "Update script" "$SCRIPT_VERSION" "$_upd_ver"
  fi
  printf "  ${C_RED} 0${C_RESET} › %s\n"                                      "Keluar"
  echo -e "  ${C_DIM}──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"

  local pick
  read -r pick
  pick="${pick:-1}"

  case "$pick" in
    1) show_menu; run_upload ;;
    2) action_create_branch ;;
    3) action_delete_branch ;;
    4) action_switch_default ;;
    5) action_check_token ;;
    6) action_rename_branch ;;
    7) action_list_branches ;;
    8) action_rename_repo ;;
    9) action_create_repo ;;
    10) action_import_repo ;;
    11) action_delete_repo ;;
    12) action_list_repos ;;
    13) action_releases_tags ;;
    14) action_switch_repo ;;
    p|P) action_quick_push ;;
    l|L) action_view_push_log ;;
    c|C) action_cleanup_node_modules ;;
    n|N) action_install_node_modules ;;
    u|U) action_self_update "$_upd_ver" "$_upd_url" ;;
    0|q|Q|exit) goodbye_prompt ;;
    *)
      echo -e "${C_RED}✖ Pilihan tidak valid: '${pick}'${C_RESET}"
      sleep 1
      ;;
  esac
}

# ===== Build detail file/folder yang berubah untuk notif push =====
# Output: string multi-line siap pakai di caption Telegram
_build_push_detail() {
  local _diff
  _diff=$(git diff --name-status HEAD~1 HEAD 2>/dev/null)
  [ -z "$_diff" ] && _diff=$(git show --name-status --format="" HEAD 2>/dev/null | grep -E '^[AMDRC]')
  [ -z "$_diff" ] && return 0

  # Gunakan file temp agar aman di semua lingkungan bash (subshell-safe)
  local _tmp_add _tmp_mod _tmp_del
  _tmp_add=$(mktemp)
  _tmp_mod=$(mktemp)
  _tmp_del=$(mktemp)

  # Parse diff ke file temp — pisahkan per status tanpa /dev/fd non-standar
  echo "$_diff" | awk -F'\t' 'substr($1,1,1)=="A"             {print $2}' > "$_tmp_add"
  echo "$_diff" | awk -F'\t' 'substr($1,1,1)=="M"             {print $2}' > "$_tmp_mod"
  echo "$_diff" | awk -F'\t' 'substr($1,1,1)=="R"||substr($1,1,1)=="C" {print ($3==""?$2:$3)}' >> "$_tmp_mod"
  echo "$_diff" | awk -F'\t' 'substr($1,1,1)=="D"             {print $2}' > "$_tmp_del"

  local _added _modified _deleted _renamed
  _added=$(wc -l < "$_tmp_add" 2>/dev/null | tr -d ' \n' || echo 0)
  _modified=$(wc -l < "$_tmp_mod" 2>/dev/null | tr -d ' \n' || echo 0)
  _deleted=$(wc -l < "$_tmp_del" 2>/dev/null | tr -d ' \n' || echo 0)
  _added=${_added:-0}; _modified=${_modified:-0}; _deleted=${_deleted:-0}

  # Hitung renamed terpisah untuk info statistik
  _renamed=$(echo "$_diff" | awk -F'\t' 'substr($1,1,1)=="R"||substr($1,1,1)=="C"{c++} END{print c+0}')

  local _total=$((_added+_modified+_deleted))
  if [ "$_total" -eq 0 ]; then
    rm -f "$_tmp_add" "$_tmp_mod" "$_tmp_del"
    return 0
  fi

  # Baris statistik
  local _stat=""
  [ "$_added"    -gt 0 ] && _stat="${_stat}➕ ${_added} baru  "
  [ "$_modified" -gt 0 ] && _stat="${_stat}✏️ ${_modified} ubah  "
  [ "$_renamed"  -gt 0 ] && _stat="${_stat}🔀 ${_renamed} rename  "
  [ "$_deleted"  -gt 0 ] && _stat="${_stat}🗑 ${_deleted} hapus"
  _stat="${_stat%  }"

  # Folder-folder terdampak (max 5, unik) — gabung semua file lalu ambil direktorinya
  local _folders
  _folders=$(cat "$_tmp_add" "$_tmp_mod" "$_tmp_del" 2>/dev/null \
    | grep '/' \
    | sed 's|/[^/]*$||' \
    | sort -u \
    | head -5 \
    | tr '\n' ' ' \
    | sed 's/ *$//')
  [ -z "$_folders" ] && _folders="(root)"

  # Daftar file (max 8, prioritas: baru → ubah → hapus)
  local _shown=0 _max=8 _list=""
  while IFS= read -r _f && [ "$_shown" -lt "$_max" ]; do
    [ -z "$_f" ] && continue
    _list="${_list}📄 <code>${_f}</code> ‹baru›\n"
    _shown=$((_shown+1))
  done < "$_tmp_add"
  while IFS= read -r _f && [ "$_shown" -lt "$_max" ]; do
    [ -z "$_f" ] && continue
    _list="${_list}📝 <code>${_f}</code>\n"
    _shown=$((_shown+1))
  done < "$_tmp_mod"
  while IFS= read -r _f && [ "$_shown" -lt "$_max" ]; do
    [ -z "$_f" ] && continue
    _list="${_list}🗑 <code>${_f}</code> ‹hapus›\n"
    _shown=$((_shown+1))
  done < "$_tmp_del"

  local _sisa=$((_total-_shown))

  rm -f "$_tmp_add" "$_tmp_mod" "$_tmp_del"

  printf '━━━━━━━━━━━━━━━━━━━━\n'
  printf '%s\n' "$_stat"
  printf '📂 %s\n' "$_folders"
  printf '━━━━━━━━━━━━━━━━━━━━\n'
  printf '%b' "$_list"
  [ "$_sisa" -gt 0 ] && printf '   ... +%d file lainnya\n' "$_sisa"
}

# ===== Catat event push ke log file =====
# Usage: log_push_event "<branch>" "<status: OK|FAIL>" "<commit_msg>" "<jumlah_file>"
log_push_event() {
  local _branch="${1:-?}"
  local _status="${2:-?}"
  local _msg="${3:--}"
  local _files="${4:-0}"
  local _ts _commit_hash
  _ts=$(date '+%Y-%m-%d %H:%M:%S')
  _commit_hash=$(git rev-parse --short HEAD 2>/dev/null || echo "?")
  printf '[%s] %-6s | branch: %-30s | hash: %s | file: %s | %s\n' \
    "$_ts" "$_status" "$_branch" "$_commit_hash" "$_files" "$_msg" \
    >> "${PUSH_LOG_FILE}" 2>/dev/null || true
}

# ===== Tampilkan riwayat push =====
action_view_push_log() {
  local _LOG_PAGE="${_LOG_PAGE:-1}"
  local _LOG_PAGE_SIZE=15

  if [ ! -f "$PUSH_LOG_FILE" ] || [ ! -s "$PUSH_LOG_FILE" ]; then
    clear >/dev/tty 2>/dev/null || true
    echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
    echo -e "${C_BOLD}│  📋  RIWAYAT PUSH — BANG WILY    │${C_RESET}"
    echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
    echo ""
    echo -e "  ${C_DIM}📭 Belum ada riwayat push.${C_RESET}"
    echo -e "  ${C_DIM}   Log akan muncul setelah push pertama kali.${C_RESET}"
    echo ""
    prompt_back_or_exit
    return
  fi

  # ── Baca semua baris ke array ─────────────────────────────────────────────
  local _lines=()
  while IFS= read -r _l; do
    [ -n "$_l" ] && _lines+=("$_l")
  done < "$PUSH_LOG_FILE"

  local _total=${#_lines[@]}
  local _total_pages=$(( (_total + _LOG_PAGE_SIZE - 1) / _LOG_PAGE_SIZE ))
  [ "$_total_pages" -eq 0 ] && _total_pages=1
  [ "$_LOG_PAGE" -gt "$_total_pages" ] && _LOG_PAGE=$_total_pages
  [ "$_LOG_PAGE" -lt 1 ] && _LOG_PAGE=1

  # Tampilkan dari bawah (terbaru dulu) — hitung indeks terbalik
  local _start=$(( _total - (_LOG_PAGE - 1) * _LOG_PAGE_SIZE - 1 ))
  local _end=$(( _start - _LOG_PAGE_SIZE + 1 ))
  [ "$_end" -lt 0 ] && _end=0

  # ── Statistik ringkas ─────────────────────────────────────────────────────
  local _ok _force _fail
  _ok=$(grep -c    ' OK |OK ' "$PUSH_LOG_FILE" 2>/dev/null || echo 0)
  _force=$(grep -c 'OK(force)' "$PUSH_LOG_FILE" 2>/dev/null || echo 0)
  _fail=$(grep -c  ' FAIL '    "$PUSH_LOG_FILE" 2>/dev/null || echo 0)

  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│  📋  RIWAYAT PUSH — BANG WILY    │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  # Statistik 1 baris
  echo -e "  ${C_BOLD}${_total}${C_RESET} push  ${C_GREEN}✅${_ok}${C_RESET}  ${C_YELLOW}⚡${_force}${C_RESET}  ${C_RED}❌${_fail}${C_RESET}  ${C_DIM}repo: ${USER}/${REPO}${C_RESET}"
  if [ "$_total_pages" -gt 1 ]; then
    echo -e "  ${C_DIM}hal ${_LOG_PAGE}/${_total_pages}  •  terbaru di atas${C_RESET}"
  fi
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"

  # ── Daftar entry: 1 baris per push ───────────────────────────────────────
  local _row_num=0
  for (( i=_start; i>=_end; i-- )); do
    _row_num=$(( _row_num + 1 ))
    local _raw="${_lines[$i]}"

    # Parse log line
    local _ts _stat _branch _hash _files _msg
    _ts=$(    echo "$_raw" | sed 's/^\[\([^]]*\)\].*/\1/')
    _stat=$(  echo "$_raw" | grep -oE '\] [A-Za-z()]+' | head -1 | tr -d '] ')
    _branch=$(echo "$_raw" | sed 's/.*branch: \([^|]*\)/\1/' | sed 's/ *|.*//' | tr -d ' ')
    _hash=$(  echo "$_raw" | sed 's/.*hash: \([^ |]*\).*/\1/')
    _files=$( echo "$_raw" | sed 's/.*file: \([^ |]*\).*/\1/')
    _msg=$(   echo "$_raw" | sed 's/.*| //' | cut -c1-32)

    local _time_s _date_s
    _date_s=$(echo "$_ts" | cut -c6-10)   # MM-DD
    _time_s=$(echo "$_ts" | cut -c12-16)  # HH:MM

    local _icon _col
    case "$_stat" in
      OK)         _icon="✅"; _col="$C_GREEN"  ;;
      OK\(force\)) _icon="⚡"; _col="$C_YELLOW" ;;
      FAIL)       _icon="❌"; _col="$C_RED"    ;;
      *)          _icon="•";  _col="$C_DIM"    ;;
    esac

    # Format: [icon] [no] [jam] [tgl] [branch<=18] [hash<=7] [file] [msg<=32]
    local _br_fmt; _br_fmt=$(printf "%-18s" "$(echo "$_branch" | cut -c1-18)")
    local _hsh_fmt; _hsh_fmt=$(printf "%-7s" "$(echo "$_hash" | cut -c1-7)")
    printf "  %b%s%b %b%2d%b %s %s  %b%s%b  %b%s%b %bf%b%s  %b%s%b\n" \
      "$_col" "$_icon" "$C_RESET" \
      "$C_DIM" "$_row_num" "$C_RESET" \
      "$_time_s" "$_date_s" \
      "$C_CYAN" "$_br_fmt" "$C_RESET" \
      "$C_DIM" "$_hsh_fmt" "$C_RESET" \
      "$C_DIM" "$C_RESET" "$_files" \
      "$C_DIM" "$_msg" "$C_RESET"
  done

  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"

  # Navigasi halaman
  if [ "$_total_pages" -gt 1 ]; then
    local _nav_l=""
    [ "$_LOG_PAGE" -lt "$_total_pages" ] && _nav_l="${_nav_l}  ${C_CYAN}n${C_RESET} › Lebih lama"
    [ "$_LOG_PAGE" -gt 1 ]               && _nav_l="${_nav_l}   ${C_CYAN}p${C_RESET} › Lebih baru"
    [ -n "$_nav_l" ] && echo -e "$_nav_l"
  fi
  echo -e "  ${C_YELLOW}h${C_RESET} ${C_BOLD}›${C_RESET} Hapus semua   ${C_GREEN}1${C_RESET} ${C_BOLD}›${C_RESET} Kembali   ${C_RED}0${C_RESET} ${C_BOLD}›${C_RESET} Keluar"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"

  local _ans
  read -r _ans </dev/tty
  case "$_ans" in
    n|N) _LOG_PAGE=$(( _LOG_PAGE < _total_pages ? _LOG_PAGE + 1 : _LOG_PAGE )) action_view_push_log; return ;;
    p|P) _LOG_PAGE=$(( _LOG_PAGE > 1 ? _LOG_PAGE - 1 : 1 )) action_view_push_log; return ;;
    h|H)
      printf "  ${C_YELLOW}⚠️  Hapus semua %s riwayat? (y/N) ▸ ${C_RESET}" "$_total"
      local _conf; read -r _conf </dev/tty
      case "$_conf" in
        y|Y)
          rm -f "$PUSH_LOG_FILE"
          echo -e "  ${C_GREEN}✅ Semua riwayat dihapus.${C_RESET}"
          sleep 1 ;;
        *) echo -e "  ${C_DIM}Dibatalkan.${C_RESET}"; sleep 1 ;;
      esac ;;
    0|q|Q) goodbye_prompt ;;
  esac
}

# ===== Action: quick push ke default branch =====
action_quick_push() {
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│  ⚡  QUICK PUSH — BANG WILY       │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo -e "  ${C_DIM}target${C_RESET}  ${C_GREEN}${C_BOLD}${DEFAULT_BRANCH}${C_RESET}"
  echo -e "  ${C_DIM}repo  ${C_RESET}  ${C_BOLD}${USER}/${REPO}${C_RESET}"
  echo ""

  # Cek ada perubahan tidak
  local _st _changed
  _st=$(git status --porcelain 2>/dev/null)
  _changed=$(echo "$_st" | grep -v '^$' | wc -l | tr -d ' ')

  # Cek ahead
  local _ahead
  _ahead=$(git rev-list --count "@{u}..HEAD" 2>/dev/null || echo "0")

  if [ "$_changed" -eq 0 ] && [ "$_ahead" -eq 0 ]; then
    echo -e "  ${C_DIM}✓ Tidak ada perubahan & sudah sinkron.${C_RESET}"
    echo -e "  ${C_DIM}  Tidak perlu push.${C_RESET}"
    echo ""
    prompt_back_or_exit
    return
  fi

  # Tampilkan ringkasan
  if [ "$_changed" -gt 0 ]; then
    echo -e "  ${C_YELLOW}📝 ${_changed} file berubah akan di-commit & push${C_RESET}"
  fi
  if [ "$_ahead" -gt 0 ]; then
    echo -e "  ${C_GREEN}↑  ${_ahead} commit lokal belum di-push${C_RESET}"
  fi
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}1${C_RESET} ${C_BOLD}›${C_RESET} Lanjut push sekarang"
  echo -e "  ${C_RED}0${C_RESET} ${C_BOLD}›${C_RESET} Batal"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"

  local _confirm
  read -r _confirm </dev/tty
  if [ "$_confirm" != "1" ]; then
    echo -e "  ${C_YELLOW}↩ Dibatalkan.${C_RESET}"
    sleep 1
    return
  fi

  echo ""
  echo -e "  ${C_CYAN}▸ Staging semua perubahan...${C_RESET}"
  if ! stage_changes; then
    echo -e "  ${C_RED}❌ Gagal staging. Cek error di atas.${C_RESET}"
    prompt_back_or_exit
    return
  fi

  # Tampilkan preview file yang akan di-commit & minta konfirmasi.
  if ! preview_staged_confirm; then
    prompt_back_or_exit
    return
  fi

  # Generate commit message otomatis
  local _msg
  _msg=$(generate_commit_msg 2>/dev/null || echo "chore: quick push via Bang Wily")
  [ -z "$_msg" ] && _msg="chore: quick push via Bang Wily"

  echo -e "  ${C_CYAN}▸ Commit: ${C_RESET}${C_DIM}${_msg}${C_RESET}"
  git commit -m "$_msg" --allow-empty >/dev/null 2>&1 || true

  echo -e "  ${C_CYAN}▸ Push ke ${C_RESET}${C_GREEN}${DEFAULT_BRANCH}${C_RESET}${C_CYAN}...${C_RESET}"
  local _push_out _push_ok=0
  _push_out=$(git push "${REMOTE_URL:-origin}" "HEAD:${DEFAULT_BRANCH}" 2>&1)
  [ $? -eq 0 ] && _push_ok=1

  echo ""
  local _ts_now; _ts_now=$(date '+%H:%M:%S %d %b %Y')
  if [ "$_push_ok" -eq 1 ]; then
    echo -e "  ${C_GREEN}✅ Push berhasil!${C_RESET}"
    echo -e "  ${C_BLUE}🔗 https://github.com/${USER}/${REPO}/tree/${DEFAULT_BRANCH}${C_RESET}"
    log_push_event "$DEFAULT_BRANCH" "OK" "$_msg" "$_changed"
    local _btn_pushok='{"inline_keyboard":[[{"text":"🔗 Lihat Branch","url":"https://github.com/'"${USER}"'/'"${REPO}"'/tree/'"${DEFAULT_BRANCH}"'"},{"text":"📊 Commits","url":"https://github.com/'"${USER}"'/'"${REPO}"'/commits/'"${DEFAULT_BRANCH}"'"}],[{"text":"🔀 Compare","url":"https://github.com/'"${USER}"'/'"${REPO}"'/compare"},{"text":"📥 Pull Request","url":"https://github.com/'"${USER}"'/'"${REPO}"'/pulls"}]]}'
    local _qp_detail; _qp_detail=$(_build_push_detail 2>/dev/null || true)
    send_telegram_photo "https://w.wallhaven.cc/full/je/wallhaven-je9x7y.jpg" "✅ <b>PUSH BERHASIL</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🌿 Branch: <code>${DEFAULT_BRANCH}</code>
📝 ${_msg}
${_qp_detail}
🕐 ${_ts_now}" "$_btn_pushok"
  else
    echo -e "  ${C_RED}❌ Push gagal.${C_RESET}"
    echo "$_push_out" | tail -5 | sed 's/^/     /'
    log_push_event "$DEFAULT_BRANCH" "FAIL" "$_msg" "$_changed"
    local _btn_pushfail='{"inline_keyboard":[[{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"},{"text":"🔑 Kelola Token","url":"https://github.com/settings/tokens"}],[{"text":"🐛 Issues","url":"https://github.com/'"${USER}"'/'"${REPO}"'/issues"},{"text":"📋 Action Logs","url":"https://github.com/'"${USER}"'/'"${REPO}"'/actions"}]]}'
    send_telegram_photo "https://w.wallhaven.cc/full/l3/wallhaven-l3g62l.jpg" "❌ <b>PUSH GAGAL</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🌿 Branch: <code>${DEFAULT_BRANCH}</code>
📝 ${_msg}
⚠️ Periksa koneksi / token / konflik branch
🕐 ${_ts_now}" "$_btn_pushfail"
  fi

  echo ""
  prompt_back_or_exit
}

# ===== Action: cek status token =====
action_check_token() {
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   🔍  CEK STATUS TOKEN           │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""

  if [ ! -f .token.secret ]; then
    echo -e "  ${C_RED}❌ File .token.secret tidak ditemukan.${C_RESET}"
    echo -e "  ${C_DIM}   Jalankan script dulu untuk menyimpan token.${C_RESET}"
    prompt_back_or_exit
    return
  fi

  local tok
  tok=$(tr -d '\n\r ' < .token.secret)

  if [ -z "$tok" ]; then
    echo -e "  ${C_RED}❌ File .token.secret kosong.${C_RESET}"
    prompt_back_or_exit
    return
  fi

  local tok_type_label tok_type_color
  case "$tok" in
    ghp_*)        tok_type_label="Classic Token (ghp_...)";              tok_type_color="$C_GREEN"  ;;
    github_pat_*) tok_type_label="Fine-grained Token (github_pat_...)"; tok_type_color="$C_GREEN"  ;;
    ghs_*)        tok_type_label="Server-to-Server Token (ghs_...)";    tok_type_color="$C_YELLOW" ;;
    gho_*)        tok_type_label="OAuth App Token (gho_...)";           tok_type_color="$C_YELLOW" ;;
    ghu_*)        tok_type_label="OAuth User Token (ghu_...)";          tok_type_color="$C_YELLOW" ;;
    *)            tok_type_label="Format tidak dikenal";                tok_type_color="$C_RED"    ;;
  esac

  local tok_masked
  tok_masked="${tok:0:10}****${tok: -4}"

  echo -e "  ${C_DIM}Token   :${C_RESET} ${tok_masked}"
  echo -e "  ${C_DIM}Jenis   :${C_RESET} ${tok_type_color}${C_BOLD}${tok_type_label}${C_RESET}"
  echo ""
  mini_bar_start "Validasi token ke GitHub ..." 0.04

  local api_out
  api_out=$(curl -s -i \
    -H "Authorization: Bearer ${tok}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/user" 2>/dev/null)

  local http_code
  http_code=$(echo "$api_out" | head -1 | grep -oE '[0-9]{3}' | head -1)
  if [ "$http_code" = "200" ]; then mini_bar_ok "Token aktif ✅"; else mini_bar_fail "HTTP ${http_code}"; fi

  local headers body
  headers=$(printf '%s' "$api_out" | awk '/^\r?$/{exit} {print}')
  body=$(printf '%s' "$api_out" | awk 'BEGIN{f=0} /^\r?$/{f=1;next} f{print}')

  if [ "$http_code" = "200" ]; then
    local gh_login gh_name gh_type scopes
    gh_login=$(echo "$body" | grep -o '"login": *"[^"]*"' | head -1 | sed 's/"login": *"//;s/"//')
    gh_name=$(echo "$body"  | grep -o '"name": *"[^"]*"'  | head -1 | sed 's/"name": *"//;s/"//')
    gh_type=$(echo "$body"  | grep -o '"type": *"[^"]*"'  | head -1 | sed 's/"type": *"//;s/"//')
    scopes=$(echo "$headers" | grep -i 'x-oauth-scopes' | sed 's/.*: *//' | tr -d '\r')

    local rate_limit rate_remaining rate_reset rate_reset_fmt
    rate_limit=$(echo "$headers"     | grep -i 'x-ratelimit-limit:'     | sed 's/.*: *//' | tr -d '\r')
    rate_remaining=$(echo "$headers" | grep -i 'x-ratelimit-remaining:' | sed 's/.*: *//' | tr -d '\r')
    rate_reset=$(echo "$headers"     | grep -i 'x-ratelimit-reset:'     | sed 's/.*: *//' | tr -d '\r')
    rate_reset_fmt=""
    if [ -n "$rate_reset" ]; then
      rate_reset_fmt=$(date -d "@${rate_reset}" '+%H:%M:%S' 2>/dev/null \
        || date -r "$rate_reset" '+%H:%M:%S' 2>/dev/null \
        || echo "$rate_reset")
    fi

    echo -e "  ${C_GREEN}✅ Token VALID${C_RESET}"
    echo ""
    echo -e "${C_DIM}  ── Akun GitHub ────────────────────${C_RESET}"
    echo -e "  ${C_DIM}Username ${C_RESET}${C_BOLD}${gh_login}${C_RESET}"
    [ -n "$gh_name" ] && echo -e "  ${C_DIM}Nama     ${C_RESET}${gh_name}"
    [ -n "$gh_type" ] && echo -e "  ${C_DIM}Tipe     ${C_RESET}${gh_type}"
    echo ""
    echo -e "${C_DIM}  ── Token ──────────────────────────${C_RESET}"
    if [ -n "$scopes" ]; then
      echo -e "  ${C_DIM}Scopes   ${C_RESET}${C_GREEN}${scopes}${C_RESET}"
    else
      echo -e "  ${C_DIM}Scopes   ${C_RESET}${C_DIM}fine-grained / tidak via header${C_RESET}"
    fi
    echo ""
    echo -e "${C_DIM}  ── Rate Limit API ─────────────────${C_RESET}"
    [ -n "$rate_limit" ]     && echo -e "  ${C_DIM}Limit    ${C_RESET}${rate_limit} req/jam"
    [ -n "$rate_remaining" ] && echo -e "  ${C_DIM}Sisa     ${C_RESET}${C_CYAN}${rate_remaining}${C_RESET}"
    [ -n "$rate_reset_fmt" ] && echo -e "  ${C_DIM}Reset    ${C_RESET}${rate_reset_fmt}"
  else
    local api_msg
    api_msg=$(echo "$body" | grep -o '"message": *"[^"]*"' | head -1 | sed 's/"message": *"//;s/"//')
    echo -e "  ${C_RED}❌ Token TIDAK VALID atau kadaluarsa (HTTP ${http_code})${C_RESET}"
    [ -n "$api_msg" ] && echo -e "  ${C_DIM}   GitHub: ${api_msg}${C_RESET}"
    echo ""
    echo -e "  ${C_YELLOW}💡 Pilih opsi 1/2/3 di menu token untuk menyimpan token baru.${C_RESET}"
  fi

  echo ""
  prompt_back_or_exit
}

# ===== Action: rename repository =====
action_rename_repo() {
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   ✏️   RENAME REPOSITORY         │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}sekarang  ${C_RESET}${C_BOLD}${USER}/${REPO}${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  ${C_RED}0${C_RESET} ${C_BOLD}›${C_RESET} Kembali ke menu"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}Nama baru ▸ ${C_RESET}"

  local new_name
  read -r new_name
  new_name=$(echo "$new_name" | tr -d '[:space:]')

  if [ -z "$new_name" ] || [ "$new_name" = "0" ]; then
    echo -e "${C_YELLOW}↩ Kembali ke menu.${C_RESET}"
    sleep 1
    return
  fi

  # Validasi: hanya huruf, angka, - dan _
  if ! echo "$new_name" | grep -qE '^[a-zA-Z0-9_-]+$'; then
    echo -e "${C_RED}✖ Nama tidak valid${C_RESET} ${C_DIM}(hanya huruf, angka, - dan _)${C_RESET}"
    sleep 2
    return
  fi

  if [ "$new_name" = "$REPO" ]; then
    echo -e "${C_YELLOW}ℹ️  Nama sama seperti sekarang, tidak ada yang diubah.${C_RESET}"
    sleep 2
    return
  fi

  # Konfirmasi
  echo ""
  echo -e "  ${C_RED}⚠️  Yakin rename?${C_RESET}"
  echo -e "  ${C_DIM}${USER}/${REPO}${C_RESET} ${C_BOLD}→${C_RESET} ${C_GREEN}${USER}/${new_name}${C_RESET}"
  echo -e "  ${C_DIM}Remote URL lokal ikut diperbarui otomatis.${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}1${C_RESET} ${C_BOLD}›${C_RESET} Lanjut rename"
  echo -e "  ${C_RED}0${C_RESET} ${C_BOLD}›${C_RESET} Batal"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local confirm
  read -r confirm
  if [ "$confirm" != "1" ]; then
    echo -e "${C_YELLOW}↩ Dibatalkan.${C_RESET}"
    sleep 1
    return
  fi

  echo ""
  local old_repo="$REPO"
  mini_bar2_start "Rename repo di GitHub ..." "Kirim PATCH ke GitHub API..." 0.05

  local api_http
  api_http=$(curl -s -o /tmp/_gh_rename.json -w "%{http_code}" \
    -X PATCH \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${USER}/${REPO}" \
    -d "{\"name\":\"${new_name}\"}" 2>/dev/null)

  relogin_if_needed "$api_http" "rename repo" || return
  if [ "$api_http" = "200" ]; then
    mini_bar2_ok "Rename berhasil" "${old_repo} → ${new_name} ✓"
    REPO="$new_name"

    # Update REPO di push.sh secara permanen
    sed -i "s|^REPO=.*|REPO=\"${new_name}\"|" "$0" 2>/dev/null || true

    # Update remote URL lokal agar tidak putus
    local new_url="https://${USER}:${TOKEN}@github.com/${USER}/${new_name}.git"
    git remote set-url origin "$new_url" 2>/dev/null || true

    echo ""
    echo -e "  ${C_GREEN}✅ Repository berhasil di-rename di GitHub!${C_RESET}"
    echo -e "     ${C_DIM}${USER}/${old_repo}${C_RESET} ${C_BOLD}→${C_RESET} ${C_GREEN}${USER}/${new_name}${C_RESET}"
    echo -e "  ${C_BLUE}🔗 https://github.com/${USER}/${new_name}${C_RESET}"
    echo -e "  ${C_DIM}Remote URL lokal sudah diperbarui otomatis.${C_RESET}"
    echo -e "  ${C_DIM}Perubahan nama disimpan permanen di push.sh${C_RESET}"
    local _ts_rr; _ts_rr=$(date '+%H:%M:%S %d %b %Y')
    local _btn_rr='{"inline_keyboard":[[{"text":"📁 Buka Repo Baru","url":"https://github.com/'"${USER}"'/'"${new_name}"'"},{"text":"⚙️ Settings Repo","url":"https://github.com/'"${USER}"'/'"${new_name}"'/settings"}],[{"text":"🌿 Branches","url":"https://github.com/'"${USER}"'/'"${new_name}"'/branches"},{"text":"📊 Commits","url":"https://github.com/'"${USER}"'/'"${new_name}"'/commits"}]]}'
    send_telegram_photo "https://w.wallhaven.cc/full/l3/wallhaven-l3q6eq.png" "✏️ <b>REPO DI-RENAME</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${USER}</code>
🔄 <code>${old_repo}</code> → <code>${new_name}</code>
🔗 github.com/${USER}/${new_name}
🕐 ${_ts_rr}" "$_btn_rr" 2>/dev/null &
  else
    local api_msg
    api_msg=$(grep -o '"message":"[^"]*"' /tmp/_gh_rename.json 2>/dev/null | head -1 | sed 's/"message":"//;s/"//')
    mini_bar2_fail "Gagal HTTP ${api_http}" "${api_msg:-error dari GitHub API}"
    echo ""
    echo -e "  ${C_RED}❌ Gagal rename repository (HTTP ${api_http})${C_RESET}"
    [ -n "$api_msg" ] && echo -e "  ${C_DIM}   GitHub: ${api_msg}${C_RESET}"
    echo -e "  ${C_DIM}   Pastikan token punya permission: delete_repo atau repo (full)${C_RESET}"
  fi

  rm -f /tmp/_gh_rename.json
  prompt_back_or_exit
}

# ===== Action: ganti default branch =====
action_switch_default() {
  local _GD_PAGE="${_GD_PAGE:-1}"
  local _GD_PAGE_SIZE=8

  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   🔀  GANTI DEFAULT BRANCH       │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  _MB_SUB_FILE=$(mktemp)
  printf "Menghubungi GitHub API..." > "$_MB_SUB_FILE"
  mini_bar2_start "Memuat daftar branch ..." "Menghubungi GitHub API..." 0.06
  local branches=()
  while IFS= read -r b; do
    if [ -n "$b" ] && [ "$b" != "$DEFAULT_BRANCH" ]; then
      branches+=("$b")
      printf "${#branches[@]} branch ditemukan..." > "$_MB_SUB_FILE"
    fi
  done < <(fetch_branches_recent)
  rm -f "$_MB_SUB_FILE" 2>/dev/null; _MB_SUB_FILE=""
  if [ "${#branches[@]}" -eq 0 ]; then
    mini_bar2_fail "Tidak ada branch lain" "Hanya ada default branch (${DEFAULT_BRANCH})"
  else
    mini_bar2_ok "Daftar branch siap" "${#branches[@]} branch tersedia ✓"
  fi

  local total=${#branches[@]}
  local total_pages=$(( (total + _GD_PAGE_SIZE - 1) / _GD_PAGE_SIZE ))
  [ "$total_pages" -eq 0 ] && total_pages=1
  [ "$_GD_PAGE" -gt "$total_pages" ] && _GD_PAGE=$total_pages
  [ "$_GD_PAGE" -lt 1 ] && _GD_PAGE=1

  local start=$(( (_GD_PAGE - 1) * _GD_PAGE_SIZE ))
  local end=$(( start + _GD_PAGE_SIZE ))
  [ "$end" -gt "$total" ] && end="$total"

  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   🔀  GANTI DEFAULT BRANCH       │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}repo    ${C_RESET}${C_BOLD}${USER}/${REPO}${C_RESET}"
  echo -e "  ${C_DIM}default ${C_RESET}${C_GREEN}${DEFAULT_BRANCH}${C_RESET}"
  if [ "$total_pages" -gt 1 ]; then
    echo -e "  ${C_DIM}posisi  ${C_RESET}${C_BOLD}$(( start + 1 ))–${end}${C_RESET}${C_DIM} dari ${total} branch  •  hal ${_GD_PAGE}/${total_pages}${C_RESET}"
  else
    echo -e "  ${C_DIM}total   ${C_RESET}${C_BOLD}${total} branch${C_RESET}"
  fi
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"

  if [ "$total" -eq 0 ]; then
    echo -e "  ${C_YELLOW}ℹ️  Tidak ada branch lain yang tersedia.${C_RESET}"
    prompt_back_or_exit
    return
  fi

  for (( i=start; i<end; i++ )); do
    printf "  ${C_CYAN}%2d${C_RESET} ${C_BOLD}›${C_RESET} %s\n" "$(( i + 1 ))" "${branches[$i]}"
  done

  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  if [ "$total_pages" -gt 1 ]; then
    local _nav_gd=""
    [ "$_GD_PAGE" -lt "$total_pages" ] && _nav_gd="${_nav_gd}  ${C_CYAN}n${C_RESET} › Berikutnya"
    [ "$_GD_PAGE" -gt 1 ]              && _nav_gd="${_nav_gd}   ${C_CYAN}p${C_RESET} › Sebelumnya"
    [ -n "$_nav_gd" ] && echo -e "$_nav_gd"
    echo -e "  ${C_CYAN}f${C_RESET} › Awal   ${C_CYAN}l${C_RESET} › Akhir   ${C_DIM}h<angka> → loncat hal  (mis: h3)${C_RESET}"
  fi
  echo -e "  ${C_DIM}💡 Ketik nomor dari list ATAU ketik nama branch langsung${C_RESET}"
  echo -e "  ${C_RED}  0${C_RESET} ${C_BOLD}›${C_RESET} Kembali ke menu"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}Nomor / nama branch ▸ ${C_RESET}"

  local pick
  read -r pick
  pick=$(echo "$pick" | tr -d '[:space:]')

  # Navigasi halaman
  case "$pick" in
    n|N) _GD_PAGE=$(( _GD_PAGE < total_pages ? _GD_PAGE + 1 : _GD_PAGE )) action_switch_default; return ;;
    p|P) _GD_PAGE=$(( _GD_PAGE > 1 ? _GD_PAGE - 1 : 1 )) action_switch_default; return ;;
    f|F) _GD_PAGE=1 action_switch_default; return ;;
    l|L) _GD_PAGE=$total_pages action_switch_default; return ;;
    h*|H*)
      local _pg_gd="${pick:1}"
      if echo "$_pg_gd" | grep -qE '^[0-9]+$' && [ "$_pg_gd" -ge 1 ] && [ "$_pg_gd" -le "$total_pages" ]; then
        _GD_PAGE=$_pg_gd action_switch_default
      else
        echo -e "  ${C_RED}✖ Halaman tidak valid${C_RESET} ${C_DIM}(1–${total_pages})${C_RESET}"
        sleep 1
        _GD_PAGE=$_GD_PAGE action_switch_default
      fi
      return
      ;;
  esac

  if [ -z "$pick" ] || [ "$pick" = "0" ]; then
    echo -e "${C_YELLOW}↩ Kembali ke menu.${C_RESET}"
    sleep 1
    return
  fi

  local name=""

  # Kalau input angka → ambil dari list (nomor global, bukan per halaman)
  if echo "$pick" | grep -qE '^[0-9]+$'; then
    if [ "$pick" -ge 1 ] && [ "$pick" -le "$total" ]; then
      name="${branches[$((pick - 1))]}"
    else
      echo -e "${C_RED}✖ Nomor tidak ada dalam list.${C_RESET}"
      sleep 2
      _GD_PAGE=$_GD_PAGE action_switch_default
      return
    fi
  else
    # Input nama langsung
    name="$pick"
  fi

  # Validasi nama (hanya alfanumerik, -, _, /, .)
  if ! echo "$name" | grep -qE '^[a-zA-Z0-9._/-]+$'; then
    echo -e "${C_RED}✖ Nama tidak valid${C_RESET} ${C_DIM}(hanya huruf, angka, - _ / .)${C_RESET}"
    sleep 2
    return
  fi

  # Cek apakah sama dengan default saat ini
  if [ "$name" = "$DEFAULT_BRANCH" ]; then
    echo -e "${C_YELLOW}⚠️  Branch '${name}' sudah menjadi default.${C_RESET}"
    sleep 2
    return
  fi

  # Cek ke GitHub hanya kalau input nama manual (dari list sudah pasti ada)
  if ! echo "$pick" | grep -qE '^[0-9]+$'; then
    local chk_http
    chk_http=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${USER}/${REPO}/git/ref/heads/${name}" \
      2>/dev/null)
    if [ "$chk_http" != "200" ]; then
      echo -e "${C_RED}✖ Branch '${name}' tidak ditemukan di GitHub.${C_RESET}"
      echo -e "  ${C_DIM}   Pastikan nama branch sudah benar dan sudah ada di remote.${C_RESET}"
      sleep 2
      return
    fi
  fi

  local new_default="$name"
  local old_default="$DEFAULT_BRANCH"

  echo ""
  mini_bar2_start "Ganti default branch ..." "Kirim PATCH ke GitHub API..." 0.05

  # Panggil GitHub API untuk benar-benar ganti default branch di remote
  local api_resp api_http
  api_resp=$(curl -s -o /tmp/_gh_switch.json -w "%{http_code}" \
    -X PATCH \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${USER}/${REPO}" \
    -d "{\"default_branch\":\"${new_default}\"}" 2>/dev/null)
  api_http="${api_resp}"

  if [ "$api_http" = "200" ]; then
    mini_bar2_ok "Default branch diubah" "${old_default} → ${new_default} ✓"
    # Sukses — update variabel lokal & simpan ke push.sh
    DEFAULT_BRANCH="$new_default"
    sed -i "s|^DEFAULT_BRANCH=.*|DEFAULT_BRANCH=\"${new_default}\"|" "$0" 2>/dev/null || true

    echo ""
    echo -e "  ${C_GREEN}✅ Default branch berhasil diubah di GitHub!${C_RESET}"
    echo -e "     ${C_DIM}${old_default}${C_RESET} ${C_BOLD}→${C_RESET} ${C_GREEN}${new_default}${C_RESET}"
    echo -e "  ${C_BLUE}🔗 https://github.com/${USER}/${REPO}${C_RESET}"
    echo -e "  ${C_DIM}Perubahan juga disimpan permanen di push.sh${C_RESET}"
    local _ts_sd; _ts_sd=$(date '+%H:%M:%S %d %b %Y')
    local _btn_sd='{"inline_keyboard":[[{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"},{"text":"🌿 Branches","url":"https://github.com/'"${USER}"'/'"${REPO}"'/branches"}],[{"text":"🔀 New PR","url":"https://github.com/'"${USER}"'/'"${REPO}"'/compare"},{"text":"📊 Compare","url":"https://github.com/'"${USER}"'/'"${REPO}"'/compare/'"${old_default}"'...'"${new_default}"'"}]]}'
    send_telegram_photo "https://w.wallhaven.cc/full/pk/wallhaven-pkgq8e.png" "🔀 <b>DEFAULT BRANCH DIUBAH</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🔄 <code>${old_default}</code> → <code>${new_default}</code>
🔗 github.com/${USER}/${REPO}
🕐 ${_ts_sd}" "$_btn_sd" 2>/dev/null &
  else
    # Gagal — tampilkan error dari API
    local api_msg
    api_msg=$(grep -o '"message":"[^"]*"' /tmp/_gh_switch.json 2>/dev/null | head -1 | sed 's/"message":"//;s/"//')
    mini_bar2_fail "Gagal HTTP ${api_http}" "${api_msg:-error dari GitHub API}"
    echo ""
    echo -e "  ${C_RED}❌ Gagal ubah default branch di GitHub (HTTP ${api_http})${C_RESET}"
    [ -n "$api_msg" ] && echo -e "  ${C_DIM}   GitHub: ${api_msg}${C_RESET}"
    echo -e "  ${C_DIM}   Pastikan token punya permission: repo (write access)${C_RESET}"
  fi

  rm -f /tmp/_gh_switch.json
  prompt_back_or_exit
}

# ===== Helper: format waktu relatif =====
_relative_time() {
  local ts="$1"
  local epoch_ts epoch_now diff
  epoch_ts=$(date -d "$ts" +%s 2>/dev/null \
    || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$ts" +%s 2>/dev/null \
    || echo "0")
  epoch_now=$(date +%s)
  [ "$epoch_ts" = "0" ] && echo "?" && return
  diff=$(( epoch_now - epoch_ts ))
  if   [ "$diff" -lt 60 ];     then echo "${diff}d lalu"
  elif [ "$diff" -lt 3600 ];   then echo "$(( diff / 60 ))m lalu"
  elif [ "$diff" -lt 86400 ];  then echo "$(( diff / 3600 ))j lalu"
  elif [ "$diff" -lt 172800 ]; then echo "kemarin"
  elif [ "$diff" -lt 604800 ]; then echo "$(( diff / 86400 ))h lalu"
  else echo "$(( diff / 604800 ))mg lalu"
  fi
}

# ===== Action: status semua branch (mirip halaman GitHub Branches) =====
action_list_branches() {
  local PAGE=1
  local PAGE_SIZE=8
  local TMP_LIST=/tmp/_gh_brlist_$$.json

  # ── Helper: header halaman status branch ────────────────────────────────
  _slb_header() {
    local _total="$1" _pg="$2" _tpg="$3"
    clear >/dev/tty 2>/dev/null || true
    echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
    echo -e "${C_BOLD}│   📊  STATUS BRANCH — BANG WILY  │${C_RESET}"
    echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
    echo ""
    echo -e "  ${C_DIM}repo  ${C_RESET}${C_BOLD}${USER}/${REPO}${C_RESET}"
    echo -e "  ${C_DIM}total ${C_RESET}${C_BOLD}${_total} branch${C_RESET}${C_DIM}  •  default: ${C_RESET}${C_GREEN}${DEFAULT_BRANCH}${C_RESET}"
    if [ "$_tpg" -gt 1 ]; then
      echo -e "  ${C_DIM}halaman ${C_RESET}${C_BOLD}${_pg}${C_DIM}/${_tpg}${C_RESET}"
    fi
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  }

  # ── Helper: relative time label ────────────────────────────────────────
  _slb_status_label() {
    local behind="$1" ahead="$2"
    if [ "$behind" = "?" ]; then
      printf "${C_DIM}  ···${C_RESET}"
    elif [ "$behind" = "0" ] && [ "$ahead" = "0" ]; then
      printf "${C_GREEN}  ✓ sinkron${C_RESET}"
    else
      local s=""
      [ "$behind" != "0" ] && s="${s}${C_RED}↓${behind}${C_RESET}"
      [ "$behind" != "0" ] && [ "$ahead" != "0" ] && s="${s} "
      [ "$ahead"  != "0" ] && s="${s}${C_CYAN}↑${ahead}${C_RESET}"
      printf "  %b" "$s"
    fi
  }

  # ════════════════════════════════════════════════════════════════════════
  # FASE 1 — Ambil semua branch + SHA
  # ════════════════════════════════════════════════════════════════════════
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   📊  STATUS BRANCH — BANG WILY  │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}repo  ${C_RESET}${C_BOLD}${USER}/${REPO}${C_RESET}"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  mini_bar_start "[1/3] Ambil daftar branch ..." 0.05

  local http_code
  http_code=$(curl -s -o "$TMP_LIST" -w "%{http_code}" \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${USER}/${REPO}/branches?per_page=100" 2>/dev/null)

  relogin_if_needed "$http_code" "ambil branch" || return
  if [ "$http_code" != "200" ]; then
    mini_bar_fail "HTTP ${http_code}"
    echo -e "  ${C_RED}❌ Gagal ambil branch list (HTTP ${http_code})${C_RESET}"
    rm -f "$TMP_LIST"
    prompt_back_or_exit
    return
  fi

  local all_names=() all_shas=()
  while IFS=$'\t' read -r _n _s; do
    all_names+=("$_n")
    all_shas+=("$_s")
  done < <(node -e "
    const d = require('fs').readFileSync('$TMP_LIST','utf8');
    JSON.parse(d).forEach(b => console.log(b.name + '\t' + b.commit.sha));
  " 2>/dev/null)
  rm -f "$TMP_LIST"

  if [ ${#all_names[@]} -eq 0 ]; then
    echo -e "  ${C_RED}❌ Tidak ada branch ditemukan.${C_RESET}"
    prompt_back_or_exit; return
  fi

  # ── Pisahkan default dari yang lain ────────────────────────────────────
  local def_sha=""
  local nd_names=() nd_shas=()
  for (( i=0; i<${#all_names[@]}; i++ )); do
    if [ "${all_names[$i]}" = "$DEFAULT_BRANCH" ]; then
      def_sha="${all_shas[$i]}"
    else
      nd_names+=("${all_names[$i]}")
      nd_shas+=("${all_shas[$i]}")
    fi
  done

  mini_bar_ok "${total_all} branch ditemukan"
  local total_all=$(( ${#nd_names[@]} + 1 ))

  # ════════════════════════════════════════════════════════════════════════
  # FASE 2 — Ambil tanggal commit semua branch secara PARALEL
  # ════════════════════════════════════════════════════════════════════════
  mini_bar_start "[2/3] Ambil tanggal commit (paralel) ..." 0.04

  local total_nd=${#nd_names[@]}
  local def_date="" def_rel="-" def_msg="-"

  if [ -n "$def_sha" ]; then
    curl -s -o "/tmp/_gh_d_def_$$.json" \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${USER}/${REPO}/git/commits/${def_sha}" 2>/dev/null &
  fi
  for (( i=0; i<total_nd; i++ )); do
    local sha="${nd_shas[$i]}"
    [ -z "$sha" ] && continue
    curl -s -o "/tmp/_gh_d_${i}_$$.json" \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${USER}/${REPO}/git/commits/${sha}" 2>/dev/null &
  done
  wait
  mini_bar_ok "Data commit siap"

  _slb_parse_date() {
    grep -oE '"date"[[:space:]]*:[[:space:]]*"[^"]*"' "$1" | head -1 \
      | grep -oE '"[0-9]{4}-[^"]*"' | tr -d '"'
  }
  _slb_parse_msg() {
    grep -oE '"message"[[:space:]]*:[[:space:]]*"[^"]*"' "$1" | head -1 \
      | sed 's/.*"message"[[:space:]]*:[[:space:]]*"//;s/"$//' | cut -c1-36
  }

  if [ -f "/tmp/_gh_d_def_$$.json" ]; then
    def_date=$(_slb_parse_date "/tmp/_gh_d_def_$$.json")
    def_msg=$(_slb_parse_msg  "/tmp/_gh_d_def_$$.json")
    rm -f "/tmp/_gh_d_def_$$.json"
    [ -n "$def_date" ] && def_rel=$(_relative_time "$def_date")
  fi

  local all_dated=()
  for (( i=0; i<total_nd; i++ )); do
    local fname="/tmp/_gh_d_${i}_$$.json"
    local bdate="" bmsg=""
    if [ -f "$fname" ]; then
      bdate=$(_slb_parse_date "$fname")
      bmsg=$(_slb_parse_msg  "$fname")
      rm -f "$fname"
    fi
    all_dated+=("${bdate:-0000-00-00T00:00:00Z}"$'\t'"${nd_names[$i]}"$'\t'"${nd_shas[$i]}"$'\t'"${bmsg}")
  done

  local sorted_dated=()
  while IFS= read -r line; do
    sorted_dated+=("$line")
  done < <(printf '%s\n' "${all_dated[@]}" | sort -r)

  nd_names=(); nd_shas=(); local nd_dates=() nd_msgs=()
  for entry in "${sorted_dated[@]}"; do
    local _d _n _s _m
    IFS=$'\t' read -r _d _n _s _m <<< "$entry"
    nd_names+=("$_n"); nd_shas+=("$_s")
    nd_dates+=("$_d"); nd_msgs+=("$_m")
  done

  local total_other=${#nd_names[@]}
  local total_pages=$(( (total_other + PAGE_SIZE - 1) / PAGE_SIZE ))
  [ "$total_pages" -eq 0 ] && total_pages=1

  echo -e "  ${C_DIM}▸ [3/3] Siap — ${total_all} branch ditemukan${C_RESET}"
  sleep 0.3

  # ════════════════════════════════════════════════════════════════════════
  # FASE 3 — Loop tampilan paginasi
  # ════════════════════════════════════════════════════════════════════════
  while true; do
    local start=$(( (PAGE - 1) * PAGE_SIZE ))
    local end=$(( start + PAGE_SIZE ))
    [ "$end" -gt "$total_other" ] && end="$total_other"

    # ── Loading sementara compare di-fetch ───────────────────────────────
    _slb_header "$total_all" "$PAGE" "$total_pages"
    echo -e "  ${C_GREEN}★${C_RESET} ${C_BOLD}${DEFAULT_BRANCH}${C_RESET}  ${C_DIM}${def_rel}${C_RESET}"
    echo -e "  ${C_DIM}  💬 ${def_msg}${C_RESET}"
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    echo -e "  ${C_DIM}▸ Mengambil status ahead/behind...${C_RESET}"

    # ── Fetch compare paralel untuk halaman ini ──────────────────────────
    local page_names=() page_dates=() page_behind=() page_ahead=() page_msgs=()
    local pids=()
    for (( idx=start; idx<end; idx++ )); do
      local b="${nd_names[$idx]}"
      local b_enc
      b_enc=$(printf '%s' "$b" | sed 's|/|%2F|g')
      page_names+=("$b")
      page_dates+=("${nd_dates[$idx]}")
      page_msgs+=("${nd_msgs[$idx]}")
      curl -s -o "/tmp/_gh_cmp_${idx}_$$.json" \
        -H "Authorization: token ${TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "https://api.github.com/repos/${USER}/${REPO}/compare/${DEFAULT_BRANCH}...${b_enc}?per_page=1" \
        2>/dev/null &
      pids+=("$!")
    done
    wait "${pids[@]}" 2>/dev/null || true

    for (( idx=start; idx<end; idx++ )); do
      local cfile="/tmp/_gh_cmp_${idx}_$$.json"
      local behind="" ahead=""
      if [ -f "$cfile" ]; then
        behind=$(grep -oE '"behind_by"[[:space:]]*:[[:space:]]*[0-9]+' "$cfile" | head -1 | grep -oE '[0-9]+$')
        ahead=$(grep -oE '"ahead_by"[[:space:]]*:[[:space:]]*[0-9]+'   "$cfile" | head -1 | grep -oE '[0-9]+$')
        rm -f "$cfile"
      fi
      page_behind+=("${behind:-?}")
      page_ahead+=("${ahead:-?}")
    done

    # ── Render final ─────────────────────────────────────────────────────
    _slb_header "$total_all" "$PAGE" "$total_pages"

    # Default branch row
    echo -e "  ${C_GREEN}★${C_RESET} ${C_BOLD}${DEFAULT_BRANCH}${C_RESET}  ${C_DIM}${def_rel}${C_RESET}  ${C_GREEN}(default)${C_RESET}"
    echo -e "  ${C_DIM}  💬 ${def_msg}${C_RESET}"
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"

    if [ "$total_other" -eq 0 ]; then
      echo -e "  ${C_DIM}Tidak ada branch lain.${C_RESET}"
    else
      for (( pi=0; pi<${#page_names[@]}; pi++ )); do
        local name="${page_names[$pi]}"
        local bdate="${page_dates[$pi]}"
        local bmsg="${page_msgs[$pi]}"
        local behind="${page_behind[$pi]}"
        local ahead="${page_ahead[$pi]}"
        local num=$(( start + pi + 1 ))

        # Relative time
        local rel="-"
        [[ "$bdate" != "0000"* ]] && [ -n "$bdate" ] && rel=$(_relative_time "$bdate")

        # Truncate nama buat display
        local disp="$name"
        [ ${#disp} -gt 22 ] && disp="${disp:0:21}…"

        # Warna nomor berdasarkan status
        local num_color="$C_CYAN"
        if [ "$behind" = "0" ] && [ "$ahead" = "0" ]; then
          num_color="$C_GREEN"
        elif [ "$behind" != "0" ] && [ "$behind" != "?" ]; then
          num_color="$C_RED"
        elif [ "$ahead" != "0" ] && [ "$ahead" != "?" ]; then
          num_color="$C_YELLOW"
        fi

        # Baris utama: nomor › nama  waktu  status
        printf "  ${num_color}%2d${C_RESET} ${C_BOLD}›${C_RESET} ${C_BOLD}%-23s${C_RESET} ${C_DIM}%-10s${C_RESET}" \
          "$num" "$disp" "$rel"
        _slb_status_label "$behind" "$ahead"
        echo ""

        # Baris pesan commit (dim, indent)
        if [ -n "$bmsg" ]; then
          echo -e "  ${C_DIM}       💬 ${bmsg}${C_RESET}"
        fi
      done
    fi

    # ── Navigasi ─────────────────────────────────────────────────────────
    echo ""
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    if [ "$total_pages" -gt 1 ]; then
      [ "$PAGE" -lt "$total_pages" ] && \
        echo -e "  ${C_CYAN} n${C_RESET} ${C_BOLD}›${C_RESET} Berikutnya     ${C_DIM}l › Halaman terakhir (${total_pages})${C_RESET}"
      [ "$PAGE" -gt 1 ] && \
        echo -e "  ${C_CYAN} p${C_RESET} ${C_BOLD}›${C_RESET} Sebelumnya     ${C_DIM}f › Halaman pertama${C_RESET}"
      echo -e "  ${C_DIM}  atau ketik nomor halaman (1–${total_pages})${C_RESET}"
    fi
    echo -e "  ${C_GREEN} r${C_RESET} ${C_BOLD}›${C_RESET} Refresh"
    echo -e "  ${C_RED} 0${C_RESET} ${C_BOLD}›${C_RESET} Kembali ke menu"
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    printf "  ${C_BOLD}▸ ${C_RESET}"

    local nav
    read -r nav
    nav=$(echo "$nav" | tr -d '\n\r ' | tr '[:upper:]' '[:lower:]')

    case "$nav" in
      n|next)   [ "$PAGE" -lt "$total_pages" ] && PAGE=$((PAGE + 1)) ;;
      p|prev)   [ "$PAGE" -gt 1 ]              && PAGE=$((PAGE - 1)) ;;
      f|first)  PAGE=1 ;;
      l|last)   PAGE=$total_pages ;;
      r|refresh) action_list_branches; return ;;
      0|q|exit) return ;;
      [0-9]*)
        if echo "$nav" | grep -qE '^[0-9]+$'; then
          local _sel_idx=$(( nav - 1 ))
          if [ "$_sel_idx" -ge 0 ] && [ "$_sel_idx" -lt "$total_other" ]; then
            # ── Detail branch yang dipilih ──────────────────────────────
            local _sel_name="${nd_names[$_sel_idx]}"
            local _sel_sha="${nd_shas[$_sel_idx]}"
            local _sel_date="${nd_dates[$_sel_idx]}"
            local _sel_msg="${nd_msgs[$_sel_idx]}"
            local _sel_rel="-"
            [[ "$_sel_date" != "0000"* ]] && [ -n "$_sel_date" ] && \
              _sel_rel=$(_relative_time "$_sel_date")

            # Hitung ahead/behind untuk branch ini
            local _sel_enc _sel_cmp _sel_behind="" _sel_ahead=""
            _sel_enc=$(printf '%s' "$_sel_name" | sed 's|/|%2F|g')
            _sel_cmp=$(curl -s \
              -H "Authorization: token ${TOKEN}" \
              -H "Accept: application/vnd.github+json" \
              -H "X-GitHub-Api-Version: 2022-11-28" \
              "https://api.github.com/repos/${USER}/${REPO}/compare/${DEFAULT_BRANCH}...${_sel_enc}?per_page=1" \
              2>/dev/null)
            _sel_behind=$(printf '%s' "$_sel_cmp" | grep -oE '"behind_by"[[:space:]]*:[[:space:]]*[0-9]+' | head -1 | grep -oE '[0-9]+$')
            _sel_ahead=$(printf '%s'  "$_sel_cmp" | grep -oE '"ahead_by"[[:space:]]*:[[:space:]]*[0-9]+'  | head -1 | grep -oE '[0-9]+$')
            _sel_behind="${_sel_behind:-?}"; _sel_ahead="${_sel_ahead:-?}"

            clear >/dev/tty 2>/dev/null || true
            echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
            echo -e "${C_BOLD}│   🔍  DETAIL BRANCH              │${C_RESET}"
            echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
            echo ""
            echo -e "  🌿 ${C_BOLD}${_sel_name}${C_RESET}"
            echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
            echo -e "  ${C_DIM}💬 ${_sel_msg}${C_RESET}"
            echo -e "  ${C_DIM}🕐 ${_sel_rel}  •  SHA: ${_sel_sha:0:7}${C_RESET}"
            # Status vs default
            if [ "$_sel_behind" = "0" ] && [ "$_sel_ahead" = "0" ]; then
              echo -e "  ${C_GREEN}✓ Sinkron dengan ${DEFAULT_BRANCH}${C_RESET}"
            else
              local _stline=""
              [ "$_sel_behind" != "0" ] && [ "$_sel_behind" != "?" ] && \
                _stline="${_stline}${C_RED}↓${_sel_behind} ketinggalan${C_RESET}  "
              [ "$_sel_ahead"  != "0" ] && [ "$_sel_ahead"  != "?" ] && \
                _stline="${_stline}${C_CYAN}↑${_sel_ahead} lebih baru${C_RESET}"
              echo -e "  ${_stline}vs ${C_DIM}${DEFAULT_BRANCH}${C_RESET}"
            fi
            echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
            echo ""
            echo -e "  ${C_GREEN} 1${C_RESET} ${C_BOLD}›${C_RESET} Push ke branch ini"
            echo -e "  ${C_BLUE} 2${C_RESET} ${C_BOLD}›${C_RESET} Lihat di GitHub"
            echo -e "  ${C_RED} 0${C_RESET} ${C_BOLD}›${C_RESET} Kembali ke daftar"
            echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
            printf "  ${C_BOLD}▸ ${C_RESET}"
            local det_nav
            read -r det_nav
            det_nav=$(echo "$det_nav" | tr -d '\n\r ')
            case "$det_nav" in
              1)
                # Push langsung ke branch yang dipilih
                SELECTED_BRANCHES=("$_sel_name")
                run_upload
                ;;
              2)
                local gh_url="https://github.com/${USER}/${REPO}/tree/${_sel_name}"
                if ! open_url "$gh_url"; then
                  echo -e "  ${C_DIM}URL: ${gh_url}${C_RESET}"
                  sleep 2
                fi
                ;;
            esac
          elif echo "$nav" | grep -qE '^[0-9]+$' && \
               [ "$nav" -ge 1 ] && [ "$nav" -le "$total_pages" ]; then
            PAGE="$nav"
          fi
        fi
        ;;
    esac
  done
}

# ===== Action: buat repository baru =====
action_create_repo() {
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   📦  BUAT REPOSITORY BARU       │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}akun  ${C_RESET}${C_BOLD}${USER}${C_RESET}"
  echo ""

  # ── 1) Nama repository ─────────────────────────────────────────────────
  echo -e "${C_DIM}  ── Nama Repository ─────────────────${C_RESET}"
  echo -e "  ${C_DIM}(hanya huruf, angka, - dan _  — tanpa spasi)${C_RESET}"
  echo -e "  ${C_DIM}0 › Kembali ke menu${C_RESET}"
  local new_repo_name=""
  while true; do
    printf "  ${C_BOLD}▸ ${C_RESET}"
    read -r new_repo_name
    new_repo_name=$(echo "$new_repo_name" | tr -d '\n\r')
    [ "$new_repo_name" = "0" ] && return
    if [ -z "$new_repo_name" ]; then
      echo -e "  ${C_RED}✖ Nama tidak boleh kosong.${C_RESET}"
    elif echo "$new_repo_name" | grep -qE '[^a-zA-Z0-9._-]'; then
      echo -e "  ${C_RED}✖ Nama mengandung karakter tidak valid.${C_RESET}"
    elif [ "${#new_repo_name}" -gt 100 ]; then
      echo -e "  ${C_RED}✖ Nama terlalu panjang (maks 100 karakter).${C_RESET}"
    else
      break
    fi
  done
  echo ""

  # ── 2) Deskripsi ────────────────────────────────────────────────────────
  echo -e "${C_DIM}  ── Deskripsi ${C_RESET}${C_DIM}(opsional, Enter untuk skip • 0 = kembali) ─${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local new_desc=""
  read -r new_desc
  new_desc=$(echo "$new_desc" | tr -d '\n\r')
  [ "$new_desc" = "0" ] && return
  echo ""

  # ── 3) Visibilitas ──────────────────────────────────────────────────────
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   📦  BUAT REPOSITORY BARU       │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}Nama: ${C_RESET}${C_BOLD}${new_repo_name}${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ── Visibilitas ──────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}1${C_RESET} ${C_BOLD}›${C_RESET} Private  ${C_DIM}(hanya kamu yang bisa akses)${C_RESET}"
  echo -e "  ${C_CYAN}2${C_RESET} ${C_BOLD}›${C_RESET} Public   ${C_DIM}(semua orang bisa lihat)${C_RESET}"
  echo -e "  ${C_DIM}0 › Kembali ke menu${C_RESET}"
  local vis_pick="" is_private=true vis_label="Private"
  while true; do
    printf "  ${C_BOLD}▸ ${C_RESET}"
    read -r vis_pick
    vis_pick=$(echo "$vis_pick" | tr -d '\n\r ')
    case "$vis_pick" in
      0) return ;;
      1|"") is_private=true;  vis_label="🔒 Private"; break ;;
      2)    is_private=false; vis_label="🌐 Public";  break ;;
      *) echo -e "  ${C_RED}✖ Ketik 1 atau 2.${C_RESET}" ;;
    esac
  done
  echo ""

  # ── 4) README ───────────────────────────────────────────────────────────
  echo -e "${C_DIM}  ── Add README ───────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}1${C_RESET} ${C_BOLD}›${C_RESET} Ya   ${C_DIM}(auto-init repo dengan README.md)${C_RESET}"
  echo -e "  ${C_CYAN}2${C_RESET} ${C_BOLD}›${C_RESET} Tidak"
  echo -e "  ${C_DIM}0 › Kembali ke menu${C_RESET}"
  local readme_pick="" auto_init=false readme_label="Tidak"
  while true; do
    printf "  ${C_BOLD}▸ ${C_RESET}"
    read -r readme_pick
    readme_pick=$(echo "$readme_pick" | tr -d '\n\r ')
    case "$readme_pick" in
      0) return ;;
      1|"") auto_init=true;  readme_label="Ya"; break ;;
      2)    auto_init=false; readme_label="Tidak"; break ;;
      *) echo -e "  ${C_RED}✖ Ketik 1 atau 2.${C_RESET}" ;;
    esac
  done
  echo ""

  # ── 5) .gitignore template ──────────────────────────────────────────────
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   📦  BUAT REPOSITORY BARU       │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}Nama: ${C_RESET}${C_BOLD}${new_repo_name}${C_RESET}  ${C_DIM}│ README: ${readme_label}${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ── .gitignore Template ──────────────${C_RESET}"
  echo -e "  ${C_DIM}0${C_RESET} › Tidak  ${C_CYAN}1${C_RESET} › Node  ${C_CYAN}2${C_RESET} › Python  ${C_CYAN}3${C_RESET} › Java"
  echo -e "  ${C_CYAN}4${C_RESET} › Go     ${C_CYAN}5${C_RESET} › Ruby  ${C_CYAN}6${C_RESET} › C++     ${C_CYAN}7${C_RESET} › Rust"
  echo -e "  ${C_DIM}b › Kembali ke menu${C_RESET}"
  local gi_pick="" gi_template="" gi_label="Tidak"
  # .gitignore hanya bisa dipakai jika auto_init=true
  if [ "$auto_init" = false ]; then
    echo -e "  ${C_DIM}(dilewati — README harus aktif untuk gitignore)${C_RESET}"
    gi_label="N/A"
  else
    while true; do
      printf "  ${C_BOLD}▸ ${C_RESET}"
      read -r gi_pick
      gi_pick=$(echo "$gi_pick" | tr -d '\n\r ')
      case "$gi_pick" in
        b|B) return ;;
        0|"") gi_template="";       gi_label="Tidak";  break ;;
        1)    gi_template="Node";   gi_label="Node";   break ;;
        2)    gi_template="Python"; gi_label="Python"; break ;;
        3)    gi_template="Java";   gi_label="Java";   break ;;
        4)    gi_template="Go";     gi_label="Go";     break ;;
        5)    gi_template="Ruby";   gi_label="Ruby";   break ;;
        6)    gi_template="C++";    gi_label="C++";    break ;;
        7)    gi_template="Rust";   gi_label="Rust";   break ;;
        *) echo -e "  ${C_RED}✖ Pilih 0–7.${C_RESET}" ;;
      esac
    done
  fi
  echo ""

  # ── 6) License ──────────────────────────────────────────────────────────
  echo -e "${C_DIM}  ── License ──────────────────────────${C_RESET}"
  echo -e "  ${C_DIM}0${C_RESET} › Tidak  ${C_CYAN}1${C_RESET} › MIT  ${C_CYAN}2${C_RESET} › Apache-2.0"
  echo -e "  ${C_CYAN}3${C_RESET} › GPL-3.0  ${C_CYAN}4${C_RESET} › LGPL-2.1  ${C_CYAN}5${C_RESET} › AGPL-3.0"
  echo -e "  ${C_DIM}b › Kembali ke menu${C_RESET}"
  local lic_pick="" lic_template="" lic_label="Tidak"
  if [ "$auto_init" = false ]; then
    echo -e "  ${C_DIM}(dilewati — README harus aktif untuk license)${C_RESET}"
    lic_label="N/A"
  else
    while true; do
      printf "  ${C_BOLD}▸ ${C_RESET}"
      read -r lic_pick
      lic_pick=$(echo "$lic_pick" | tr -d '\n\r ')
      case "$lic_pick" in
        b|B) return ;;
        0|"") lic_template="";           lic_label="Tidak";    break ;;
        1)    lic_template="mit";        lic_label="MIT";      break ;;
        2)    lic_template="apache-2.0"; lic_label="Apache-2.0"; break ;;
        3)    lic_template="gpl-3.0";   lic_label="GPL-3.0";  break ;;
        4)    lic_template="lgpl-2.1";  lic_label="LGPL-2.1"; break ;;
        5)    lic_template="agpl-3.0";  lic_label="AGPL-3.0"; break ;;
        *) echo -e "  ${C_RED}✖ Pilih 0–5.${C_RESET}" ;;
      esac
    done
  fi
  echo ""

  # ── Ringkasan konfirmasi ────────────────────────────────────────────────
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   📦  KONFIRMASI BUAT REPO        │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_DIM}Nama        ${C_RESET}${C_BOLD}%s${C_RESET}\n" "$new_repo_name"
  if [ -n "$new_desc" ]; then
    printf "  ${C_DIM}Deskripsi   ${C_RESET}%s\n" "$new_desc"
  else
    printf "  ${C_DIM}Deskripsi   ${C_RESET}${C_DIM}(kosong)${C_RESET}\n"
  fi
  printf "  ${C_DIM}Visibilitas ${C_RESET}%s\n"  "$vis_label"
  printf "  ${C_DIM}README      ${C_RESET}%s\n"  "$readme_label"
  printf "  ${C_DIM}Gitignore   ${C_RESET}%s\n"  "$gi_label"
  printf "  ${C_DIM}License     ${C_RESET}%s\n"  "$lic_label"
  printf "  ${C_DIM}URL nanti   ${C_RESET}${C_CYAN}github.com/%s/%s${C_RESET}\n" "$USER" "$new_repo_name"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo ""
  echo -e "  ${C_GREEN}y${C_RESET} ${C_BOLD}›${C_RESET} Buat sekarang"
  echo -e "  ${C_DIM}0 › Kembali ke menu${C_RESET}"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local confirm
  read -r confirm
  confirm=$(echo "$confirm" | tr -d '\n\r ' | tr '[:upper:]' '[:lower:]')
  if [ "$confirm" != "y" ]; then
    echo -e "  ${C_YELLOW}⚠️  Dibatalkan.${C_RESET}"
    sleep 1
    return
  fi

  # ── Bangun JSON payload ─────────────────────────────────────────────────
  # Escape karakter JSON-sensitive (backslash dulu, lalu kutip ganda)
  local name_json desc_json
  name_json=$(printf '%s' "$new_repo_name" | sed 's/\\/\\\\/g;s/"/\\"/g')
  desc_json=$(printf '%s' "$new_desc"      | sed 's/\\/\\\\/g;s/"/\\"/g')
  local payload="{\"name\":\"${name_json}\",\"description\":\"${desc_json}\",\"private\":${is_private},\"auto_init\":${auto_init}"
  [ -n "$gi_template"  ] && payload="${payload},\"gitignore_template\":\"${gi_template}\""
  [ -n "$lic_template" ] && payload="${payload},\"license_template\":\"${lic_template}\""
  payload="${payload}}"

  # ── Kirim ke GitHub API ─────────────────────────────────────────────────
  echo ""
  mini_bar2_start "Membuat repository di GitHub ..." "Kirim POST ke GitHub API..." 0.05

  local resp http_code
  resp=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "https://api.github.com/user/repos" 2>/dev/null)

  http_code=$(printf '%s' "$resp" | tail -1)
  relogin_if_needed "$http_code" "buat repo" || return
  if [ "$http_code" = "201" ]; then
    mini_bar2_ok "Repository dibuat" "${USER}/${new_repo_name} berhasil dibuat ✓"
  else
    local _cr_err
    _cr_err=$(printf '%s' "$resp" | sed '$d' | grep -oE '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"message"[[:space:]]*:[[:space:]]*"//;s/".*//')
    mini_bar2_fail "Gagal HTTP ${http_code}" "${_cr_err:-error dari GitHub API}"
  fi
  local body
  body=$(printf '%s' "$resp" | sed '$d')

  # ── Tampilkan hasil ─────────────────────────────────────────────────────
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   📦  BUAT REPOSITORY BARU       │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""

  if [ "$http_code" = "201" ]; then
    # Ekstrak info dari response
    local clone_url html_url full_name visibility
    clone_url=$(printf '%s' "$body" | grep -oE '"clone_url"[[:space:]]*:[[:space:]]*"[^"]*"' \
                | head -1 | sed 's/.*"clone_url"[[:space:]]*:[[:space:]]*"//;s/".*//')
    html_url=$(printf '%s' "$body" | grep -oE '"html_url"[[:space:]]*:[[:space:]]*"https://github.com/[^"]*"' \
               | head -1 | sed 's/.*"html_url"[[:space:]]*:[[:space:]]*"//;s/".*//')
    full_name=$(printf '%s' "$body" | grep -oE '"full_name"[[:space:]]*:[[:space:]]*"[^"]*"' \
                | head -1 | sed 's/.*"full_name"[[:space:]]*:[[:space:]]*"//;s/".*//')

    echo -e "  ${C_GREEN}✅ Repository berhasil dibuat!${C_RESET}"
    echo ""
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    printf "  ${C_DIM}Nama    ${C_RESET}${C_BOLD}%s${C_RESET}\n"       "${full_name:-${USER}/${new_repo_name}}"
    printf "  ${C_DIM}Visib.  ${C_RESET}%s\n"                           "$vis_label"
    printf "  ${C_DIM}URL     ${C_RESET}${C_CYAN}%s${C_RESET}\n"       "${html_url:-https://github.com/${USER}/${new_repo_name}}"
    printf "  ${C_DIM}Clone   ${C_RESET}${C_DIM}%s${C_RESET}\n"        "${clone_url:-https://github.com/${USER}/${new_repo_name}.git}"
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    echo ""
    echo -e "  ${C_DIM}▸ Clone dengan:${C_RESET}"
    echo -e "  ${C_BOLD}git clone ${clone_url:-https://github.com/${USER}/${new_repo_name}.git}${C_RESET}"
    local _ts_cr; _ts_cr=$(date '+%H:%M:%S %d %b %Y')
    local _btn_cr='{"inline_keyboard":[[{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${new_repo_name}"'"},{"text":"⚙️ Settings","url":"https://github.com/'"${USER}"'/'"${new_repo_name}"'/settings"}],[{"text":"📋 Issues","url":"https://github.com/'"${USER}"'/'"${new_repo_name}"'/issues"},{"text":"🌿 Branches","url":"https://github.com/'"${USER}"'/'"${new_repo_name}"'/branches"}]]}'
    send_telegram_photo "https://w.wallhaven.cc/full/rd/wallhaven-rd5vz1.jpg" "📦 <b>REPO BARU DIBUAT</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${USER}</code>
📁 <code>${full_name:-${USER}/${new_repo_name}}</code>
🔒 ${vis_label}
🔗 ${html_url:-github.com/${USER}/${new_repo_name}}
🕐 ${_ts_cr}" "$_btn_cr" 2>/dev/null &
  else
    # Ekstrak pesan error dari GitHub
    local err_msg
    err_msg=$(printf '%s' "$body" | grep -oE '"message"[[:space:]]*:[[:space:]]*"[^"]*"' \
              | head -1 | sed 's/.*"message"[[:space:]]*:[[:space:]]*"//;s/".*//')
    echo -e "  ${C_RED}❌ Gagal membuat repository (HTTP ${http_code})${C_RESET}"
    [ -n "$err_msg" ] && echo -e "  ${C_RED}   ${err_msg}${C_RESET}"
    echo ""
    if [ "$http_code" = "422" ]; then
      echo -e "  ${C_YELLOW}💡 Kemungkinan nama repo sudah dipakai.${C_RESET}"
    elif [ "$http_code" = "401" ]; then
      echo -e "  ${C_YELLOW}💡 Token tidak valid atau sudah expired.${C_RESET}"
    elif [ "$http_code" = "403" ]; then
      echo -e "  ${C_YELLOW}💡 Token tidak punya izin membuat repo.${C_RESET}"
      echo -e "  ${C_DIM}   Cek scope token: butuh 'repo' atau 'public_repo'.${C_RESET}"
    fi
  fi

  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  ${C_DIM}0 atau Enter › Kembali ke menu${C_RESET}"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local _r; read -r _r
  clear >/dev/tty 2>/dev/null || true
}

# ===== Action: import repository dari URL eksternal =====
action_import_repo() {
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   📥  IMPORT REPOSITORY           │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}Impor project dari Git URL ke GitHub.${C_RESET}"
  echo -e "  ${C_DIM}(Support: Git • SVN/TFVC tidak didukung lagi)${C_RESET}"
  echo ""

  # ── 1) Source URL ───────────────────────────────────────────────────────
  echo -e "${C_DIM}  ── URL Sumber ${C_RESET}${C_DIM}* wajib ─────────────────${C_RESET}"
  echo -e "  ${C_DIM}Contoh: https://github.com/user/repo.git${C_RESET}"
  echo -e "  ${C_DIM}        https://gitlab.com/user/repo.git${C_RESET}"
  echo -e "  ${C_DIM}0 › Kembali ke menu${C_RESET}"
  local src_url=""
  while true; do
    printf "  ${C_BOLD}▸ ${C_RESET}"
    read -r src_url
    src_url=$(echo "$src_url" | tr -d '\n\r ')
    [ "$src_url" = "0" ] && return
    if [ -z "$src_url" ]; then
      echo -e "  ${C_RED}✖ URL tidak boleh kosong.${C_RESET}"
    elif ! echo "$src_url" | grep -qE '^https?://'; then
      echo -e "  ${C_RED}✖ URL harus diawali http:// atau https://${C_RESET}"
    else
      break
    fi
  done
  echo ""

  # ── 2) Username sumber (opsional) ───────────────────────────────────────
  echo -e "${C_DIM}  ── Username Sumber ${C_RESET}${C_DIM}(opsional, Enter = skip • 0 = kembali) ─${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local src_user=""
  read -r src_user
  src_user=$(echo "$src_user" | tr -d '\n\r')
  [ "$src_user" = "0" ] && return
  echo ""

  # ── 3) Password / Token sumber (opsional) ───────────────────────────────
  local src_pass=""
  if [ -n "$src_user" ]; then
    echo -e "${C_DIM}  ── Password / Token Sumber ──────────${C_RESET}"
    echo -e "  ${C_DIM}(input tersembunyi • Enter kosong = skip)${C_RESET}"
    printf "  ${C_BOLD}▸ ${C_RESET}"
    read -rs src_pass
    src_pass=$(echo "$src_pass" | tr -d '\n\r')
    echo ""
    echo ""
  fi

  # ── 4) Nama repository baru ─────────────────────────────────────────────
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   📥  IMPORT REPOSITORY           │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}Sumber: ${C_RESET}${C_CYAN}${src_url}${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ── Nama Repository Baru ${C_RESET}${C_DIM}* wajib ────────${C_RESET}"
  echo -e "  ${C_DIM}(hanya huruf, angka, - dan _)${C_RESET}"
  echo -e "  ${C_DIM}0 › Kembali ke menu${C_RESET}"
  # Auto-suggest dari URL
  local url_guess
  url_guess=$(printf '%s' "$src_url" | sed 's|.*/||;s|\.git$||;s|[^a-zA-Z0-9._-]|-|g')
  [ -n "$url_guess" ] && echo -e "  ${C_DIM}Saran: ${url_guess}${C_RESET}"
  local imp_repo_name=""
  while true; do
    printf "  ${C_BOLD}▸ ${C_RESET}"
    read -r imp_repo_name
    imp_repo_name=$(echo "$imp_repo_name" | tr -d '\n\r')
    [ "$imp_repo_name" = "0" ] && return
    [ -z "$imp_repo_name" ] && [ -n "$url_guess" ] && imp_repo_name="$url_guess"
    if [ -z "$imp_repo_name" ]; then
      echo -e "  ${C_RED}✖ Nama tidak boleh kosong.${C_RESET}"
    elif echo "$imp_repo_name" | grep -qE '[^a-zA-Z0-9._-]'; then
      echo -e "  ${C_RED}✖ Karakter tidak valid (hanya huruf/angka/-/_).${C_RESET}"
    elif [ "${#imp_repo_name}" -gt 100 ]; then
      echo -e "  ${C_RED}✖ Nama terlalu panjang.${C_RESET}"
    else
      break
    fi
  done
  echo ""

  # ── 5) Visibilitas ──────────────────────────────────────────────────────
  echo -e "${C_DIM}  ── Visibilitas ──────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}1${C_RESET} ${C_BOLD}›${C_RESET} Public   ${C_DIM}(semua bisa lihat)${C_RESET}"
  echo -e "  ${C_CYAN}2${C_RESET} ${C_BOLD}›${C_RESET} Private  ${C_DIM}(hanya kamu)${C_RESET}"
  echo -e "  ${C_DIM}0 › Kembali ke menu${C_RESET}"
  local imp_vis_pick="" imp_private=false imp_vis_label="🌐 Public"
  while true; do
    printf "  ${C_BOLD}▸ ${C_RESET}"
    read -r imp_vis_pick
    imp_vis_pick=$(echo "$imp_vis_pick" | tr -d '\n\r ')
    case "$imp_vis_pick" in
      0) return ;;
      1|"") imp_private=false; imp_vis_label="🌐 Public";  break ;;
      2)    imp_private=true;  imp_vis_label="🔒 Private"; break ;;
      *) echo -e "  ${C_RED}✖ Ketik 1 atau 2.${C_RESET}" ;;
    esac
  done
  echo ""

  # ── Konfirmasi ──────────────────────────────────────────────────────────
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   📥  KONFIRMASI IMPORT           │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_DIM}Sumber      ${C_RESET}${C_CYAN}%s${C_RESET}\n"  "$src_url"
  if [ -n "$src_user" ]; then
    printf "  ${C_DIM}Username    ${C_RESET}%s\n"                   "$src_user"
    printf "  ${C_DIM}Password    ${C_RESET}${C_DIM}%s${C_RESET}\n" "(tersembunyi)"
  else
    printf "  ${C_DIM}Kredensial  ${C_RESET}${C_DIM}tidak dipakai${C_RESET}\n"
  fi
  printf "  ${C_DIM}Repo baru   ${C_RESET}${C_BOLD}%s/%s${C_RESET}\n" "$USER" "$imp_repo_name"
  printf "  ${C_DIM}Visibilitas ${C_RESET}%s\n"                        "$imp_vis_label"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo ""
  echo -e "  ${C_GREEN}y${C_RESET} ${C_BOLD}›${C_RESET} Mulai import"
  echo -e "  ${C_RED}0${C_RESET} ${C_BOLD}›${C_RESET} Kembali ke menu"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local imp_confirm
  read -r imp_confirm
  imp_confirm=$(echo "$imp_confirm" | tr -d '\n\r ' | tr '[:upper:]' '[:lower:]')
  if [ "$imp_confirm" != "y" ]; then
    clear >/dev/tty 2>/dev/null || true
    return
  fi

  # ── Langkah 1: Buat repo kosong dulu ────────────────────────────────────
  echo ""
  mini_bar2_start "[1/2] Membuat repo kosong ..." "Kirim POST ke GitHub API..." 0.05
  local create_resp create_code
  local name_esc
  name_esc=$(printf '%s' "$imp_repo_name" | sed 's/\\/\\\\/g;s/"/\\"/g')
  local create_payload="{\"name\":\"${name_esc}\",\"private\":${imp_private},\"auto_init\":false}"

  create_resp=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "Content-Type: application/json" \
    -d "$create_payload" \
    "https://api.github.com/user/repos" 2>/dev/null)
  create_code=$(printf '%s' "$create_resp" | tail -1)
  local create_body
  create_body=$(printf '%s' "$create_resp" | sed '$d')

  relogin_if_needed "$create_code" "buat repo import" || return
  if [ "$create_code" = "201" ]; then
    mini_bar2_ok "Repo kosong dibuat" "${USER}/${imp_repo_name} siap untuk import ✓"
  else
    local _ic_err
    _ic_err=$(printf '%s' "$create_body" | grep -oE '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"message"[[:space:]]*:[[:space:]]*"//;s/".*//')
    mini_bar2_fail "Gagal buat repo HTTP ${create_code}" "${_ic_err:-error dari GitHub API}"
  fi
  if [ "$create_code" != "201" ]; then
    local cerr
    cerr=$(printf '%s' "$create_body" \
      | grep -oE '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
      | sed 's/.*"message"[[:space:]]*:[[:space:]]*"//;s/".*//')
    echo -e "  ${C_RED}❌ Gagal buat repo (HTTP ${create_code})${C_RESET}"
    [ -n "$cerr" ] && echo -e "  ${C_RED}   ${cerr}${C_RESET}"
    [ "$create_code" = "422" ] && \
      echo -e "  ${C_YELLOW}💡 Nama repo sudah dipakai di akun kamu.${C_RESET}"
    echo ""
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    echo -e "  ${C_DIM}0 atau Enter › Kembali ke menu${C_RESET}"
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    printf "  ${C_BOLD}▸ ${C_RESET}"; local _r; read -r _r
    clear >/dev/tty 2>/dev/null || true; return
  fi

  # ── Langkah 2: Mulai import ──────────────────────────────────────────────
  mini_bar2_start "[2/2] Memulai import dari sumber ..." "Kirim PUT ke GitHub Importer API..." 0.05

  # Bangun payload import
  local src_url_esc
  src_url_esc=$(printf '%s' "$src_url" | sed 's/\\/\\\\/g;s/"/\\"/g')
  local imp_payload="{\"vcs\":\"git\",\"vcs_url\":\"${src_url_esc}\""
  if [ -n "$src_user" ]; then
    local su_esc sp_esc
    su_esc=$(printf '%s' "$src_user" | sed 's/\\/\\\\/g;s/"/\\"/g')
    sp_esc=$(printf '%s' "$src_pass" | sed 's/\\/\\\\/g;s/"/\\"/g')
    imp_payload="${imp_payload},\"vcs_username\":\"${su_esc}\",\"vcs_password\":\"${sp_esc}\""
  fi
  imp_payload="${imp_payload}}"

  local imp_resp imp_code
  imp_resp=$(curl -s -w "\n%{http_code}" \
    -X PUT \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    -H "Content-Type: application/json" \
    -d "$imp_payload" \
    "https://api.github.com/repos/${USER}/${imp_repo_name}/import" 2>/dev/null)
  imp_code=$(printf '%s' "$imp_resp" | tail -1)
  local imp_body
  imp_body=$(printf '%s' "$imp_resp" | sed '$d')

  relogin_if_needed "$imp_code" "mulai import" || return
  if [ "$imp_code" = "201" ]; then
    mini_bar2_ok "Import dimulai" "Proses berjalan di background GitHub ✓"
  else
    local _ii_err
    _ii_err=$(printf '%s' "$imp_body" | grep -oE '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"message"[[:space:]]*:[[:space:]]*"//;s/".*//')
    mini_bar2_fail "Gagal mulai import HTTP ${imp_code}" "${_ii_err:-error dari GitHub API}"
  fi

  # ── Tampilkan status awal + polling ─────────────────────────────────────
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   📥  IMPORT REPOSITORY           │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""

  if [ "$imp_code" = "201" ]; then
    local imp_status imp_text
    imp_status=$(printf '%s' "$imp_body" \
      | grep -oE '"status"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
      | sed 's/.*"status"[[:space:]]*:[[:space:]]*"//;s/".*//')
    imp_text=$(printf '%s' "$imp_body" \
      | grep -oE '"status_text"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
      | sed 's/.*"status_text"[[:space:]]*:[[:space:]]*"//;s/".*//')

    echo -e "  ${C_GREEN}✅ Import dimulai!${C_RESET}"
    echo ""
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    printf "  ${C_DIM}Repo     ${C_RESET}${C_BOLD}%s/%s${C_RESET}\n"  "$USER" "$imp_repo_name"
    printf "  ${C_DIM}Sumber   ${C_RESET}${C_CYAN}%s${C_RESET}\n"      "$src_url"
    printf "  ${C_DIM}Status   ${C_RESET}${C_YELLOW}%s${C_RESET}\n"    "${imp_status:-importing}"
    [ -n "$imp_text" ] && \
      printf "  ${C_DIM}Info     ${C_RESET}%s\n" "$imp_text"
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    local _ts_ir; _ts_ir=$(date '+%H:%M:%S %d %b %Y')
    local _btn_ir='{"inline_keyboard":[[{"text":"📁 Lihat Repo","url":"https://github.com/'"${USER}"'/'"${imp_repo_name}"'"},{"text":"📊 Status Import","url":"https://github.com/'"${USER}"'/'"${imp_repo_name}"'"}],[{"text":"⚙️ Settings","url":"https://github.com/'"${USER}"'/'"${imp_repo_name}"'/settings"},{"text":"📋 Issues","url":"https://github.com/'"${USER}"'/'"${imp_repo_name}"'/issues"}]]}'
    send_telegram_photo "https://w.wallhaven.cc/full/rd/wallhaven-rdxk2j.jpg" "📥 <b>IMPORT REPO DIMULAI</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${USER}</code>
📁 Repo baru: <code>${USER}/${imp_repo_name}</code>
🔗 Sumber: <code>${src_url}</code>
⏳ ${imp_status:-importing}
🕐 ${_ts_ir}" "$_btn_ir" 2>/dev/null &
    echo ""
    echo -e "  ${C_DIM}Memantau progress import...${C_RESET}"
    echo -e "  ${C_DIM}(Ctrl+C untuk berhenti pantau, import tetap berjalan di GitHub)${C_RESET}"
    echo ""
    # ── Polling real-time dengan animasi bar ─────────────────────────────
    local _poll_sf; _poll_sf=$(mktemp)
    local _poll_pf; _poll_pf=$(mktemp)
    printf "Memulai import..." > "$_poll_sf"
    printf "0"                 > "$_poll_pf"
    local _poll_bw=22

    # Background: spinner + bar animasi terus, baca status dari temp file
    {
      local _psi=0
      local _pspin=(⠋ ⠙ ⠹ ⠸ ⠼ ⠴ ⠦ ⠧ ⠇ ⠏)
      printf "\n" >/dev/tty 2>/dev/null
      while true; do
        local _ppct _pst _pbf="" _pbe="" _pj=0
        _ppct=$(cat "$_poll_pf" 2>/dev/null); echo "$_ppct" | grep -qE '^[0-9]+$' || _ppct=0
        _pst=$(tr -d '\n' < "$_poll_sf" 2>/dev/null | cut -c1-50)
        local _pf=$(( _ppct * _poll_bw / 100 ))
        while [ $_pj -lt $_pf ];       do _pbf="${_pbf}█"; _pj=$(( _pj+1 )); done
        while [ $_pj -lt $_poll_bw ]; do _pbe="${_pbe}░"; _pj=$(( _pj+1 )); done
        local _psp="${_pspin[$(( _psi % 10 ))]}"
        printf "\033[2A\r\033[K  [\033[36m%s\033[0m\033[2m%s\033[0m] \033[1;36m%3d%%\033[0m  \033[2mImport berjalan...\033[0m\n\033[K  \033[36m%s\033[0m \033[2m%s\033[0m\n" \
          "$_pbf" "$_pbe" "$_ppct" "$_psp" "$_pst" >/dev/tty 2>/dev/null
        _psi=$(( _psi + 1 ))
        sleep 0.15
      done
    } &
    local _poll_spin_pid=$!

    local poll_count=0 poll_max=75   # 75 × 4s = 5 menit
    local _poll_final="" poll_text="" poll_status=""
    while [ "$poll_count" -lt "$poll_max" ]; do
      sleep 4
      poll_count=$(( poll_count + 1 ))
      local poll_raw poll_pct
      poll_raw=$(curl -s \
        -H "Authorization: token ${TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        "https://api.github.com/repos/${USER}/${imp_repo_name}/import" 2>/dev/null)
      poll_status=$(printf '%s' "$poll_raw" \
        | grep -oE '"status"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
        | sed 's/.*"status"[[:space:]]*:[[:space:]]*"//;s/".*//')
      poll_text=$(printf '%s' "$poll_raw" \
        | grep -oE '"status_text"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
        | sed 's/.*"status_text"[[:space:]]*:[[:space:]]*"//;s/".*//')
      poll_pct=$(printf '%s' "$poll_raw" \
        | grep -oE '"percent"[[:space:]]*:[[:space:]]*[0-9]+' | head -1 \
        | grep -oE '[0-9]+$')

      # Update file untuk spinner
      printf '%s' "${poll_text:-${poll_status:-importing}}" > "$_poll_sf"
      [ -n "$poll_pct" ] && printf '%s' "$poll_pct" > "$_poll_pf"

      case "$poll_status" in
        complete)
          _poll_final="complete"; break ;;
        error|authentication_failed|error_stash_import|auth_failed)
          _poll_final="$poll_status"; break ;;
      esac
    done

    # Hentikan spinner background
    kill "$_poll_spin_pid" 2>/dev/null; wait "$_poll_spin_pid" 2>/dev/null

    # Gambar state akhir in-place
    if [ "$_poll_final" = "complete" ]; then
      local _pfull="" _pj2=0
      while [ $_pj2 -lt $_poll_bw ]; do _pfull="${_pfull}█"; _pj2=$(( _pj2+1 )); done
      printf "\033[2A\r\033[K  [\033[32m%s\033[0m] \033[1;32m100%%\033[0m  \033[32m✅ Import selesai!\033[0m\n\033[K  \033[32m   https://github.com/%s/%s\033[0m\n" \
        "$_pfull" "$USER" "$imp_repo_name" >/dev/tty 2>/dev/null
      echo ""
      local _ts_ir2; _ts_ir2=$(date '+%H:%M:%S %d %b %Y')
      local _btn_ir2='{"inline_keyboard":[[{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${imp_repo_name}"'"},{"text":"📋 Issues","url":"https://github.com/'"${USER}"'/'"${imp_repo_name}"'/issues"}],[{"text":"🌿 Branches","url":"https://github.com/'"${USER}"'/'"${imp_repo_name}"'/branches"},{"text":"📊 Commits","url":"https://github.com/'"${USER}"'/'"${imp_repo_name}"'/commits"}]]}'
      send_telegram_photo "https://cdn.myanimelist.net/images/anime/1517/100633.jpg" "📥 <b>IMPORT REPO SELESAI</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${USER}</code>
📁 <code>${USER}/${imp_repo_name}</code>
🔗 github.com/${USER}/${imp_repo_name}
✅ Import berhasil 100%
🕐 ${_ts_ir2}" "$_btn_ir2" 2>/dev/null &
    elif [ -n "$_poll_final" ]; then
      local _phalf="" _phbe="" _pj3=0
      while [ $_pj3 -lt $(( _poll_bw * 9 / 10 )) ]; do _phalf="${_phalf}▒"; _pj3=$(( _pj3+1 )); done
      while [ $_pj3 -lt $_poll_bw ]; do _phbe="${_phbe}░"; _pj3=$(( _pj3+1 )); done
      printf "\033[2A\r\033[K  [\033[31m%s\033[0m\033[2m%s\033[0m] \033[1;31m ERR\033[0m  \033[31m❌ Import gagal: %s\033[0m\n\033[K  \033[31m   %s\033[0m\n" \
        "$_phalf" "$_phbe" "$_poll_final" "${poll_text:-cek repo di GitHub}" >/dev/tty 2>/dev/null
      echo ""
      [ "$_poll_final" = "auth_failed" ] || [ "$_poll_final" = "authentication_failed" ] && \
        echo -e "  ${C_YELLOW}💡 Coba lagi dengan username/password sumber yang benar.${C_RESET}"
    else
      # Timeout — import masih jalan tapi pantau dihentikan
      local _ptpct; _ptpct=$(cat "$_poll_pf" 2>/dev/null || echo "0")
      echo "$_ptpct" | grep -qE '^[0-9]+$' || _ptpct=0
      local _ptbf="" _ptbe="" _ptj=0
      local _ptf=$(( _ptpct * _poll_bw / 100 ))
      while [ $_ptj -lt $_ptf ];       do _ptbf="${_ptbf}█"; _ptj=$(( _ptj+1 )); done
      while [ $_ptj -lt $_poll_bw ]; do _ptbe="${_ptbe}░"; _ptj=$(( _ptj+1 )); done
      printf "\033[2A\r\033[K  [\033[33m%s\033[0m\033[2m%s\033[0m] \033[1;33m%3d%%\033[0m  \033[33m⚠️  Timeout pantau (5 menit)\033[0m\n\033[K  \033[33m   Cek manual: github.com/%s/%s\033[0m\n" \
        "$_ptbf" "$_ptbe" "$_ptpct" "$USER" "$imp_repo_name" >/dev/tty 2>/dev/null
      echo ""
    fi
    rm -f "$_poll_sf" "$_poll_pf" 2>/dev/null
  else
    local ierr
    ierr=$(printf '%s' "$imp_body" \
      | grep -oE '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
      | sed 's/.*"message"[[:space:]]*:[[:space:]]*"//;s/".*//')
    echo -e "  ${C_RED}❌ Gagal memulai import (HTTP ${imp_code})${C_RESET}"
    [ -n "$ierr" ] && echo -e "  ${C_RED}   ${ierr}${C_RESET}"
    echo ""
    echo -e "  ${C_DIM}Repo ${USER}/${imp_repo_name} sudah dibuat tapi kosong.${C_RESET}"
    echo -e "  ${C_DIM}Kamu bisa hapus manual di GitHub atau coba import lagi.${C_RESET}"
  fi

  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  ${C_DIM}0 atau Enter › Kembali ke menu${C_RESET}"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local _r; read -r _r
  clear >/dev/tty 2>/dev/null || true
}

# ── Helper: format ISO date → tanggal Indonesia ──────────────────────────
_del_fmt_date() {
  local iso="$1"
  [ -z "$iso" ] && echo "-" && return
  local dt="${iso%T*}"
  local yr="${dt%%-*}"; local rest="${dt#*-}"; local mo="${rest%%-*}"; local dy="${rest##*-}"
  local bulan
  case "$mo" in
    01) bulan="Januari";;   02) bulan="Februari";; 03) bulan="Maret";;
    04) bulan="April";;     05) bulan="Mei";;       06) bulan="Juni";;
    07) bulan="Juli";;      08) bulan="Agustus";;   09) bulan="September";;
    10) bulan="Oktober";;   11) bulan="November";; 12) bulan="Desember";;
    *)  bulan="$mo";;
  esac
  local timep="${iso#*T}"; local hh="${timep%%:*}"; local timep2="${timep#*:}"; local mm="${timep2%%:*}"
  echo "${dy} ${bulan} ${yr}, ${hh}:${mm} WIB"
}

# ── Helper: format ukuran KB → human readable ────────────────────────────
_del_fmt_size() {
  local sz="$1"
  ( [ -z "$sz" ] || [ "$sz" = "0" ] ) && echo "< 1 KB" && return
  if [ "$sz" -ge 1024 ]; then
    echo "$(( sz / 1024 )) MB"
  else
    echo "${sz} KB"
  fi
}

# ── Helper: gambar layar peringatan hapus (dipanggil tiap detik) ──────────
_draw_del_warn() {
  # Args: del_repo repo_full vis_label repo_private repo_lang repo_branch
  #       repo_desc repo_stars repo_forks repo_issues repo_watch repo_size
  #       repo_created repo_updated repo_pushed attempt max_attempt
  local _dr="$1" _rf="$2" _vl="$3" _rpr="$4" _rl="$5" _rb="$6"
  local _rd="$7" _rst="$8" _rfk="$9" _ri="${10}" _rw="${11}" _rsz="${12}"
  local _rcr="${13}" _rup="${14}" _rpu="${15}" _att="${16}" _max="${17}"

  # Real-time clock
  local _HARI=("" "Minggu" "Senin" "Selasa" "Rabu" "Kamis" "Jumat" "Sabtu")
  local _BULAN=("" "Januari" "Februari" "Maret" "April" "Mei" "Juni"
                "Juli" "Agustus" "September" "Oktober" "November" "Desember")
  local _dow; _dow=$(date +%u)                   # 1=Mon..7=Sun
  local _hname="${_HARI[$(( _dow % 7 + 1 ))]}"
  local _mo_idx; _mo_idx=$(( 10#$(date +%m) ))
  local _mname="${_BULAN[$_mo_idx]}"
  local _clock; _clock=$(date '+%H:%M:%S')
  local _datef; _datef=$(date '+%d')
  local _yr; _yr=$(date '+%Y')

  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭────────────────────────────────────────────────╮${C_RESET}"
  echo -e "${C_RED}${C_BOLD}│   ⚠️   PERINGATAN HAPUS REPOSITORY             │${C_RESET}"
  echo -e "${C_BOLD}╰────────────────────────────────────────────────╯${C_RESET}"
  echo ""
  # Real-time clock
  echo -e "  🕐 ${C_BOLD}${_hname}, ${_datef} ${_mname} ${_yr} — ${_clock} WIB${C_RESET}"
  echo ""
  echo -e "  ${C_RED}${C_BOLD}Tindakan ini PERMANEN dan tidak bisa dibatalkan!${C_RESET}"
  echo -e "  ${C_RED}Semua kode, branch, history, issue & PR akan hilang.${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ────────────────────────────────────────────────${C_RESET}"
  printf "  ${C_DIM}Repository   ${C_RESET}${C_BOLD}${C_RED}%s${C_RESET}\n"     "${_rf}"
  printf "  ${C_DIM}Visibilitas  ${C_RESET}%s\n"                                "${_vl}"
  [ -n "$_rl"  ] && printf "  ${C_DIM}Bahasa       ${C_RESET}%s\n"             "${_rl}"
  [ -n "$_rb"  ] && printf "  ${C_DIM}Branch utama ${C_RESET}%s\n"             "${_rb}"
  [ -n "$_rd"  ] && printf "  ${C_DIM}Deskripsi    ${C_RESET}%s\n"             "${_rd}"
  echo ""
  printf "  ${C_DIM}⭐ Bintang    ${C_RESET}${C_YELLOW}%s${C_RESET}\n"         "${_rst:-0}"
  printf "  ${C_DIM}🍴 Fork       ${C_RESET}%s\n"                              "${_rfk:-0}"
  printf "  ${C_DIM}🐛 Issue buka ${C_RESET}%s\n"                              "${_ri:-0}"
  printf "  ${C_DIM}👁️  Watcher   ${C_RESET}%s\n"                              "${_rw:-0}"
  printf "  ${C_DIM}💾 Ukuran     ${C_RESET}%s\n"                              "$(_del_fmt_size "$_rsz")"
  echo ""
  printf "  ${C_DIM}📅 Dibuat     ${C_RESET}%s\n"  "$(_del_fmt_date "$_rcr")"
  printf "  ${C_DIM}🔄 Diupdate   ${C_RESET}%s\n"  "$(_del_fmt_date "$_rup")"
  printf "  ${C_DIM}🚀 Dipush     ${C_RESET}%s\n"  "$(_del_fmt_date "$_rpu")"
  echo -e "${C_DIM}  ────────────────────────────────────────────────${C_RESET}"
  echo ""
  # Status percobaan
  local _left=$(( _max - _att ))
  echo -e "  ${C_YELLOW}Ketik ulang nama repository untuk menghapus:${C_RESET}"
  echo -e "  ${C_BOLD}${_dr}${C_RESET}"
  echo -e "  ${C_DIM}(ketik 0 untuk batal — sisa percobaan: ${_left}/${_max})${C_RESET}"
  echo ""
  printf "  ${C_BOLD}▸ ${C_RESET}"
}

# ===== Action: hapus repository =====
action_delete_repo() {
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   🗑️   HAPUS REPOSITORY           │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""

  # ── Tanya repo mana yang mau dihapus ────────────────────────────────────
  echo -e "  ${C_DIM}Repo aktif saat ini:${C_RESET} ${C_BOLD}${USER}/${REPO}${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ── Nama owner (akun/org) ────────────${C_RESET}"
  echo -e "  ${C_DIM}Enter = pakai akun kamu (${USER}) • 0 = kembali${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local del_owner
  read -r del_owner
  del_owner=$(echo "$del_owner" | tr -d '\n\r ')
  [ "$del_owner" = "0" ] && return
  [ -z "$del_owner" ] && del_owner="$USER"
  echo ""

  echo -e "${C_DIM}  ── Nama repository yang ingin dihapus ─${C_RESET}"
  echo -e "  ${C_DIM}Enter = pakai repo aktif (${REPO}) • 0 = kembali${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local del_repo
  read -r del_repo
  del_repo=$(echo "$del_repo" | tr -d '\n\r ')
  [ "$del_repo" = "0" ] && return
  [ -z "$del_repo" ] && del_repo="$REPO"
  echo ""

  # ── Ambil info repo dulu dari API ───────────────────────────────────────
  mini_bar2_start "Mengambil info repository ..." "Fetch dari GitHub API..." 0.05
  local info_raw info_code
  info_raw=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${del_owner}/${del_repo}" 2>/dev/null)
  info_code=$(printf '%s' "$info_raw" | tail -1)
  local info_body
  info_body=$(printf '%s' "$info_raw" | sed '$d')

  relogin_if_needed "$info_code" "ambil info repo" || return
  if [ "$info_code" = "200" ]; then
    mini_bar2_ok "Info repo didapat" "${del_owner}/${del_repo} ditemukan ✓"
  else
    mini_bar2_fail "Gagal HTTP ${info_code}" "Tidak bisa ambil info dari GitHub API"
  fi
  if [ "$info_code" = "404" ]; then
    echo -e "  ${C_RED}❌ Repository '${del_owner}/${del_repo}' tidak ditemukan.${C_RESET}"
    echo ""
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    echo -e "  ${C_DIM}0 atau Enter › Kembali ke menu${C_RESET}"
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    printf "  ${C_BOLD}▸ ${C_RESET}"; local _r1; read -r _r1
    clear >/dev/tty 2>/dev/null || true; return
  fi
  if [ "$info_code" != "200" ]; then
    echo -e "  ${C_RED}❌ Gagal ambil info repo (HTTP ${info_code}).${C_RESET}"
    echo ""
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    echo -e "  ${C_DIM}0 atau Enter › Kembali ke menu${C_RESET}"
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    printf "  ${C_BOLD}▸ ${C_RESET}"; local _r2; read -r _r2
    clear >/dev/tty 2>/dev/null || true; return
  fi

  # ── Parse info repo (lengkap) ───────────────────────────────────────────
  local repo_full repo_private repo_desc repo_lang repo_branch
  local repo_stars repo_forks repo_issues repo_watch repo_size
  local repo_created repo_updated repo_pushed
  repo_full=$(printf '%s' "$info_body" \
    | grep -oE '"full_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
    | sed 's/.*"full_name"[[:space:]]*:[[:space:]]*"//;s/".*//')
  repo_private=$(printf '%s' "$info_body" \
    | grep -oE '"private"[[:space:]]*:[[:space:]]*(true|false)' | head -1 \
    | grep -oE '(true|false)')
  repo_desc=$(printf '%s' "$info_body" \
    | grep -oE '"description"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
    | sed 's/.*"description"[[:space:]]*:[[:space:]]*"//;s/".*//')
  repo_lang=$(printf '%s' "$info_body" \
    | grep -oE '"language"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
    | sed 's/.*"language"[[:space:]]*:[[:space:]]*"//;s/".*//')
  repo_branch=$(printf '%s' "$info_body" \
    | grep -oE '"default_branch"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
    | sed 's/.*"default_branch"[[:space:]]*:[[:space:]]*"//;s/".*//')
  repo_stars=$(printf '%s' "$info_body" \
    | grep -oE '"stargazers_count"[[:space:]]*:[[:space:]]*[0-9]+' | head -1 \
    | grep -oE '[0-9]+$')
  repo_forks=$(printf '%s' "$info_body" \
    | grep -oE '"forks_count"[[:space:]]*:[[:space:]]*[0-9]+' | head -1 \
    | grep -oE '[0-9]+$')
  repo_issues=$(printf '%s' "$info_body" \
    | grep -oE '"open_issues_count"[[:space:]]*:[[:space:]]*[0-9]+' | head -1 \
    | grep -oE '[0-9]+$')
  repo_watch=$(printf '%s' "$info_body" \
    | grep -oE '"watchers_count"[[:space:]]*:[[:space:]]*[0-9]+' | head -1 \
    | grep -oE '[0-9]+$')
  repo_size=$(printf '%s' "$info_body" \
    | grep -oE '"size"[[:space:]]*:[[:space:]]*[0-9]+' | head -1 \
    | grep -oE '[0-9]+$')
  repo_created=$(printf '%s' "$info_body" \
    | grep -oE '"created_at"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
    | sed 's/.*"created_at"[[:space:]]*:[[:space:]]*"//;s/".*//')
  repo_updated=$(printf '%s' "$info_body" \
    | grep -oE '"updated_at"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
    | sed 's/.*"updated_at"[[:space:]]*:[[:space:]]*"//;s/".*//')
  repo_pushed=$(printf '%s' "$info_body" \
    | grep -oE '"pushed_at"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
    | sed 's/.*"pushed_at"[[:space:]]*:[[:space:]]*"//;s/".*//')
  local vis_label="🌐 Public"
  [ "$repo_private" = "true" ] && vis_label="🔒 Private"

  # ── Konfirmasi ketat: ketik ulang nama — layar refresh tiap detik ────────
  local attempt=0 max_attempt=3 typed_name=""
  while [ "$attempt" -lt "$max_attempt" ]; do
    # Gambar ulang layar peringatan + jam real-time
    _draw_del_warn \
      "$del_repo" "$repo_full" "$vis_label" "$repo_private" \
      "$repo_lang" "$repo_branch" "$repo_desc" \
      "${repo_stars:-0}" "${repo_forks:-0}" "${repo_issues:-0}" \
      "${repo_watch:-0}" "${repo_size:-0}" \
      "$repo_created" "$repo_updated" "$repo_pushed" \
      "$attempt" "$max_attempt"

    # read -t 1: tunggu max 1 detik → jika timeout, gambar ulang (clock tick)
    typed_name=""
    if IFS= read -r -t 1 typed_name 2>/dev/null; then
      typed_name=$(printf '%s' "$typed_name" | tr -d '\n\r')
      # User menekan Enter tanpa input → biarkan loop refresh
      [ -z "$typed_name" ] && continue
      if [ "$typed_name" = "0" ]; then
        clear >/dev/tty 2>/dev/null || true; return
      fi
      if [ "$typed_name" = "$del_repo" ]; then
        break
      fi
      # Salah ketik
      attempt=$(( attempt + 1 ))
      if [ "$attempt" -lt "$max_attempt" ]; then
        # Flash pesan error sebentar sebelum refresh
        echo -e "\n  ${C_RED}✖ Nama tidak cocok! Sisa: $(( max_attempt - attempt ))x${C_RESET}"
        sleep 1
      fi
    fi
    # Timeout read → loop lagi (refresh clock, tidak tambah attempt)
  done

  if [ "$typed_name" != "$del_repo" ]; then
    clear >/dev/tty 2>/dev/null || true
    echo -e "${C_BOLD}╭────────────────────────────────────────────────╮${C_RESET}"
    echo -e "${C_RED}${C_BOLD}│   ⚠️   PERINGATAN HAPUS REPOSITORY             │${C_RESET}"
    echo -e "${C_BOLD}╰────────────────────────────────────────────────╯${C_RESET}"
    echo ""
    echo -e "  ${C_YELLOW}⚠️  3x salah — penghapusan dibatalkan.${C_RESET}"
    sleep 1; clear >/dev/tty 2>/dev/null || true; return
  fi

  # ── Konfirmasi akhir y/n dengan clock ────────────────────────────────────
  local final_confirm=""
  while true; do
    # Gambar ulang header + detail + jam untuk konfirmasi akhir
    _draw_del_warn \
      "$del_repo" "$repo_full" "$vis_label" "$repo_private" \
      "$repo_lang" "$repo_branch" "$repo_desc" \
      "${repo_stars:-0}" "${repo_forks:-0}" "${repo_issues:-0}" \
      "${repo_watch:-0}" "${repo_size:-0}" \
      "$repo_created" "$repo_updated" "$repo_pushed" \
      "$max_attempt" "$max_attempt"
    echo -e "  ${C_GREEN}✔ Nama cocok — satu langkah terakhir:${C_RESET}"
    echo ""
    echo -e "  ${C_RED}Ketik ${C_BOLD}y${C_RESET}${C_RED} untuk HAPUS PERMANEN, atau 0 untuk batal:${C_RESET}"
    printf "  ${C_BOLD}▸ ${C_RESET}"
    if IFS= read -r -t 1 final_confirm 2>/dev/null; then
      final_confirm=$(printf '%s' "$final_confirm" | tr -d '\n\r ' | tr '[:upper:]' '[:lower:]')
      [ "$final_confirm" = "y" ] && break
      if [ "$final_confirm" = "0" ] || [ "$final_confirm" = "q" ]; then
        clear >/dev/tty 2>/dev/null || true; return
      fi
      [ -n "$final_confirm" ] && { echo -e "  ${C_RED}✖ Ketik y atau 0.${C_RESET}"; sleep 1; }
    fi
  done

  # ── Eksekusi hapus via API ───────────────────────────────────────────────
  echo ""
  mini_bar2_start "Menghapus ${del_owner}/${del_repo} ..." "Kirim DELETE ke GitHub API..." 0.05
  local del_resp del_code
  del_resp=$(curl -s -w "\n%{http_code}" \
    -X DELETE \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${del_owner}/${del_repo}" 2>/dev/null)
  del_code=$(printf '%s' "$del_resp" | tail -1)
  if [ "$del_code" = "204" ]; then
    mini_bar2_ok "Repository dihapus" "${del_owner}/${del_repo} sudah dihapus permanen"
  else
    mini_bar2_fail "Gagal hapus HTTP ${del_code}" "Cek token scope: delete_repo"
  fi

  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   🗑️   HAPUS REPOSITORY           │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""

  case "$del_code" in
    204)
      echo -e "  ${C_GREEN}✅ Repository berhasil dihapus.${C_RESET}"
      echo ""
      printf "  ${C_DIM}%s${C_RESET} sudah tidak ada di GitHub.\n" "${del_owner}/${del_repo}"
      # Kalau yang dihapus adalah repo aktif, kasih info
      if [ "$del_repo" = "$REPO" ] && [ "$del_owner" = "$USER" ]; then
        echo ""
        echo -e "  ${C_YELLOW}💡 Repo aktif script ini ikut dihapus.${C_RESET}"
        echo -e "  ${C_YELLOW}   Ubah variabel REPO di atas script sebelum push berikutnya.${C_RESET}"
      fi
      local _ts_dr; _ts_dr=$(date '+%H:%M:%S %d %b %Y')
      local _btn_dr='{"inline_keyboard":[[{"text":"👤 Lihat Profile","url":"https://github.com/'"${del_owner}"'"},{"text":"📦 Semua Repo","url":"https://github.com/'"${del_owner}"'?tab=repositories"}],[{"text":"🔑 Kelola Token","url":"https://github.com/settings/tokens"},{"text":"➕ Buat Repo Baru","url":"https://github.com/new"}]]}'
      send_telegram_photo "https://w.wallhaven.cc/full/v9/wallhaven-v9jz53.png" "🗑 <b>REPO DIHAPUS</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${del_owner}</code>
📁 <code>${del_owner}/${del_repo}</code>
⚠️ Repo ini sudah TIDAK ADA di GitHub
🕐 ${_ts_dr}" "$_btn_dr" 2>/dev/null &
      ;;
    403)
      echo -e "  ${C_RED}❌ Tidak punya izin hapus repo ini (HTTP 403).${C_RESET}"
      echo -e "  ${C_YELLOW}💡 Token butuh scope: delete_repo${C_RESET}"
      echo -e "  ${C_DIM}   Pergi ke: github.com/settings/tokens → edit token kamu.${C_RESET}"
      ;;
    404)
      echo -e "  ${C_RED}❌ Repository tidak ditemukan (sudah dihapus sebelumnya?).${C_RESET}"
      ;;
    401)
      echo -e "  ${C_RED}❌ Token tidak valid atau sudah expired (HTTP 401).${C_RESET}"
      ;;
    *)
      local derr
      derr=$(printf '%s' "$del_resp" | sed '$d' \
        | grep -oE '"message"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 \
        | sed 's/.*"message"[[:space:]]*:[[:space:]]*"//;s/".*//')
      echo -e "  ${C_RED}❌ Gagal menghapus (HTTP ${del_code}).${C_RESET}"
      [ -n "$derr" ] && echo -e "  ${C_RED}   ${derr}${C_RESET}"
      ;;
  esac

  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  ${C_DIM}0 atau Enter › Kembali ke menu${C_RESET}"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local _r; read -r _r
  clear >/dev/tty 2>/dev/null || true
}

# ===== Action: lihat semua repository =====
action_list_repos() {
  # State paginasi + filter — persisten selama session opsi ini
  local lr_page=1
  local lr_per_page=10
  local lr_filter="all"   # all | public | private
  local lr_sort="updated" # updated | created | full_name | pushed

  while true; do
    # ── Fetch data dari GitHub API ───────────────────────────────────────
    clear >/dev/tty 2>/dev/null || true
    echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
    echo -e "${C_BOLD}│   📋  SEMUA REPOSITORY            │${C_RESET}"
    echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
    echo ""
    mini_bar_start "Mengambil data repo dari GitHub ..." 0.05

    # Ambil total count dulu (per_page=1 untuk efisiensi)
    local count_raw total_count=0
    count_raw=$(curl -s \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/user/repos?type=${lr_filter}&per_page=1&page=1" \
      -D - 2>/dev/null)
    # Ambil total dari Link header — atau fallback hitung manual
    local link_hdr
    link_hdr=$(printf '%s' "$count_raw" | grep -i '^link:' | head -1)
    if [ -n "$link_hdr" ]; then
      # Cari angka halaman terakhir dari Link header
      local last_page
      last_page=$(printf '%s' "$link_hdr" \
        | grep -oE 'page=[0-9]+>; rel="last"' \
        | grep -oE '[0-9]+' | head -1)
      [ -n "$last_page" ] && total_count="$last_page"
    fi

    # Fetch halaman aktual
    local raw_resp http_code
    raw_resp=$(curl -s -w "\n%{http_code}" \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/user/repos?type=${lr_filter}&sort=${lr_sort}&direction=desc&per_page=${lr_per_page}&page=${lr_page}" \
      2>/dev/null)
    http_code=$(printf '%s' "$raw_resp" | tail -1)
    local body
    body=$(printf '%s' "$raw_resp" | sed '$d')

    relogin_if_needed "$http_code" "ambil daftar repo" || continue
    if [ "$http_code" = "200" ]; then mini_bar_ok "Data repo dimuat"; else mini_bar_fail "HTTP ${http_code}"; fi
    if [ "$http_code" != "200" ]; then
      clear >/dev/tty 2>/dev/null || true
      echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
      echo -e "${C_BOLD}│   📋  SEMUA REPOSITORY            │${C_RESET}"
      echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
      echo ""
      echo -e "  ${C_RED}❌ Gagal mengambil data (HTTP ${http_code}).${C_RESET}"
      [ "$http_code" = "401" ] && echo -e "  ${C_YELLOW}💡 Token tidak valid atau expired.${C_RESET}"
      echo ""
      echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
      echo -e "  ${C_DIM}0 atau Enter › Kembali ke menu${C_RESET}"
      echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
      printf "  ${C_BOLD}▸ ${C_RESET}"; local _re; read -r _re
      clear >/dev/tty 2>/dev/null || true; return
    fi

    # ── Parse daftar repo dengan node ────────────────────────────────────
    local repo_lines
    repo_lines=$(printf '%s' "$body" | node -e "
      let d='';
      process.stdin.on('data',c=>d+=c).on('end',()=>{
        try {
          const repos = JSON.parse(d);
          repos.forEach(r => {
            const upd  = r.updated_at ? r.updated_at.slice(0,10) : '----';
            const priv = r.private ? 'priv' : 'pub ';
            const star = r.stargazers_count || 0;
            const fork = r.forks_count || 0;
            const lang = (r.language || '').slice(0,12).padEnd(12);
            const name = (r.full_name || '').slice(0,40);
            console.log(priv+'|'+upd+'|'+star+'|'+fork+'|'+lang+'|'+name);
          });
        } catch(e) { process.exit(1); }
      });
    " 2>/dev/null)

    # Hitung total dari fetch single-per-page jika Link tidak ada
    if [ "$total_count" = "0" ] || [ -z "$total_count" ]; then
      # Fallback: hitung baris yang kembali
      local cur_count
      cur_count=$(printf '%s' "$repo_lines" | grep -c '|' 2>/dev/null || echo 0)
      total_count="$cur_count"
    fi

    # Hitung total halaman
    local total_pages=$(( (total_count + lr_per_page - 1) / lr_per_page ))
    [ "$total_pages" -lt 1 ] && total_pages=1
    [ "$lr_page" -gt "$total_pages" ] && lr_page="$total_pages"

    # ── Tampilkan header ──────────────────────────────────────────────────
    clear >/dev/tty 2>/dev/null || true
    echo -e "${C_BOLD}╭──────────────────────────────────────────────────────╮${C_RESET}"
    echo -e "${C_BOLD}│   📋  SEMUA REPOSITORY — ${USER}$(printf '%*s' $((27 - ${#USER})) '')│${C_RESET}"
    echo -e "${C_BOLD}╰──────────────────────────────────────────────────────╯${C_RESET}"
    echo ""

    # Info baris status
    local filter_label sort_label
    case "$lr_filter" in
      all)     filter_label="${C_DIM}Semua${C_RESET}" ;;
      public)  filter_label="${C_GREEN}Public${C_RESET}" ;;
      private) filter_label="${C_CYAN}Private${C_RESET}" ;;
    esac
    case "$lr_sort" in
      updated)   sort_label="Update terbaru" ;;
      created)   sort_label="Terbaru dibuat" ;;
      pushed)    sort_label="Push terbaru"   ;;
      full_name) sort_label="Nama A→Z"       ;;
    esac
    printf "  ${C_DIM}Filter: ${C_RESET}%b  ${C_DIM}Sort: ${C_RESET}${C_YELLOW}%s${C_RESET}  ${C_DIM}Hal: ${C_RESET}${C_BOLD}%s${C_RESET}${C_DIM}/%s${C_RESET}\n" \
      "$filter_label" "$sort_label" "$lr_page" "$total_pages"
    echo ""
    echo -e "${C_DIM}  ──  Vis  ── Update ──── ⭐ 🍴 ── Bahasa ──── Nama ──────────────────${C_RESET}"

    # ── Tampilkan baris repo ─────────────────────────────────────────────
    if [ -z "$repo_lines" ]; then
      echo -e "  ${C_DIM}(Tidak ada repository di halaman ini)${C_RESET}"
    else
      local idx=1
      while IFS='|' read -r vis upd star fork lang name; do
        # Warna badge visibilitas
        local vis_badge
        if [ "$vis" = "priv" ]; then
          vis_badge="${C_CYAN}🔒 priv${C_RESET}"
        else
          vis_badge="${C_GREEN}🌐 pub ${C_RESET}"
        fi
        # Truncate nama repo supaya rapi
        local short_name="${name##*/}"
        local owner_name="${name%%/*}"
        # Warna nomor urut
        printf "  ${C_DIM}%2d${C_RESET}  %b  ${C_DIM}%s${C_RESET}  ${C_YELLOW}%-2s${C_RESET} ${C_DIM}%-2s${C_RESET}  ${C_DIM}%-10s${C_RESET}  ${C_BOLD}%s${C_RESET}${C_DIM}/%s${C_RESET}\n" \
          "$idx" "$vis_badge" "$upd" "$star" "$fork" "$lang" "$owner_name" "$short_name"
        idx=$(( idx + 1 ))
      done <<< "$repo_lines"
    fi

    echo ""
    echo -e "${C_DIM}  ──────────────────────────────────────────────────────${C_RESET}"

    # ── Navigasi ─────────────────────────────────────────────────────────
    echo -e "  ${C_BOLD}Navigasi halaman:${C_RESET}"
    # Tampilkan tombol sesuai posisi
    [ "$lr_page" -gt 1 ] && \
      echo -e "  ${C_GREEN}p${C_RESET} › Sebelumnya   ${C_GREEN}f${C_RESET} › Halaman pertama"
    [ "$lr_page" -lt "$total_pages" ] && \
      echo -e "  ${C_GREEN}n${C_RESET} › Berikutnya   ${C_GREEN}l${C_RESET} › Halaman terakhir"
    echo -e "  ${C_YELLOW}g${C_RESET} › Loncat ke halaman..."
    echo ""
    echo -e "  ${C_BOLD}Filter & Sort:${C_RESET}"
    echo -e "  ${C_CYAN}fa${C_RESET} › Semua   ${C_CYAN}fp${C_RESET} › Public   ${C_CYAN}fv${C_RESET} › Private"
    echo -e "  ${C_CYAN}su${C_RESET} › Sort: Update   ${C_CYAN}sc${C_RESET} › Dibuat   ${C_CYAN}sp${C_RESET} › Push   ${C_CYAN}sn${C_RESET} › Nama"
    echo ""
    echo -e "  ${C_MAGENTA}r${C_RESET} › Refresh   ${C_RED}0${C_RESET} › Kembali ke menu"
    echo -e "${C_DIM}  ──────────────────────────────────────────────────────${C_RESET}"
    printf "  ${C_BOLD}▸ ${C_RESET}"

    local nav_pick
    read -r nav_pick
    nav_pick=$(echo "$nav_pick" | tr -d '\n\r' | tr '[:upper:]' '[:lower:]')

    case "$nav_pick" in
      # ── Navigasi halaman ──────────────────────────────────────────────
      n|"")
        if [ "$lr_page" -lt "$total_pages" ]; then
          lr_page=$(( lr_page + 1 ))
        else
          # Sudah halaman terakhir — tetap di tempat
          true
        fi
        ;;
      p)
        [ "$lr_page" -gt 1 ] && lr_page=$(( lr_page - 1 ))
        ;;
      f)
        lr_page=1
        ;;
      l)
        lr_page="$total_pages"
        ;;
      g)
        # Loncat ke halaman
        printf "  Halaman (1-%s): " "$total_pages"
        local jump_to
        read -r jump_to
        jump_to=$(echo "$jump_to" | tr -d '\n\r ')
        if echo "$jump_to" | grep -qE '^[0-9]+$'; then
          if [ "$jump_to" -ge 1 ] && [ "$jump_to" -le "$total_pages" ]; then
            lr_page="$jump_to"
          else
            echo -e "  ${C_RED}✖ Halaman harus antara 1 dan ${total_pages}.${C_RESET}"
            sleep 1
          fi
        fi
        ;;
      # ── Filter ────────────────────────────────────────────────────────
      fa)
        lr_filter="all"; lr_page=1
        ;;
      fp)
        lr_filter="public"; lr_page=1
        ;;
      fv)
        lr_filter="private"; lr_page=1
        ;;
      # ── Sort ──────────────────────────────────────────────────────────
      su)
        lr_sort="updated"; lr_page=1
        ;;
      sc)
        lr_sort="created"; lr_page=1
        ;;
      sp)
        lr_sort="pushed"; lr_page=1
        ;;
      sn)
        lr_sort="full_name"; lr_page=1
        ;;
      # ── Refresh ───────────────────────────────────────────────────────
      r)
        true  # loop ulang = fetch ulang otomatis
        ;;
      # ── Kembali ───────────────────────────────────────────────────────
      0|q)
        clear >/dev/tty 2>/dev/null || true
        return
        ;;
      *)
        # Abaikan input tidak dikenal
        true
        ;;
    esac
  done
}

# ===== Action: edit (rename) nama branch =====
action_rename_branch() {
  local _RB_PAGE="${_RB_PAGE:-1}"
  local _RB_PAGE_SIZE=8

  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   ✏️   EDIT NAMA BRANCH          │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  _MB_SUB_FILE=$(mktemp)
  printf "Menghubungi GitHub API..." > "$_MB_SUB_FILE"
  mini_bar2_start "Memuat daftar branch ..." "Menghubungi GitHub API..." 0.06
  local branches=()
  while IFS= read -r b; do
    if [ -n "$b" ]; then
      branches+=("$b")
      printf "${#branches[@]} branch ditemukan..." > "$_MB_SUB_FILE"
    fi
  done < <(fetch_branches_recent)
  rm -f "$_MB_SUB_FILE" 2>/dev/null; _MB_SUB_FILE=""
  mini_bar2_ok "Daftar branch siap" "${#branches[@]} branch tersedia ✓"

  local total=${#branches[@]}
  if [ "$total" -eq 0 ]; then
    clear >/dev/tty 2>/dev/null || true
    echo -e "${C_YELLOW}ℹ️  Tidak ada branch yang ditemukan.${C_RESET}"
    prompt_back_or_exit
    return
  fi

  local total_pages=$(( (total + _RB_PAGE_SIZE - 1) / _RB_PAGE_SIZE ))
  [ "$total_pages" -eq 0 ] && total_pages=1
  [ "$_RB_PAGE" -gt "$total_pages" ] && _RB_PAGE=$total_pages
  [ "$_RB_PAGE" -lt 1 ] && _RB_PAGE=1

  local start=$(( (_RB_PAGE - 1) * _RB_PAGE_SIZE ))
  local end=$(( start + _RB_PAGE_SIZE ))
  [ "$end" -gt "$total" ] && end="$total"

  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   ✏️   EDIT NAMA BRANCH          │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}repo  ${C_RESET}${C_BOLD}${USER}/${REPO}${C_RESET}"
  if [ "$total_pages" -gt 1 ]; then
    echo -e "  ${C_DIM}posisi${C_RESET} ${C_BOLD}$(( start + 1 ))–${end}${C_RESET}${C_DIM} dari ${total} branch  •  hal ${_RB_PAGE}/${total_pages}${C_RESET}"
  else
    echo -e "  ${C_DIM}total ${C_RESET}${C_BOLD}${total} branch${C_RESET}"
  fi
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"

  for (( i=start; i<end; i++ )); do
    local b="${branches[$i]}"
    local num=$(( i + 1 ))
    if [ "$b" = "$DEFAULT_BRANCH" ]; then
      printf "  ${C_GREEN}%2d${C_RESET} ${C_BOLD}›${C_RESET} %s  ${C_DIM}(default)${C_RESET}\n" "$num" "$b"
    else
      printf "  ${C_CYAN}%2d${C_RESET} ${C_BOLD}›${C_RESET} %s\n" "$num" "$b"
    fi
  done

  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  if [ "$total_pages" -gt 1 ]; then
    local _nav_rb=""
    [ "$_RB_PAGE" -lt "$total_pages" ] && _nav_rb="${_nav_rb}  ${C_CYAN}n${C_RESET} › Berikutnya"
    [ "$_RB_PAGE" -gt 1 ]              && _nav_rb="${_nav_rb}   ${C_CYAN}p${C_RESET} › Sebelumnya"
    [ -n "$_nav_rb" ] && echo -e "$_nav_rb"
    echo -e "  ${C_CYAN}f${C_RESET} › Awal   ${C_CYAN}l${C_RESET} › Akhir   ${C_DIM}h<angka> → loncat hal  (mis: h2)${C_RESET}"
  fi
  echo -e "  ${C_RED} 0${C_RESET} ${C_BOLD}›${C_RESET} Kembali ke menu"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}Pilih branch ▸ ${C_RESET}"

  local pick
  read -r pick
  pick="${pick:-0}"

  case "$pick" in
    n|N) _RB_PAGE=$(( _RB_PAGE < total_pages ? _RB_PAGE + 1 : _RB_PAGE )) action_rename_branch; return ;;
    p|P) _RB_PAGE=$(( _RB_PAGE > 1 ? _RB_PAGE - 1 : 1 )) action_rename_branch; return ;;
    f|F) _RB_PAGE=1 action_rename_branch; return ;;
    l|L) _RB_PAGE=$total_pages action_rename_branch; return ;;
    h*|H*)
      local _pg_rb="${pick:1}"
      if echo "$_pg_rb" | grep -qE '^[0-9]+$' && [ "$_pg_rb" -ge 1 ] && [ "$_pg_rb" -le "$total_pages" ]; then
        _RB_PAGE=$_pg_rb action_rename_branch
      else
        echo -e "  ${C_RED}✖ Halaman tidak valid${C_RESET} ${C_DIM}(1–${total_pages})${C_RESET}"
        sleep 1
        _RB_PAGE=$_RB_PAGE action_rename_branch
      fi
      return
      ;;
  esac

  if [ "$pick" = "0" ]; then
    echo -e "  ${C_YELLOW}↩ Kembali ke menu.${C_RESET}"
    sleep 1
    return
  fi

  if ! echo "$pick" | grep -qE '^[0-9]+$' || [ "$pick" -lt 1 ] || [ "$pick" -gt "$total" ]; then
    echo -e "  ${C_RED}✖ Pilihan tidak valid.${C_RESET}"
    sleep 2
    _RB_PAGE=$_RB_PAGE action_rename_branch
    return
  fi

  local old_name="${branches[$((pick - 1))]}"

  # ── Layar 2: input nama baru ──────────────────────────────────────────
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   ✏️   EDIT NAMA BRANCH          │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}branch dipilih  ${C_RESET}${C_BOLD}${old_name}${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  ${C_RED}0${C_RESET} ${C_BOLD}›${C_RESET} Kembali ke menu"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}Nama baru ▸ ${C_RESET}"

  local new_name
  read -r new_name
  new_name=$(echo "$new_name" | tr -d '[:space:]')

  if [ -z "$new_name" ] || [ "$new_name" = "0" ]; then
    echo -e "  ${C_YELLOW}↩ Kembali ke menu.${C_RESET}"
    sleep 1
    return
  fi

  # Validasi nama branch
  if ! echo "$new_name" | grep -qE '^[a-zA-Z0-9._/-]+$'; then
    echo -e "  ${C_RED}✖ Nama tidak valid${C_RESET} ${C_DIM}(hanya huruf, angka, - _ / .)${C_RESET}"
    sleep 2
    return
  fi

  if [ "$new_name" = "$old_name" ]; then
    echo -e "  ${C_YELLOW}ℹ️  Nama sama seperti sekarang, tidak ada yang diubah.${C_RESET}"
    sleep 2
    return
  fi

  # ── Konfirmasi ────────────────────────────────────────────────────────
  echo ""
  echo -e "  ${C_RED}⚠️  Yakin rename branch?${C_RESET}"
  echo -e "  ${C_DIM}${old_name}${C_RESET} ${C_BOLD}→${C_RESET} ${C_GREEN}${new_name}${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}y${C_RESET} ${C_BOLD}›${C_RESET} Lanjut rename      ${C_RED}n${C_RESET} ${C_BOLD}›${C_RESET} Batal"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"

  local confirm
  read -r confirm </dev/tty
  confirm=$(printf '%s' "$confirm" | tr '[:upper:]' '[:lower:]' | tr -d ' \r\n')
  if [ "$confirm" != "y" ]; then
    echo -e "  ${C_YELLOW}↩ Dibatalkan.${C_RESET}"
    sleep 1
    return
  fi

  # ── Panggil GitHub API: POST /repos/{owner}/{repo}/branches/{branch}/rename ──
  echo ""
  mini_bar2_start "Rename branch ..." "Kirim POST ke GitHub API..." 0.05

  local api_http
  api_http=$(curl -s -o /tmp/_gh_renbranch.json -w "%{http_code}" \
    -X POST \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${USER}/${REPO}/branches/${old_name}/rename" \
    -d "{\"new_name\":\"${new_name}\"}" 2>/dev/null)

  if [ "$api_http" = "201" ]; then
    mini_bar2_ok "Branch di-rename" "${old_name} → ${new_name} ✓"
    echo ""
    echo -e "  ${C_GREEN}✅ Branch berhasil di-rename di GitHub!${C_RESET}"
    echo -e "  ${C_DIM}${old_name}${C_RESET} ${C_BOLD}→${C_RESET} ${C_GREEN}${new_name}${C_RESET}"
    echo -e "  ${C_BLUE}🔗 https://github.com/${USER}/${REPO}/tree/${new_name}${C_RESET}"
    local _ts_rb; _ts_rb=$(date '+%H:%M:%S %d %b %Y')
    local _btn_rb='{"inline_keyboard":[[{"text":"🌿 Lihat Branch Baru","url":"https://github.com/'"${USER}"'/'"${REPO}"'/tree/'"${new_name}"'"},{"text":"📋 Semua Branches","url":"https://github.com/'"${USER}"'/'"${REPO}"'/branches"}],[{"text":"🔀 Pull Request","url":"https://github.com/'"${USER}"'/'"${REPO}"'/compare/'"${new_name}"'"},{"text":"📊 Commits","url":"https://github.com/'"${USER}"'/'"${REPO}"'/commits/'"${new_name}"'"}]]}'
    send_telegram_photo "https://w.wallhaven.cc/full/vp/wallhaven-vpxgk5.png" "✏️ <b>BRANCH DI-RENAME</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🔄 <code>${old_name}</code> → <code>${new_name}</code>
🔗 github.com/${USER}/${REPO}/tree/${new_name}
🕐 ${_ts_rb}" "$_btn_rb" 2>/dev/null &

    # Kalau yang di-rename adalah default branch, update variabel & script
    if [ "$old_name" = "$DEFAULT_BRANCH" ]; then
      DEFAULT_BRANCH="$new_name"
      sed -i "s|^DEFAULT_BRANCH=.*|DEFAULT_BRANCH=\"${new_name}\"|" "$0" 2>/dev/null || true
      echo -e "  ${C_DIM}Default branch ikut diperbarui → ${C_GREEN}${new_name}${C_RESET}"
    fi
  else
    local api_msg
    api_msg=$(grep -o '"message": *"[^"]*"' /tmp/_gh_renbranch.json 2>/dev/null \
      | head -1 | sed 's/"message": *"//;s/"//')
    mini_bar2_fail "Gagal HTTP ${api_http}" "${api_msg:-error dari GitHub API}"
    echo ""
    echo -e "  ${C_RED}❌ Gagal rename branch (HTTP ${api_http})${C_RESET}"
    [ -n "$api_msg" ] && echo -e "  ${C_DIM}   GitHub: ${api_msg}${C_RESET}"
    echo -e "  ${C_DIM}   Pastikan token punya scope: repo (full control)${C_RESET}"
  fi

  rm -f /tmp/_gh_renbranch.json
  prompt_back_or_exit
}

# ===== Action: buat branch baru =====
action_create_branch() {
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   🌱  BUAT BRANCH BARU           │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}📁 Repo    :${C_RESET} ${C_BOLD}${USER}/${REPO}${C_RESET}"
  echo -e "  ${C_DIM}🌿 Default :${C_RESET} ${C_GREEN}${DEFAULT_BRANCH}${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}💡 Tips penamaan branch:${C_RESET}"
  echo -e "  ${C_DIM}   • Gunakan huruf, angka, - _ / .${C_RESET}"
  echo -e "  ${C_DIM}   • Contoh: feature/login${C_RESET}"
  echo -e "  ${C_DIM}   • Contoh: ReadswDika-V17.0${C_RESET}"
  echo -e "  ${C_DIM}   • Contoh: fix/bug-crash${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  ${C_RED}0${C_RESET} ${C_BOLD}›${C_RESET} Kembali ke menu"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}Nama branch baru ▸ ${C_RESET}"
  local name
  read -r name </dev/tty
  name=$(printf '%s' "$name" | tr -d '[:space:]\r\n')

  if [ -z "$name" ] || [ "$name" = "0" ]; then
    echo -e "${C_YELLOW}↩ Kembali ke menu.${C_RESET}"
    sleep 1
    return
  fi

  # Validasi nama (hanya alfanumerik, -, _, /, .)
  if ! echo "$name" | grep -qE '^[a-zA-Z0-9._/-]+$'; then
    echo -e "${C_RED}✖ Nama tidak valid${C_RESET} ${C_DIM}(hanya huruf, angka, - _ / .)${C_RESET}"
    sleep 2
    return
  fi

  # Cek apakah branch sudah ada via GitHub API
  mini_bar2_start "Cek nama branch ..." "Verifikasi ke GitHub API..." 0.015
  local chk_http
  chk_http=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${USER}/${REPO}/git/ref/heads/${name}" \
    2>/dev/null)
  if [ "$chk_http" = "200" ]; then
    mini_bar2_fail "Branch sudah ada" "Branch '${name}' sudah exist di GitHub"
    sleep 2
    return
  fi
  mini_bar2_ok "Nama tersedia" "Branch '${name}' belum ada ✓"

  # Ambil SHA tip dari DEFAULT_BRANCH via GitHub API (tidak butuh switch branch lokal)
  mini_bar2_start "Ambil SHA ${DEFAULT_BRANCH} ..." "Fetch commit terbaru dari remote..." 0.015
  local sha_resp sha
  sha_resp=$(curl -s -o /tmp/_gh_sha.json -w "%{http_code}" \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${USER}/${REPO}/git/ref/heads/${DEFAULT_BRANCH}" \
    2>/dev/null)
  if [ "$sha_resp" != "200" ]; then
    mini_bar2_fail "Gagal ambil SHA" "HTTP ${sha_resp} dari GitHub"
    rm -f /tmp/_gh_sha.json
    sleep 2
    return
  fi
  sha=$(grep -o '"sha": *"[^"]*"' /tmp/_gh_sha.json | head -1 | sed 's/"sha": *"//;s/"//')
  rm -f /tmp/_gh_sha.json
  if [ -z "$sha" ]; then
    mini_bar2_fail "Gagal ambil SHA" "SHA tidak ada di response GitHub"
    sleep 2
    return
  fi
  mini_bar2_ok "SHA didapat" "${sha:0:7} ← ${DEFAULT_BRANCH}"

  # Buat branch di GitHub via API
  mini_bar2_start "Buat branch ${name} ..." "Kirim POST ke GitHub API..." 0.02
  local create_http
  create_http=$(curl -s -o /tmp/_gh_create.json -w "%{http_code}" \
    -X POST \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${USER}/${REPO}/git/refs" \
    -d "{\"ref\":\"refs/heads/${name}\",\"sha\":\"${sha}\"}" \
    2>/dev/null)
  if [ "$create_http" != "201" ]; then
    local api_msg
    api_msg=$(grep -o '"message": *"[^"]*"' /tmp/_gh_create.json 2>/dev/null | head -1 | sed 's/"message": *"//;s/"//')
    mini_bar2_fail "Gagal buat branch" "HTTP ${create_http}${api_msg:+ — ${api_msg}}"
    rm -f /tmp/_gh_create.json
    prompt_back_or_exit
    return
  fi
  mini_bar2_ok "Branch dibuat" "${USER}/${REPO} → ${name} ✓"

  rm -f /tmp/_gh_create.json
  echo -e "  ${C_GREEN}✅ Branch '${C_BOLD}${name}${C_RESET}${C_GREEN}' berhasil dibuat!${C_RESET}"
  echo ""

  # ── Push file lokal terkini ke branch baru ──────────────────────────────
  echo -e "${C_BOLD}📤 Upload file lokal ke branch baru...${C_RESET}"
  echo -e "  ${C_DIM}(aturan gitignore berlaku — sama seperti upload biasa)${C_RESET}"
  echo ""

  SELECTED_BRANCHES=("$name")
  if ! commit_pending_changes; then
    echo -e "  ${C_YELLOW}⚠️  Tidak ada perubahan baru untuk di-commit.${C_RESET}"
  fi

  push_head_to_branch "$name"

  local _ts_cb; _ts_cb=$(date '+%H:%M:%S %d %b %Y')
  local _btn_cb='{"inline_keyboard":[[{"text":"🌿 Lihat Branch","url":"https://github.com/'"${USER}"'/'"${REPO}"'/tree/'"${name}"'"},{"text":"🔀 Buat PR","url":"https://github.com/'"${USER}"'/'"${REPO}"'/compare/'"${name}"'"}],[{"text":"📁 Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"},{"text":"📊 Commits","url":"https://github.com/'"${USER}"'/'"${REPO}"'/commits/'"${name}"'"}]]}'
  send_telegram_photo "https://w.wallhaven.cc/full/x1/wallhaven-x1ppvz.jpg" "🌱 <b>BRANCH BARU DIBUAT + PUSH</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🌿 Branch baru: <code>${name}</code>
📤 File lokal sudah ter-upload
🔗 github.com/${USER}/${REPO}/tree/${name}
━━━━━━━━━━━━━━━━━━━━
🕐 ${_ts_cb}" "$_btn_cb" 2>/dev/null &

  prompt_back_or_exit
}

# ===== Action: hapus branch =====
action_delete_branch() {
  local _DB_PAGE="${_DB_PAGE:-1}"
  local _DB_PAGE_SIZE=8

  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   🗑️   HAPUS BRANCH              │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  _MB_SUB_FILE=$(mktemp)
  printf "Menghubungi GitHub API..." > "$_MB_SUB_FILE"
  mini_bar2_start "Memuat daftar branch ..." "Menghubungi GitHub API..." 0.06
  local branches=()
  while IFS= read -r b; do
    [ -n "$b" ] && [ "$b" != "$DEFAULT_BRANCH" ] && branches+=("$b")
  done < <(fetch_branches_recent)
  rm -f "$_MB_SUB_FILE" 2>/dev/null; _MB_SUB_FILE=""
  mini_bar2_ok "Daftar branch siap" "${#branches[@]} branch tersedia ✓"

  local total=${#branches[@]}

  local total_pages=$(( (total + _DB_PAGE_SIZE - 1) / _DB_PAGE_SIZE ))
  [ "$total_pages" -eq 0 ] && total_pages=1
  [ "$_DB_PAGE" -gt "$total_pages" ] && _DB_PAGE=$total_pages
  [ "$_DB_PAGE" -lt 1 ] && _DB_PAGE=1

  local start=$(( (_DB_PAGE - 1) * _DB_PAGE_SIZE ))
  local end=$(( start + _DB_PAGE_SIZE ))
  [ "$end" -gt "$total" ] && end="$total"

  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   🗑️   HAPUS BRANCH              │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}repo    ${C_RESET}${C_BOLD}${USER}/${REPO}${C_RESET}"
  echo -e "  ${C_DIM}protect ${C_RESET}${C_GREEN}${DEFAULT_BRANCH}${C_RESET}${C_DIM}  (default, tidak bisa dihapus)${C_RESET}"
  if [ "$total" -eq 0 ]; then
    echo ""
    echo -e "  ${C_YELLOW}ℹ️  Tidak ada branch yang bisa dihapus${C_RESET}"
    prompt_back_or_exit
    return
  fi
  if [ "$total_pages" -gt 1 ]; then
    echo -e "  ${C_DIM}posisi ${C_RESET}${C_BOLD}$(( start + 1 ))–${end}${C_RESET}${C_DIM} dari ${total} branch  •  hal ${_DB_PAGE}/${total_pages}${C_RESET}"
  else
    echo -e "  ${C_DIM}total  ${C_RESET}${C_BOLD}${total} branch${C_RESET}"
  fi
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"

  for (( i=start; i<end; i++ )); do
    printf "  ${C_YELLOW}%2d${C_RESET} ${C_BOLD}›${C_RESET} %s\n" "$(( i + 1 ))" "${branches[$i]}"
  done

  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  if [ "$total_pages" -gt 1 ]; then
    local _nav_db=""
    [ "$_DB_PAGE" -lt "$total_pages" ] && _nav_db="${_nav_db}  ${C_CYAN}n${C_RESET} › Berikutnya"
    [ "$_DB_PAGE" -gt 1 ]              && _nav_db="${_nav_db}   ${C_CYAN}p${C_RESET} › Sebelumnya"
    [ -n "$_nav_db" ] && echo -e "$_nav_db"
    echo -e "  ${C_CYAN}f${C_RESET} › Awal   ${C_CYAN}l${C_RESET} › Akhir   ${C_DIM}h<angka> → loncat hal  (mis: h2)${C_RESET}"
  fi
  echo -e "  ${C_RED} 0${C_RESET} ${C_BOLD}›${C_RESET} Kembali ke menu"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  ${C_DIM}nomor (1-${total})  •  multi: ${C_RESET}${C_BOLD}1,3${C_RESET}${C_DIM} / ${C_RESET}${C_BOLD}1 3${C_RESET}${C_DIM}  •  ${C_RESET}${C_BOLD}all${C_RESET}${C_DIM} = semua${C_RESET}"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"

  local pick
  read -r pick
  pick="${pick:-0}"

  case "$pick" in
    n|N) _DB_PAGE=$(( _DB_PAGE < total_pages ? _DB_PAGE + 1 : _DB_PAGE )) action_delete_branch; return ;;
    p|P) _DB_PAGE=$(( _DB_PAGE > 1 ? _DB_PAGE - 1 : 1 )) action_delete_branch; return ;;
    f|F) _DB_PAGE=1 action_delete_branch; return ;;
    l|L) _DB_PAGE=$total_pages action_delete_branch; return ;;
    h*|H*)
      local _pg_db="${pick:1}"
      if echo "$_pg_db" | grep -qE '^[0-9]+$' && [ "$_pg_db" -ge 1 ] && [ "$_pg_db" -le "$total_pages" ]; then
        _DB_PAGE=$_pg_db action_delete_branch
      else
        echo -e "  ${C_RED}✖ Halaman tidak valid${C_RESET} ${C_DIM}(1–${total_pages})${C_RESET}"
        sleep 1
        _DB_PAGE=$_DB_PAGE action_delete_branch
      fi
      return
      ;;
  esac

  if [ "$pick" = "0" ]; then
    echo -e "${C_YELLOW}↩ Kembali ke menu.${C_RESET}"
    sleep 1
    return
  fi

  # ===== Parse pilihan (bisa "1,3" / "1 3" / "all" / "1") =====
  local targets=()
  local invalid=()

  if [ "$pick" = "all" ] || [ "$pick" = "ALL" ] || [ "$pick" = "a" ] || [ "$pick" = "A" ]; then
    targets=("${branches[@]}")
  else
    # Ganti koma jadi spasi, lalu split
    local normalized
    normalized=$(echo "$pick" | tr ',;' '  ')
    local seen=" "
    for n in $normalized; do
      if echo "$n" | grep -qE '^[0-9]+$' && [ "$n" -ge 1 ] && [ "$n" -le "$total" ]; then
        local b="${branches[$((n - 1))]}"
        # Hindari duplikat
        case "$seen" in
          *" $n "*) ;;
          *) targets+=("$b"); seen="$seen$n " ;;
        esac
      else
        invalid+=("$n")
      fi
    done
  fi

  # Notif kalau ada nomor invalid
  if [ ${#invalid[@]} -gt 0 ]; then
    echo ""
    echo -e "${C_RED}✖ Nomor tidak valid: ${invalid[*]}${C_RESET} ${C_DIM}(range valid: 1-${total})${C_RESET}"
    if [ ${#targets[@]} -eq 0 ]; then
      echo -e "${C_YELLOW}↩ Tidak ada branch dipilih, kembali ke menu.${C_RESET}"
      sleep 2
      return
    else
      echo -e "${C_DIM}   Lanjut hapus yang valid saja...${C_RESET}"
      sleep 1
    fi
  fi

  if [ ${#targets[@]} -eq 0 ]; then
    echo -e "${C_RED}✖ Tidak ada pilihan valid.${C_RESET}"
    sleep 2
    return
  fi

  # ===== Konfirmasi =====
  echo ""
  echo -e "  ${C_RED}⚠️  Yakin hapus ${#targets[@]} branch dari lokal & remote?${C_RESET}"
  for t in "${targets[@]}"; do
    echo -e "     ${C_YELLOW}›${C_RESET} ${C_BOLD}${t}${C_RESET}"
  done
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}y${C_RESET} ${C_BOLD}›${C_RESET} Lanjut hapus      ${C_RED}n${C_RESET} ${C_BOLD}›${C_RESET} Batal"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local confirm
  read -r confirm </dev/tty
  confirm=$(printf '%s' "$confirm" | tr '[:upper:]' '[:lower:]' | tr -d ' \r\n')

  if [ "$confirm" != "y" ]; then
    echo -e "${C_YELLOW}↩ Dibatalkan, kembali ke menu.${C_RESET}"
    sleep 1
    return
  fi

  # Pindah dulu ke default biar aman
  git checkout -q "$DEFAULT_BRANCH" 2>/dev/null || true

  local ok=0 fail=0
  for target in "${targets[@]}"; do
    # Proteksi terakhir untuk default
    if [ "$target" = "$DEFAULT_BRANCH" ]; then
      echo ""
      echo -e "  ${C_RED}✖ '${target}' adalah branch default — dilewati.${C_RESET}"
      fail=$((fail + 1))
      continue
    fi

    echo ""
    echo -e "${C_BOLD}🗑️  ${target}${C_RESET}"
    echo -e "  ${C_CYAN}▸${C_RESET} hapus lokal..."
    if git branch -D "$target" 2>/dev/null; then
      echo -e "  ${C_GREEN}✅ lokal terhapus${C_RESET}"
    else
      echo -e "  ${C_DIM}ℹ️  branch lokal tidak ada / sudah terhapus${C_RESET}"
    fi

    echo -e "  ${C_CYAN}▸${C_RESET} hapus remote..."
    local del_log
    del_log=$(mktemp)
    if git push origin --delete "$target" >"$del_log" 2>&1; then
      echo -e "  ${C_GREEN}✅ remote terhapus${C_RESET}"
      ok=$((ok + 1))
      local _ts_db; _ts_db=$(date '+%H:%M:%S %d %b %Y')
      local _btn_db='{"inline_keyboard":[[{"text":"📁 Lihat Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"},{"text":"📋 Semua Branches","url":"https://github.com/'"${USER}"'/'"${REPO}"'/branches"}],[{"text":"📊 Commits","url":"https://github.com/'"${USER}"'/'"${REPO}"'/commits"},{"text":"🌿 Default Branch","url":"https://github.com/'"${USER}"'/'"${REPO}"'/tree/'"${DEFAULT_BRANCH}"'"}]]}'
      send_telegram_photo "https://w.wallhaven.cc/full/y8/wallhaven-y8d1lg.png" "🗑 <b>BRANCH DIHAPUS</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🌿 Branch: <code>${target}</code>
🕐 ${_ts_db}" "$_btn_db" 2>/dev/null &
    else
      echo -e "  ${C_RED}❌ Gagal hapus remote${C_RESET}"
      echo -e "  ${C_DIM}── error log ──${C_RESET}"
      sed 's/^/    /' "$del_log" | tail -5
      fail=$((fail + 1))
    fi
    rm -f "$del_log"
  done

  # ===== Ringkasan =====
  echo ""
  echo -e "${C_DIM}  ── Ringkasan ──────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}✅ Sukses : ${ok}${C_RESET}"
  [ "$fail" -gt 0 ] && echo -e "  ${C_RED}❌ Gagal  : ${fail}${C_RESET}"

  prompt_back_or_exit
}

# ===== Menu pemilih branch (sub-menu dari opsi 1) =====
# Branch dimuat SEKALI, navigasi n/p/f/l langsung in-place tanpa re-fetch.
show_menu() {
  local _SM_PAGE="${_SM_PAGE:-1}"
  local _SM_PAGE_SIZE=8

  # ── Load branch hanya sekali di sini ──────────────────────────────────────
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   📤  UPLOAD — PILIH BRANCH      │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  _MB_SUB_FILE=$(mktemp)
  printf "Menghubungi GitHub API..." > "$_MB_SUB_FILE"
  mini_bar2_start "Memuat daftar branch ..." "Menghubungi GitHub API..." 0.06
  local branches=()
  while IFS= read -r b; do
    if [ -n "$b" ]; then
      branches+=("$b")
      printf "${#branches[@]} branch ditemukan..." > "$_MB_SUB_FILE"
    fi
  done < <(fetch_branches_recent)
  rm -f "$_MB_SUB_FILE" 2>/dev/null; _MB_SUB_FILE=""
  mini_bar2_ok "Daftar branch siap" "${#branches[@]} branch tersedia ✓"

  local total=${#branches[@]}
  local total_pages=$(( (total + _SM_PAGE_SIZE - 1) / _SM_PAGE_SIZE ))
  [ "$total_pages" -eq 0 ] && total_pages=1

  # ── Inner loop: navigasi in-place, TIDAK re-fetch ─────────────────────────
  local _sm_err=""
  while true; do
    [ "$_SM_PAGE" -gt "$total_pages" ] && _SM_PAGE=$total_pages
    [ "$_SM_PAGE" -lt 1 ]             && _SM_PAGE=1

    local start=$(( (_SM_PAGE - 1) * _SM_PAGE_SIZE ))
    local end=$(( start + _SM_PAGE_SIZE ))
    [ "$end" -gt "$total" ] && end="$total"

    clear >/dev/tty 2>/dev/null || true
    echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
    echo -e "${C_BOLD}│   📤  UPLOAD — PILIH BRANCH      │${C_RESET}"
    echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
    echo ""
    echo -e "  ${C_DIM}repo  ${C_RESET}${C_BOLD}${USER}/${REPO}${C_RESET}"
    if [ "$total_pages" -gt 1 ]; then
      echo -e "  ${C_DIM}posisi${C_RESET} ${C_BOLD}$(( start + 1 ))–${end}${C_RESET}${C_DIM} dari ${total} branch  •  hal ${_SM_PAGE}/${total_pages}${C_RESET}"
    else
      echo -e "  ${C_DIM}total ${C_RESET}${C_BOLD}${total} branch${C_RESET}"
    fi
    echo ""
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"

    local i
    for (( i=start; i<end; i++ )); do
      local b="${branches[$i]}"
      local num=$(( i + 1 ))
      if [ "$b" = "$DEFAULT_BRANCH" ]; then
        printf "  ${C_GREEN}%2d${C_RESET} ${C_BOLD}›${C_RESET} %s  ${C_DIM}(default)${C_RESET}\n" "$num" "$b"
      else
        printf "  ${C_CYAN}%2d${C_RESET} ${C_BOLD}›${C_RESET} %s\n" "$num" "$b"
      fi
    done

    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    if [ "$total_pages" -gt 1 ]; then
      local _nav=""
      [ "$_SM_PAGE" -lt "$total_pages" ] && _nav="${_nav}  ${C_CYAN}n${C_RESET} › Berikutnya"
      [ "$_SM_PAGE" -gt 1 ]              && _nav="${_nav}   ${C_CYAN}p${C_RESET} › Sebelumnya"
      [ -n "$_nav" ] && echo -e "$_nav"
      echo -e "  ${C_CYAN}f${C_RESET} › Awal   ${C_CYAN}l${C_RESET} › Akhir   ${C_DIM}h<angka> → loncat hal  (mis: h3)${C_RESET}"
    fi
    echo -e "  ${C_YELLOW} A${C_RESET} ${C_BOLD}›${C_RESET} Semua branch"
    echo -e "  ${C_GREEN} D${C_RESET} ${C_BOLD}›${C_RESET} Default  ${C_DIM}(${DEFAULT_BRANCH})${C_RESET}"
    echo -e "  ${C_RED} 0${C_RESET} ${C_BOLD}›${C_RESET} Kembali"
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    printf "  ${C_DIM}💡 Ketik nomor atau nama branch langsung${C_RESET}\n"
    # Tampilkan error (jika ada) tepat di atas prompt, lalu hapus
    [ -n "$_sm_err" ] && printf "  ${C_RED}✖ %s${C_RESET}\n" "$_sm_err"
    _sm_err=""
    printf "  ${C_BOLD}▸ ${C_RESET}"

    local choice
    read -r choice </dev/tty
    choice=$(printf '%s' "${choice:-D}" | tr -d '\r\n')

    case "$choice" in
      n|N)
        if [ "$_SM_PAGE" -lt "$total_pages" ]; then
          _SM_PAGE=$(( _SM_PAGE + 1 ))
        else
          _sm_err="Sudah di halaman terakhir"
        fi
        ;;
      p|P)
        if [ "$_SM_PAGE" -gt 1 ]; then
          _SM_PAGE=$(( _SM_PAGE - 1 ))
        else
          _sm_err="Sudah di halaman pertama"
        fi
        ;;
      f|F) _SM_PAGE=1 ;;
      l|L) _SM_PAGE=$total_pages ;;
      h*|H*)
        local _pg_jump="${choice:1}"
        if echo "$_pg_jump" | grep -qE '^[0-9]+$' && [ "$_pg_jump" -ge 1 ] && [ "$_pg_jump" -le "$total_pages" ]; then
          _SM_PAGE=$_pg_jump
        else
          _sm_err="Halaman tidak valid (1–${total_pages})"
        fi
        ;;
      0|q|Q|exit) goodbye_prompt; return ;;
      a|A) SELECTED_BRANCHES=("${branches[@]}"); return ;;
      d|D|"") SELECTED_BRANCHES=("$DEFAULT_BRANCH"); return ;;
      *)
        if echo "$choice" | grep -qE '^[0-9]+$' && [ "$choice" -ge 1 ] && [ "$choice" -le "$total" ]; then
          SELECTED_BRANCHES=("${branches[$((choice - 1))]}")
          return
        else
          # Coba cocokkan nama branch langsung
          local _found=0 _fb
          for _fb in "${branches[@]}"; do
            if [ "$_fb" = "$choice" ]; then
              SELECTED_BRANCHES=("$_fb"); _found=1; break
            fi
          done
          [ "$_found" -eq 1 ] && return
          _sm_err="Pilihan tidak valid: '${choice}'"
        fi
        ;;
    esac
    # n/p/f/l/h/error → ulangi loop (redraw in-place, tidak re-fetch)
  done
}

# ===== Goodbye prompt (bisa balik cepat dengan ketik 1) =====
goodbye_prompt() {
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}1${C_RESET} ${C_BOLD}›${C_RESET} Kembali ke menu"
  echo -e "  ${C_RED}0${C_RESET} ${C_BOLD}›${C_RESET} Keluar"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local back
  read -r back
  back="${back:-1}"
  case "$back" in
    1|y|Y|yes|menu|m|M)
      main_loop
      ;;
    *)
      echo -e "${C_DIM}Bye 👋${C_RESET}"
      exit 0
      ;;
  esac
}

# ===== Commit semua perubahan pending di branch SEKARANG (sekali, sebelum loop push) =====
# Return 0 = ada/tidak ada perubahan, semua handled. Return 1 = error fatal.
# Set var global: COMMIT_DONE (yes/no), HEAD_SHA
commit_pending_changes() {
  COMMIT_DONE="no"

  # ===== STEP 1: Scan working tree real-time =====
  local pre_scan
  pre_scan=$(scan_changes)
  count_changes "$pre_scan"
  local pre_total=$CH_TOTAL

  echo -e "${C_BOLD}🔍 Scan working tree${C_RESET} ${C_DIM}(branch: $(git rev-parse --abbrev-ref HEAD 2>/dev/null))${C_RESET}"

  if [ "$pre_total" -gt 0 ]; then
    echo -e "  ${C_CYAN}▸${C_RESET} ${C_BOLD}${pre_total}${C_RESET} file berubah ${C_DIM}(➕${CH_NEW} ✏️${CH_MOD} ❌${CH_DEL} ⚙️${CH_REN})${C_RESET}"
    print_changes_preview
  else
    echo -e "  ${C_DIM}▸ 0 perubahan di working tree${C_RESET}"
  fi

  # ===== STEP 1.5: Scan file yang ke-ignore tapi baru diubah (warning aja) =====
  scan_ignored_recent
  print_ignored_preview

  # ===== STEP 2: Stage semua perubahan =====
  if ! prepare_stage; then
    echo -e "  ${C_RED}❌ Gagal stage perubahan${C_RESET}"
    return 1
  fi

  # ===== STEP 3: Verifikasi index =====
  local has_staged="no"
  if ! git diff --cached --quiet 2>/dev/null; then
    has_staged="yes"
  fi

  if [ "$pre_total" -gt 0 ] && [ "$has_staged" = "no" ]; then
    echo -e "  ${C_YELLOW}⚠️  ${pre_total} file berubah di disk tapi tidak ke-stage${C_RESET}"
    echo -e "  ${C_DIM}   → biasanya ke-block .gitignore. Liat warning '🚫' di atas.${C_RESET}"
  fi

  # ===== STEP 4: Commit kalau ada yang di-stage =====
  if [ "$has_staged" = "yes" ]; then
    local staged_total
    staged_total=$(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')
    echo -e "  ${C_CYAN}▸${C_RESET} ${C_BOLD}${staged_total}${C_RESET} file siap di-commit"

    # Tampilkan preview file yang akan di-commit & minta konfirmasi.
    if ! preview_staged_confirm; then
      COMMIT_DONE="no"
      return 1
    fi

    local MSG
    if [ -n "$CUSTOM_MSG" ]; then
      MSG="$CUSTOM_MSG"
    else
      MSG=$(classify_commit)
    fi

    mini_bar_start "Menyimpan commit ..." 0.006
    if ! git commit -q -m "$MSG" 2>/dev/null; then
      mini_bar_fail "git commit gagal"
      return 1
    fi
    mini_bar_ok "${MSG}"
    COMMIT_DONE="yes"
  fi

  HEAD_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "?")
  return 0
}

# ===== Push HEAD lokal ke branch tujuan di remote (TANPA pindah branch lokal) =====
# Pakai pushspec `HEAD:refs/heads/<branch>` → kirim apapun yang lagi di HEAD
# ke branch tujuan, gak peduli nama branch lokal apa. Ini bikin user bisa
# kerja di branch X dan upload ke main/V14/dll dengan konten yang sama persis.
push_head_to_branch() {
  local branch="$1"
  echo ""
  echo -e "${C_BOLD}${USER}/${REPO} → ${C_GREEN}${branch}${C_RESET}${C_BOLD} (upload HEAD ${HEAD_SHA})${C_RESET}"

  # Cek apakah HEAD sudah sama dengan origin/branch (no-op).
  git fetch origin "$branch" --quiet 2>/dev/null || true
  if git show-ref --verify --quiet "refs/remotes/origin/${branch}"; then
    local local_sha remote_sha
    local_sha=$(git rev-parse HEAD 2>/dev/null)
    remote_sha=$(git rev-parse "refs/remotes/origin/${branch}" 2>/dev/null)
    if [ "$local_sha" = "$remote_sha" ] && [ "$COMMIT_DONE" = "no" ]; then
      echo -e "  ${C_DIM}ℹ️  HEAD sudah identik dengan origin/${branch}${C_RESET}"
      echo -e "  ${C_GREEN}✅ Sudah up-to-date${C_RESET} → ${C_BLUE}https://github.com/${USER}/${REPO}/tree/${branch}${C_RESET}"
      return 0
    fi

    # ── Deteksi konflik sebelum push ──────────────────────────────────────────
    # Hitung berapa commit remote yang tidak ada di lokal (behind),
    # dan berapa commit lokal yang belum di-push (ahead).
    local _behind_count _ahead_count
    _behind_count=$(git rev-list --count "HEAD..refs/remotes/origin/${branch}" 2>/dev/null || echo "0")
    _ahead_count=$(git rev-list --count  "refs/remotes/origin/${branch}..HEAD"  2>/dev/null || echo "0")
    # Bersihkan jadi angka murni, hindari error aritmatik
    _behind_count=$(printf '%s' "$_behind_count" | tr -cd '0-9'); _behind_count="${_behind_count:-0}"
    _ahead_count=$(printf '%s'  "$_ahead_count"  | tr -cd '0-9'); _ahead_count="${_ahead_count:-0}"

    if [ "$_behind_count" -gt 0 ] 2>/dev/null; then
      echo ""
      echo -e "  ${C_YELLOW}⚠️  Remote ${C_BOLD}${branch}${C_RESET}${C_YELLOW} punya ${C_BOLD}${_behind_count}${C_RESET}${C_YELLOW} commit yang tidak ada di lokal${C_RESET}"
      echo -e "  ${C_DIM}   Lokal : ↑${_ahead_count} commit belum di-push${C_RESET}"
      echo -e "  ${C_DIM}   Remote: ↑${_behind_count} commit belum di-pull${C_RESET}"
      echo ""
      echo -e "  ${C_GREEN}f${C_RESET} › Force push — file lokal menang ${C_DIM}(histori remote ditimpa)${C_RESET}"
      echo -e "  ${C_CYAN}s${C_RESET} › Skip branch ini"
      echo -e "  ${C_DIM}────────────────────────────────${C_RESET}"
      printf "  ${C_BOLD}▸ ${C_RESET}"
      local _conf_ans
      read -r _conf_ans </dev/tty
      echo ""
      _conf_ans=$(printf '%s' "$_conf_ans" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
      if [ "$_conf_ans" != "f" ]; then
        echo -e "  ${C_CYAN}↩ Branch ${C_BOLD}${branch}${C_RESET}${C_CYAN} di-skip${C_RESET}"
        return 0
      fi
      echo -e "  ${C_YELLOW}⚡ Force push dipilih — lanjut...${C_RESET}"
      echo ""
    fi
    # ─────────────────────────────────────────────────────────────────────────
  fi

  local push_log
  push_log=$(mktemp)

  # Ambil info commit untuk log
  local _log_msg _log_files
  _log_msg=$(git log -1 --format='%s' 2>/dev/null | cut -c1-40 || echo "-")
  _log_files=$(git diff --name-only HEAD~1 HEAD 2>/dev/null | wc -l | tr -d ' ')

  # Build detail file/folder (real-time dari last commit)
  local _push_detail; _push_detail=$(_build_push_detail 2>/dev/null || true)

  # Coba normal push dulu (fast-forward).
  local _tg_ts; _tg_ts=$(date '+%H:%M:%S %d %b %Y')
  progress_start "Upload → ${branch}" 10 "📤"
  git push origin "HEAD:refs/heads/${branch}" >"$push_log" 2>&1
  local _push_rc=$?
  progress_stop "$( [ $_push_rc -eq 0 ] && echo ok || echo fail )"
  if [ $_push_rc -eq 0 ]; then
    echo -e "  ${C_GREEN}🎉 Sukses!${C_RESET} ${C_BOLD}${branch}${C_RESET} ${C_DIM}(${HEAD_SHA})${C_RESET}"
    echo -e "  ${C_BLUE}🔗 https://github.com/${USER}/${REPO}/tree/${branch}${C_RESET}"
    log_push_event "$branch" "OK" "$_log_msg" "$_log_files"
    local _btn_pbr='{"inline_keyboard":[[{"text":"🔗 Lihat Branch","url":"https://github.com/'"${USER}"'/'"${REPO}"'/tree/'"${branch}"'"},{"text":"📊 Commits","url":"https://github.com/'"${USER}"'/'"${REPO}"'/commits/'"${branch}"'"}],[{"text":"🔀 Compare","url":"https://github.com/'"${USER}"'/'"${REPO}"'/compare"},{"text":"📥 Pull Request","url":"https://github.com/'"${USER}"'/'"${REPO}"'/pulls"}]]}'
    send_telegram_photo "https://w.wallhaven.cc/full/yj/wallhaven-yje2lk.png" "✅ <b>PUSH BERHASIL</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🌿 Branch: <code>${branch}</code>
📝 ${_log_msg}
${_push_detail}
🕐 ${_tg_ts}" "$_btn_pbr"
    return 0
  fi

  # Gagal — kemungkinan non-fast-forward.
  # SOLUSI: buat commit baru di atas histori remote (TIDAK timpa histori).
  echo -e "  ${C_YELLOW}⚠️  Branch divergent, sambung histori remote...${C_RESET}"

  mini_bar_start "Fetch remote ..." 0.03
  git fetch origin "$branch" --quiet 2>/dev/null || true
  mini_bar_ok "Fetch selesai"

  local _tree _remote_parent _new_commit
  _tree=$(git rev-parse "HEAD^{tree}" 2>/dev/null)
  _remote_parent=$(git rev-parse "refs/remotes/origin/${branch}" 2>/dev/null)

  if [ -n "$_tree" ] && [ -n "$_remote_parent" ]; then
    mini_bar_start "Sambung histori remote ..." 0.005
    _new_commit=$(GIT_AUTHOR_NAME="$(git log -1 --format='%an')" \
                  GIT_AUTHOR_EMAIL="$(git log -1 --format='%ae')" \
                  GIT_COMMITTER_NAME="$(git log -1 --format='%cn')" \
                  GIT_COMMITTER_EMAIL="$(git log -1 --format='%ce')" \
                  git commit-tree "$_tree" -p "$_remote_parent" -m "$_log_msg" 2>/dev/null)
    mini_bar_ok "Histori tersambung"
  fi

  if [ -n "${_new_commit:-}" ]; then
    progress_start "Upload → ${branch}" 10 "📤"
    git push origin "${_new_commit}:refs/heads/${branch}" >"$push_log" 2>&1
    local _graft_rc=$?
    progress_stop "$( [ $_graft_rc -eq 0 ] && echo ok || echo fail )"
  else
    local _graft_rc=1
  fi

  if [ "${_graft_rc:-1}" -eq 0 ]; then
    rm -f "$push_log"
    local _new_sha="${_new_commit:0:7}"
    echo -e "  ${C_GREEN}🎉 Sukses!${C_RESET} ${C_BOLD}${branch}${C_RESET} ${C_DIM}(${_new_sha} • histori terjaga)${C_RESET}"
    echo -e "  ${C_BLUE}🔗 https://github.com/${USER}/${REPO}/tree/${branch}${C_RESET}"
    log_push_event "$branch" "OK(graft)" "$_log_msg" "$_log_files"
    local _btn_pgraft='{"inline_keyboard":[[{"text":"🔗 Lihat Branch","url":"https://github.com/'"${USER}"'/'"${REPO}"'/tree/'"${branch}"'"},{"text":"📊 Commits","url":"https://github.com/'"${USER}"'/'"${REPO}"'/commits/'"${branch}"'"}],[{"text":"🔀 Compare","url":"https://github.com/'"${USER}"'/'"${REPO}"'/compare"},{"text":"📥 Pull Request","url":"https://github.com/'"${USER}"'/'"${REPO}"'/pulls"}]]}'
    send_telegram_photo "https://w.wallhaven.cc/full/yj/wallhaven-yje2lk.png" "✅ <b>PUSH BERHASIL</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🌿 Branch: <code>${branch}</code>
📝 ${_log_msg}
${_push_detail}
✔️ Histori remote tetap terjaga
🕐 ${_tg_ts}" "$_btn_pgraft"
    return 0
  fi

  # Terakhir: force push (hanya kalau graft gagal, misal branch baru/kosong di remote)
  echo -e "  ${C_YELLOW}⚠️  Coba force push sebagai langkah terakhir...${C_RESET}"
  progress_start "Force Upload → ${branch}" 12 "⚡"
  git push --force-with-lease origin "HEAD:refs/heads/${branch}" >"$push_log" 2>&1
  local _force_rc=$?
  progress_stop "$( [ $_force_rc -eq 0 ] && echo ok || echo fail )"
  if [ "$_force_rc" -eq 0 ]; then
    rm -f "$push_log"
    echo -e "  ${C_GREEN}🎉 Sukses!${C_RESET} ${C_BOLD}${branch}${C_RESET} ${C_DIM}(${HEAD_SHA})${C_RESET}"
    echo -e "  ${C_BLUE}🔗 https://github.com/${USER}/${REPO}/tree/${branch}${C_RESET}"
    log_push_event "$branch" "OK(force)" "$_log_msg" "$_log_files"
    local _btn_pforce='{"inline_keyboard":[[{"text":"🔗 Lihat Branch","url":"https://github.com/'"${USER}"'/'"${REPO}"'/tree/'"${branch}"'"},{"text":"📊 Commits","url":"https://github.com/'"${USER}"'/'"${REPO}"'/commits/'"${branch}"'"}],[{"text":"⚠️ Security","url":"https://github.com/'"${USER}"'/'"${REPO}"'/security"},{"text":"🔀 Compare","url":"https://github.com/'"${USER}"'/'"${REPO}"'/compare"}]]}'
    send_telegram_photo "https://w.wallhaven.cc/full/yj/wallhaven-yjr3kk.png" "⚡ <b>PUSH BERHASIL (FORCE)</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🌿 Branch: <code>${branch}</code>
📝 ${_log_msg}
${_push_detail}
⚠️ Force push — history lama ditimpa
🕐 ${_tg_ts}" "$_btn_pforce"
    return 0
  fi

  # Deteksi error khusus: GitHub Secret Scanning
  if grep -q "secret" "$push_log" 2>/dev/null; then
    local unblock_url
    unblock_url=$(grep -o 'https://github.com[^ ]*unblock-secret[^ ]*' "$push_log" 2>/dev/null | head -1)
    echo ""
    echo -e "  ${C_RED}🔐 Push ditolak — GitHub menemukan token di history commit lama!${C_RESET}"
    echo -e "  ${C_DIM}   (.token.secret kamu AMAN — bukan itu masalahnya)${C_RESET}"
    echo ""
    echo -e "  ${C_BOLD}✅ Solusi: klik link ini lalu pilih 'Allow secret'${C_RESET}"
    if [ -n "$unblock_url" ]; then
      echo -e "  ${C_BLUE}${unblock_url}${C_RESET}"
    else
      echo -e "  ${C_DIM}Cek di: https://github.com/${USER}/${REPO}/security/secret-scanning${C_RESET}"
    fi
    echo -e "  ${C_DIM}   Setelah allow → jalankan push.sh lagi, langsung bisa.${C_RESET}"
    echo ""
    local _tg_ts_secret; _tg_ts_secret=$(date '+%H:%M:%S %d %b %Y')
    local _unblock_btn_url="${unblock_url:-https://github.com/${USER}/${REPO}/security/secret-scanning}"
    local _btn_secret='{"inline_keyboard":[[{"text":"🔓 Allow Secret","url":"'"${_unblock_btn_url}"'"},{"text":"🔒 Secret Scanning","url":"https://github.com/'"${USER}"'/'"${REPO}"'/security/secret-scanning"}],[{"text":"🔑 Kelola Token","url":"https://github.com/settings/tokens"},{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"}]]}'
    send_telegram_photo "https://w.wallhaven.cc/full/e7/wallhaven-e7k68k.jpg" "🔐 <b>PUSH DITOLAK — SECRET SCANNING</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🌿 Branch: <code>${branch}</code>
📝 ${_log_msg}
⚠️ GitHub mendeteksi token/secret di commit
━━━━━━━━━━━━━━━━━━━━
✅ Klik <b>Allow Secret</b> lalu push ulang
🕐 ${_tg_ts_secret}" "$_btn_secret" 2>/dev/null &
  else
    echo -e "  ${C_RED}❌ Gagal push ke ${branch}${C_RESET}"
    echo -e "  ${C_DIM}── error log ──${C_RESET}"
    sed 's/^/    /' "$push_log" | tail -10
    echo ""
    local _tg_ts_reject; _tg_ts_reject=$(date '+%H:%M:%S %d %b %Y')
    local _err_snippet; _err_snippet=$(tail -3 "$push_log" 2>/dev/null | tr '\n' ' ' | sed 's/  */ /g')
    local _btn_reject='{"inline_keyboard":[[{"text":"📋 Action Logs","url":"https://github.com/'"${USER}"'/'"${REPO}"'/actions"},{"text":"🐛 Issues","url":"https://github.com/'"${USER}"'/'"${REPO}"'/issues"}],[{"text":"🔑 Kelola Token","url":"https://github.com/settings/tokens"},{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"}]]}'
    send_telegram_photo "https://w.wallhaven.cc/full/x8/wallhaven-x81dxo.jpg" "🚫 <b>PUSH DITOLAK GITHUB</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🌿 Branch: <code>${branch}</code>
📝 ${_log_msg}
━━━━━━━━━━━━━━━━━━━━
⚠️ Error: <code>${_err_snippet}</code>
💡 Cek token / izin repo / proteksi branch
🕐 ${_tg_ts_reject}" "$_btn_reject" 2>/dev/null &
  fi
  log_push_event "$branch" "FAIL" "$_log_msg" "$_log_files"
  rm -f "$push_log"
  return 1
}

# ===== Jalankan upload sesuai pilihan =====
# Alur baru: commit SEKALI di branch sekarang, lalu push HEAD itu ke
# semua branch tujuan. Gak ada switch branch — kerjamu aman.
run_upload() {
  local count=${#SELECTED_BRANCHES[@]}
  local ok=0 fail=0

  if [ "$count" -gt 1 ]; then
    echo ""
    echo -e "${C_MAGENTA}▶ Mode multi-branch${C_RESET} ${C_DIM}(${count} branch tujuan • konten sama untuk semua)${C_RESET}"
  fi

  echo ""
  # Commit perubahan pending di branch SEKARANG (cuma sekali).
  if ! commit_pending_changes; then
    echo -e "${C_RED}❌ Commit gagal, batal push.${C_RESET}"
    return 1
  fi

  # Loop push HEAD ke semua branch tujuan.
  for b in "${SELECTED_BRANCHES[@]}"; do
    if push_head_to_branch "$b"; then
      ok=$((ok + 1))
    else
      fail=$((fail + 1))
    fi
  done

  if [ "$count" -gt 1 ]; then
    echo ""
    echo -e "${C_BOLD}─── Ringkasan ───${C_RESET}"
    echo -e "  ${C_GREEN}✅ Sukses : ${ok}${C_RESET}"
    [ "$fail" -gt 0 ] && echo -e "  ${C_RED}❌ Gagal  : ${fail}${C_RESET}"
  fi

  prompt_back_or_exit
}

# ===== Action: Bersihkan node_modules dari git history =====
action_cleanup_node_modules() {
  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   🧹  BERSIHKAN node_modules     │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""

  # Cek apakah node_modules ada di git history
  mini_bar_start "Scan git history ..." 0.02
  local nm_in_history
  nm_in_history=$(git log --all --oneline --diff-filter=A -- 'node_modules/**' 2>/dev/null | wc -l | tr -d ' ')
  mini_bar_ok "Scan selesai"

  if [ "$nm_in_history" -eq 0 ]; then
    echo ""
    echo -e "  ${C_GREEN}✅ History sudah bersih! node_modules tidak ditemukan di git history.${C_RESET}"
    echo -e "  ${C_DIM}   Push ke branch baru tidak akan membawa objek node_modules.${C_RESET}"
    prompt_back_or_exit
    return
  fi

  local pack_size
  pack_size=$(du -sh .git/objects 2>/dev/null | awk '{print $1}' || echo "?")

  echo ""
  echo -e "  ${C_RED}⚠️  node_modules ditemukan di ${C_BOLD}${nm_in_history}${C_RESET}${C_RED} commit dalam history!${C_RESET}"
  echo -e "  ${C_DIM}   Ukuran .git/objects sekarang: ${pack_size}${C_RESET}"
  echo ""
  echo -e "  ${C_BOLD}Yang akan dilakukan:${C_RESET}"
  echo -e "  ${C_DIM}  1. Hapus node_modules dari SEMUA commit di history${C_RESET}"
  echo -e "  ${C_DIM}  2. Prune objek git yang tidak terpakai${C_RESET}"
  echo -e "  ${C_DIM}  3. Compress ulang pack file (git gc)${C_RESET}"
  echo -e "  ${C_DIM}  4. Force push semua branch lokal ke GitHub${C_RESET}"
  echo ""
  echo -e "  ${C_RED}⚠️  PERINGATAN: history git lokal akan ditulis ulang!${C_RESET}"
  echo -e "  ${C_YELLOW}     History di GitHub ikut ditimpa setelah force push.${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}y${C_RESET} ${C_BOLD}›${C_RESET} Lanjut bersihkan"
  echo -e "  ${C_RED}0${C_RESET} ${C_BOLD}›${C_RESET} Batal"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"

  local confirm
  read -r confirm </dev/tty
  confirm=$(echo "$confirm" | tr -d '[:space:]' | tr '[:upper:]' '[:lower:]')
  if [ "$confirm" != "y" ]; then
    echo -e "  ${C_YELLOW}↩ Dibatalkan.${C_RESET}"
    sleep 1
    return
  fi

  echo ""

  # ── Step 1: filter-branch ──────────────────────────────────────────────
  mini_bar_start "Hapus node_modules dari semua commit ..." 0.03
  local _fb_log; _fb_log=$(mktemp)
  FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch \
    --index-filter 'git rm --cached --ignore-unmatch -r node_modules/ 2>/dev/null; true' \
    --prune-empty \
    --tag-name-filter cat \
    -- --all >"$_fb_log" 2>&1
  local _fb_rc=$?
  if [ "$_fb_rc" -eq 0 ]; then
    mini_bar_ok "Filter-branch selesai"
  else
    mini_bar_fail "Filter-branch error (lanjut...)"
    echo -e "  ${C_DIM}$(tail -3 "$_fb_log" 2>/dev/null)${C_RESET}"
  fi
  rm -f "$_fb_log"

  # ── Step 2: hapus refs/original sisa filter-branch ────────────────────
  mini_bar_start "Hapus backup refs/original ..." 0.01
  git for-each-ref --format="delete %(refname)" refs/original/ 2>/dev/null \
    | git update-ref --stdin 2>/dev/null || true
  git reflog expire --expire=now --all 2>/dev/null || true
  mini_bar_ok "Backup refs dihapus"

  # ── Step 3: gc + prune ────────────────────────────────────────────────
  mini_bar_start "Prune & compress git objects ..." 0.08
  local _gc_log; _gc_log=$(mktemp)
  git gc --prune=now --aggressive >"$_gc_log" 2>&1
  if [ $? -eq 0 ]; then
    mini_bar_ok "GC selesai"
  else
    mini_bar_fail "GC error (bisa diabaikan)"
  fi
  rm -f "$_gc_log"

  local pack_size_after
  pack_size_after=$(du -sh .git/objects 2>/dev/null | awk '{print $1}' || echo "?")

  echo ""
  echo -e "  ${C_GREEN}✅ History berhasil dibersihkan!${C_RESET}"
  echo -e "  ${C_DIM}   .git/objects: ${C_YELLOW}${pack_size}${C_RESET}${C_DIM} → ${C_GREEN}${pack_size_after}${C_RESET}"
  echo ""

  # ── Step 4: force push semua branch lokal ────────────────────────────
  echo -e "  ${C_BOLD}📤 Force push semua branch ke GitHub...${C_RESET}"
  echo -e "  ${C_DIM}   (wajib karena history lokal sudah ditulis ulang)${C_RESET}"
  echo ""

  local _branches_to_push=()
  while IFS= read -r _b2; do
    [ -n "$_b2" ] && _branches_to_push+=("$(echo "$_b2" | sed 's/^\* //')")
  done < <(git branch 2>/dev/null)

  local _ok=0 _fail=0
  for _b in "${_branches_to_push[@]}"; do
    printf "  ${C_CYAN}▸${C_RESET} force push ${C_BOLD}%s${C_RESET} ... " "$_b"
    local _pr
    _pr=$(git push --force origin "${_b}:refs/heads/${_b}" 2>&1)
    if [ $? -eq 0 ]; then
      echo -e "${C_GREEN}✅${C_RESET}"
      _ok=$((_ok + 1))
    else
      echo -e "${C_RED}❌${C_RESET}"
      echo -e "    ${C_DIM}$(echo "$_pr" | tail -2)${C_RESET}"
      _fail=$((_fail + 1))
    fi
  done

  echo ""
  echo -e "  ${C_GREEN}✅ Sukses: ${_ok}${C_RESET}   ${C_RED}❌ Gagal: ${_fail}${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}Push berikutnya ke branch baru akan JAUH lebih kecil.${C_RESET}"

  local _ts_cl; _ts_cl=$(date '+%H:%M:%S %d %b %Y')
  local _btn_cl='{"inline_keyboard":[[{"text":"📁 Buka Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"},{"text":"🌿 Branches","url":"https://github.com/'"${USER}"'/'"${REPO}"'/branches"}],[{"text":"📊 Commits","url":"https://github.com/'"${USER}"'/'"${REPO}"'/commits/'"${DEFAULT_BRANCH}"'"},{"text":"📈 Insights","url":"https://github.com/'"${USER}"'/'"${REPO}"'/pulse"}]]}'
  send_telegram_photo "https://w.wallhaven.cc/full/g7/wallhaven-g7mj5l.jpg" "🧹 <b>HISTORY DIBERSIHKAN</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🧹 node_modules dihapus dari history
💾 Pack: ${pack_size} → ${pack_size_after}
✅ ${_ok} branch ter-force-push
🕐 ${_ts_cl}" "$_btn_cl" 2>/dev/null &

  prompt_back_or_exit
}

# ===== Action: Releases & Tags =====
action_releases_tags() {
  # ── header lokal ─────────────────────────────────────────────────────────
  _rt_header() {
    clear >/dev/tty 2>/dev/null || true
    echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
    echo -e "${C_BOLD}│   🏷️   RELEASES & TAGS            │${C_RESET}"
    echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
    echo ""
    echo -e "  ${C_DIM}📁 Repo :${C_RESET} ${C_BOLD}${USER}/${REPO}${C_RESET}"
    echo ""
  }

  # ── sub-menu pilihan ─────────────────────────────────────────────────────
  _rt_menu() {
    _rt_header
    echo -e "  ${C_DIM}🚀 RELEASE${C_RESET}"
    echo -e "  ${C_DIM}──────────────────────────────────${C_RESET}"
    echo -e "  ${C_GREEN} 1${C_RESET} ${C_BOLD}›${C_RESET} Lihat semua releases"
    echo -e "  ${C_CYAN} 2${C_RESET} ${C_BOLD}›${C_RESET} Buat release baru"
    echo -e "  ${C_RED} 3${C_RESET} ${C_BOLD}›${C_RESET} Hapus release"
    echo ""
    echo -e "  ${C_DIM}🏷️  TAG${C_RESET}"
    echo -e "  ${C_DIM}──────────────────────────────────${C_RESET}"
    echo -e "  ${C_BLUE} 4${C_RESET} ${C_BOLD}›${C_RESET} Lihat semua tags"
    echo -e "  ${C_CYAN} 5${C_RESET} ${C_BOLD}›${C_RESET} Buat tag baru"
    echo -e "  ${C_RED} 6${C_RESET} ${C_BOLD}›${C_RESET} Hapus tag"
    echo ""
    echo -e "  ${C_DIM}──────────────────────────────────${C_RESET}"
    echo -e "  ${C_YELLOW} 0${C_RESET} ${C_BOLD}›${C_RESET} Kembali ke menu utama"
    echo -e "  ${C_DIM}──────────────────────────────────${C_RESET}"
    printf "  ${C_BOLD}▸ ${C_RESET}"
  }

  # ──────────────────────────────────────────────────────────────────────────
  # 1) Lihat semua releases
  # ──────────────────────────────────────────────────────────────────────────
  _rt_list_releases() {
    _rt_header
    mini_bar_start "Mengambil data releases ..." 0.05
    local TMP=/tmp/_gh_rel_$$.json
    local http
    http=$(curl -s -o "$TMP" -w "%{http_code}" \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${USER}/${REPO}/releases?per_page=20" 2>/dev/null)

    relogin_if_needed "$http" "ambil releases" || return
    if [ "$http" != "200" ]; then
      mini_bar_fail "HTTP ${http}"
      echo -e "  ${C_RED}❌ Gagal ambil releases (HTTP ${http})${C_RESET}"
      rm -f "$TMP"; prompt_back_or_exit; return
    fi
    mini_bar_ok "Releases dimuat"

    local count
    count=$(node -e "try{const d=JSON.parse(require('fs').readFileSync('$TMP','utf8'));console.log(d.length);}catch(e){console.log(0);}" 2>/dev/null)

    _rt_header
    if [ "$count" = "0" ]; then
      echo -e "  ${C_DIM}📭 Belum ada release di repo ini.${C_RESET}"
      echo -e "  ${C_DIM}   Buat release pertamamu dengan pilihan 2.${C_RESET}"
      rm -f "$TMP"; prompt_back_or_exit; return
    fi

    echo -e "  ${C_DIM}Total: ${count} release${C_RESET}"
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"

    node -e "
      const d = JSON.parse(require('fs').readFileSync('$TMP','utf8'));
      d.forEach((r, i) => {
        const badge = r.draft ? '📝Draft' : r.prerelease ? '🔶Pre' : '✅Stable';
        const dt = r.published_at ? r.published_at.slice(0,10) : '-';
        const name = r.name || r.tag_name;
        console.log('  #' + (i+1) + '  ' + badge + '  ' + r.tag_name);
        console.log('     Judul : ' + name);
        console.log('     Tanggal: ' + dt);
        console.log('     URL   : https://github.com/${USER}/${REPO}/releases/tag/' + r.tag_name);
        console.log('');
      });
    " 2>/dev/null

    rm -f "$TMP"
    prompt_back_or_exit
  }

  # ──────────────────────────────────────────────────────────────────────────
  # 2) Buat release baru
  # ──────────────────────────────────────────────────────────────────────────
  _rt_create_release() {
    _rt_header
    echo -e "  ${C_DIM}Branch/tag asal release:${C_RESET} ${C_GREEN}${DEFAULT_BRANCH}${C_RESET}"
    echo ""

    # — tag name
    echo -e "${C_DIM}  ── Tag name (contoh: v1.0.0 / V17.0) ──${C_RESET}"
    echo -e "  ${C_DIM}0 = kembali${C_RESET}"
    printf "  ${C_BOLD}▸ tag ▸ ${C_RESET}"
    local rtag; read -r rtag
    rtag=$(echo "$rtag" | tr -d '[:space:]')
    [ -z "$rtag" ] || [ "$rtag" = "0" ] && return

    # — nama release
    echo ""
    echo -e "${C_DIM}  ── Nama release (judul) ────────────────${C_RESET}"
    echo -e "  ${C_DIM}Enter = sama dengan tag${C_RESET}"
    printf "  ${C_BOLD}▸ nama ▸ ${C_RESET}"
    local rname; read -r rname
    [ -z "$rname" ] && rname="$rtag"

    # — deskripsi
    echo ""
    echo -e "${C_DIM}  ── Deskripsi / Changelog (1 baris, Enter = kosong) ─${C_RESET}"
    printf "  ${C_BOLD}▸ desc ▸ ${C_RESET}"
    local rbody; read -r rbody

    # — draft?
    echo ""
    echo -e "${C_DIM}  ── Tipe release ─────────────────────────${C_RESET}"
    echo -e "  ${C_GREEN}1${C_RESET} › Stable (langsung publik)"
    echo -e "  ${C_YELLOW}2${C_RESET} › Pre-release"
    echo -e "  ${C_DIM}3${C_RESET} › Draft (tersembunyi)"
    printf "  ${C_BOLD}▸ ${C_RESET}"
    local rtype; read -r rtype
    local is_draft="false" is_pre="false"
    case "$rtype" in
      2) is_pre="true" ;;
      3) is_draft="true" ;;
    esac

    echo ""
    mini_bar_start "Membuat release ${rtag} ..." 0.05

    local TMP=/tmp/_gh_relcreate_$$.json
    local payload
    payload=$(node -e "console.log(JSON.stringify({
      tag_name: '${rtag}',
      target_commitish: '${DEFAULT_BRANCH}',
      name: $(node -e "process.stdout.write(JSON.stringify('${rname}'))"),
      body: $(node -e "process.stdout.write(JSON.stringify('${rbody}'))"),
      draft: ${is_draft},
      prerelease: ${is_pre}
    }))" 2>/dev/null)

    local http
    http=$(curl -s -o "$TMP" -w "%{http_code}" \
      -X POST \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${USER}/${REPO}/releases" \
      -d "$payload" 2>/dev/null)

    relogin_if_needed "$http" "buat release" || return
    if [ "$http" = "201" ]; then mini_bar_ok "Release dibuat ✅"; else mini_bar_fail "HTTP ${http}"; fi
    local _rt_ts; _rt_ts=$(TZ=Asia/Jakarta date '+%d %b %Y • %H:%M WIB' 2>/dev/null || date '+%d %b %Y • %H:%M')
    if [ "$http" = "201" ]; then
      local rel_url
      rel_url=$(node -e "
        const d=JSON.parse(require('fs').readFileSync('$TMP','utf8'));
        console.log(d.html_url||'');
      " 2>/dev/null)
      echo -e "  ${C_GREEN}✅ Release ${C_BOLD}${rtag}${C_RESET}${C_GREEN} berhasil dibuat!${C_RESET}"
      [ -n "$rel_url" ] && echo -e "  ${C_BLUE}🔗 ${rel_url}${C_RESET}"
      local _tipe_label="Stable"
      [ "$is_pre" = "true" ] && _tipe_label="Pre-release"
      [ "$is_draft" = "true" ] && _tipe_label="Draft"
      local _btn_rel='{"inline_keyboard":[[{"text":"🚀 Lihat Release","url":"https://github.com/'"${USER}"'/'"${REPO}"'/releases/tag/'"${rtag}"'"},{"text":"🏷️ Semua Tags","url":"https://github.com/'"${USER}"'/'"${REPO}"'/tags"}],[{"text":"📦 Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"},{"text":"📊 Commits","url":"https://github.com/'"${USER}"'/'"${REPO}"'/commits/'"${DEFAULT_BRANCH}"'"}]]}'
      send_telegram_photo "https://w.wallhaven.cc/full/96/wallhaven-96k7j8.jpg" "🚀 <b>RELEASE BARU DIBUAT</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🏷️ Tag: <code>${rtag}</code>
📝 ${rname}
📋 ${rbody:-—}
🔖 Tipe: ${_tipe_label}
🕐 ${_rt_ts}" "$_btn_rel"
    else
      local errmsg
      errmsg=$(node -e "
        try{const d=JSON.parse(require('fs').readFileSync('$TMP','utf8'));console.log(d.message||'');}catch(e){}
      " 2>/dev/null)
      echo -e "  ${C_RED}❌ Gagal buat release (HTTP ${http})${C_RESET}"
      [ -n "$errmsg" ] && echo -e "  ${C_DIM}   ${errmsg}${C_RESET}"
    fi
    rm -f "$TMP"
    prompt_back_or_exit
  }

  # ──────────────────────────────────────────────────────────────────────────
  # 3) Hapus release
  # ──────────────────────────────────────────────────────────────────────────
  _rt_delete_release() {
    _rt_header
    echo -e "  ${C_DIM}▸ Mengambil daftar releases...${C_RESET}"
    local TMP=/tmp/_gh_reldel_$$.json
    local http
    http=$(curl -s -o "$TMP" -w "%{http_code}" \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${USER}/${REPO}/releases?per_page=20" 2>/dev/null)

    if [ "$http" != "200" ]; then
      echo -e "  ${C_RED}❌ Gagal ambil releases (HTTP ${http})${C_RESET}"
      rm -f "$TMP"; prompt_back_or_exit; return
    fi

    # Ambil list id + tag
    local ids=() tags_r=()
    while IFS=$'\t' read -r _id _tag; do
      ids+=("$_id"); tags_r+=("$_tag")
    done < <(node -e "
      const d=JSON.parse(require('fs').readFileSync('$TMP','utf8'));
      d.forEach(r=>console.log(r.id+'\t'+r.tag_name));
    " 2>/dev/null)
    rm -f "$TMP"

    _rt_header
    if [ ${#ids[@]} -eq 0 ]; then
      echo -e "  ${C_DIM}📭 Tidak ada release untuk dihapus.${C_RESET}"
      prompt_back_or_exit; return
    fi

    echo -e "  ${C_DIM}Pilih nomor release yang ingin dihapus:${C_RESET}"
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    for (( i=0; i<${#ids[@]}; i++ )); do
      echo -e "  ${C_YELLOW}$((i+1))${C_RESET} › ${tags_r[$i]}"
    done
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    echo -e "  ${C_DIM}0 = kembali${C_RESET}"
    printf "  ${C_BOLD}▸ ${C_RESET}"
    local pick; read -r pick
    pick=$(echo "$pick" | tr -d '[:space:]')
    [ -z "$pick" ] || [ "$pick" = "0" ] && return

    if ! echo "$pick" | grep -qE '^[0-9]+$' || [ "$pick" -lt 1 ] || [ "$pick" -gt ${#ids[@]} ]; then
      echo -e "  ${C_RED}✖ Pilihan tidak valid.${C_RESET}"; sleep 1; return
    fi

    local sel_id="${ids[$((pick-1))]}"
    local sel_tag="${tags_r[$((pick-1))]}"
    echo ""
    printf "  ${C_RED}⚠️  Hapus release '${sel_tag}'? (y/N) ▸ ${C_RESET}"
    local confirm; read -r confirm
    case "$confirm" in y|Y) ;; *) echo -e "  ${C_DIM}Dibatalkan.${C_RESET}"; sleep 1; return ;; esac

    echo -e "  ${C_CYAN}▸ Menghapus release...${C_RESET}"
    local del_http
    del_http=$(curl -s -o /dev/null -w "%{http_code}" \
      -X DELETE \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${USER}/${REPO}/releases/${sel_id}" 2>/dev/null)

    local _rt_ts; _rt_ts=$(TZ=Asia/Jakarta date '+%d %b %Y • %H:%M WIB' 2>/dev/null || date '+%d %b %Y • %H:%M')
    if [ "$del_http" = "204" ]; then
      echo -e "  ${C_GREEN}✅ Release ${C_BOLD}${sel_tag}${C_RESET}${C_GREEN} berhasil dihapus.${C_RESET}"
      echo -e "  ${C_DIM}   (Tag-nya masih ada — hapus dari submenu Tag jika perlu)${C_RESET}"
      local _btn_delrel='{"inline_keyboard":[[{"text":"🚀 Semua Releases","url":"https://github.com/'"${USER}"'/'"${REPO}"'/releases"},{"text":"🏷️ Semua Tags","url":"https://github.com/'"${USER}"'/'"${REPO}"'/tags"}]]}'
      send_telegram_photo "https://w.wallhaven.cc/full/l3/wallhaven-l3q6eq.png" "🗑 <b>RELEASE DIHAPUS</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🏷️ Tag: <code>${sel_tag}</code>
⚠️ Tag-nya masih ada di repo
🕐 ${_rt_ts}" "$_btn_delrel"
    else
      echo -e "  ${C_RED}❌ Gagal hapus release (HTTP ${del_http})${C_RESET}"
    fi
    prompt_back_or_exit
  }

  # ──────────────────────────────────────────────────────────────────────────
  # 4) Lihat semua tags
  # ──────────────────────────────────────────────────────────────────────────
  _rt_list_tags() {
    _rt_header
    echo -e "  ${C_DIM}▸ Mengambil data tags dari GitHub...${C_RESET}"
    local TMP=/tmp/_gh_tags_$$.json
    local http
    http=$(curl -s -o "$TMP" -w "%{http_code}" \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${USER}/${REPO}/tags?per_page=30" 2>/dev/null)

    if [ "$http" != "200" ]; then
      echo -e "  ${C_RED}❌ Gagal ambil tags (HTTP ${http})${C_RESET}"
      rm -f "$TMP"; prompt_back_or_exit; return
    fi

    local count
    count=$(node -e "try{const d=JSON.parse(require('fs').readFileSync('$TMP','utf8'));console.log(d.length);}catch(e){console.log(0);}" 2>/dev/null)

    _rt_header
    if [ "$count" = "0" ]; then
      echo -e "  ${C_DIM}📭 Belum ada tag di repo ini.${C_RESET}"
      echo -e "  ${C_DIM}   Tag otomatis terbuat saat kamu buat release baru.${C_RESET}"
      rm -f "$TMP"; prompt_back_or_exit; return
    fi

    echo -e "  ${C_DIM}Total: ${count} tag${C_RESET}"
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"

    node -e "
      const d = JSON.parse(require('fs').readFileSync('$TMP','utf8'));
      d.forEach((t, i) => {
        const sha = t.commit && t.commit.sha ? t.commit.sha.slice(0,8) : '-';
        console.log('  #' + (i+1) + '  🏷️  ' + t.name + '  ' + sha);
      });
    " 2>/dev/null

    rm -f "$TMP"
    prompt_back_or_exit
  }

  # ──────────────────────────────────────────────────────────────────────────
  # 5) Buat tag baru (lightweight tag via refs API)
  # ──────────────────────────────────────────────────────────────────────────
  _rt_create_tag() {
    _rt_header
    echo -e "  ${C_DIM}Tag akan dibuat dari tip branch:${C_RESET} ${C_GREEN}${DEFAULT_BRANCH}${C_RESET}"
    echo ""

    echo -e "${C_DIM}  ── Nama tag (contoh: v2.0.0) ─────────${C_RESET}"
    echo -e "  ${C_DIM}0 = kembali${C_RESET}"
    printf "  ${C_BOLD}▸ tag ▸ ${C_RESET}"
    local tname; read -r tname
    tname=$(echo "$tname" | tr -d '[:space:]')
    [ -z "$tname" ] || [ "$tname" = "0" ] && return

    echo -e "  ${C_CYAN}▸ Ambil SHA dari ${DEFAULT_BRANCH}...${C_RESET}"
    local SHA_TMP=/tmp/_gh_sharef_$$.json
    local sha_http sha
    sha_http=$(curl -s -o "$SHA_TMP" -w "%{http_code}" \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${USER}/${REPO}/git/ref/heads/${DEFAULT_BRANCH}" 2>/dev/null)

    if [ "$sha_http" != "200" ]; then
      echo -e "  ${C_RED}❌ Gagal ambil SHA (HTTP ${sha_http})${C_RESET}"
      rm -f "$SHA_TMP"; prompt_back_or_exit; return
    fi

    sha=$(node -e "
      const d=JSON.parse(require('fs').readFileSync('$SHA_TMP','utf8'));
      console.log(d.object&&d.object.sha?d.object.sha:'');
    " 2>/dev/null)
    rm -f "$SHA_TMP"

    if [ -z "$sha" ]; then
      echo -e "  ${C_RED}❌ SHA tidak ditemukan.${C_RESET}"
      prompt_back_or_exit; return
    fi

    echo -e "  ${C_DIM}   SHA: ${sha:0:10}...${C_RESET}"
    echo -e "  ${C_CYAN}▸ Membuat tag ${C_BOLD}${tname}${C_RESET}${C_CYAN}...${C_RESET}"

    local TMP=/tmp/_gh_tagcreate_$$.json
    local http
    http=$(curl -s -o "$TMP" -w "%{http_code}" \
      -X POST \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${USER}/${REPO}/git/refs" \
      -d "{\"ref\":\"refs/tags/${tname}\",\"sha\":\"${sha}\"}" 2>/dev/null)

    local _rt_ts; _rt_ts=$(TZ=Asia/Jakarta date '+%d %b %Y • %H:%M WIB' 2>/dev/null || date '+%d %b %Y • %H:%M')
    if [ "$http" = "201" ]; then
      echo -e "  ${C_GREEN}✅ Tag ${C_BOLD}${tname}${C_RESET}${C_GREEN} berhasil dibuat!${C_RESET}"
      echo -e "  ${C_BLUE}🔗 https://github.com/${USER}/${REPO}/releases/tag/${tname}${C_RESET}"
      local _btn_tag='{"inline_keyboard":[[{"text":"🏷️ Lihat Tag","url":"https://github.com/'"${USER}"'/'"${REPO}"'/releases/tag/'"${tname}"'"},{"text":"📋 Semua Tags","url":"https://github.com/'"${USER}"'/'"${REPO}"'/tags"}],[{"text":"🚀 Buat Release","url":"https://github.com/'"${USER}"'/'"${REPO}"'/releases/new"},{"text":"📦 Repo","url":"https://github.com/'"${USER}"'/'"${REPO}"'"}]]}'
      send_telegram_photo "https://w.wallhaven.cc/full/o5/wallhaven-o5l5j7.jpg" "🏷️ <b>TAG BARU DIBUAT</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🏷️ Tag: <code>${tname}</code>
🌿 Dari branch: <code>${DEFAULT_BRANCH}</code>
🔑 SHA: <code>${sha:0:10}...</code>
🕐 ${_rt_ts}" "$_btn_tag"
    else
      local errmsg
      errmsg=$(node -e "
        try{const d=JSON.parse(require('fs').readFileSync('$TMP','utf8'));console.log(d.message||'');}catch(e){}
      " 2>/dev/null)
      echo -e "  ${C_RED}❌ Gagal buat tag (HTTP ${http})${C_RESET}"
      [ -n "$errmsg" ] && echo -e "  ${C_DIM}   ${errmsg}${C_RESET}"
    fi
    rm -f "$TMP"
    prompt_back_or_exit
  }

  # ──────────────────────────────────────────────────────────────────────────
  # 6) Hapus tag
  # ──────────────────────────────────────────────────────────────────────────
  _rt_delete_tag() {
    _rt_header
    echo -e "  ${C_DIM}▸ Mengambil daftar tags...${C_RESET}"
    local TMP=/tmp/_gh_tagdel_$$.json
    local http
    http=$(curl -s -o "$TMP" -w "%{http_code}" \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${USER}/${REPO}/tags?per_page=30" 2>/dev/null)

    if [ "$http" != "200" ]; then
      echo -e "  ${C_RED}❌ Gagal ambil tags (HTTP ${http})${C_RESET}"
      rm -f "$TMP"; prompt_back_or_exit; return
    fi

    local tag_names=()
    while IFS= read -r _t; do
      tag_names+=("$_t")
    done < <(node -e "
      const d=JSON.parse(require('fs').readFileSync('$TMP','utf8'));
      d.forEach(t=>console.log(t.name));
    " 2>/dev/null)
    rm -f "$TMP"

    _rt_header
    if [ ${#tag_names[@]} -eq 0 ]; then
      echo -e "  ${C_DIM}📭 Tidak ada tag untuk dihapus.${C_RESET}"
      prompt_back_or_exit; return
    fi

    echo -e "  ${C_DIM}Pilih nomor tag yang ingin dihapus:${C_RESET}"
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    for (( i=0; i<${#tag_names[@]}; i++ )); do
      echo -e "  ${C_YELLOW}$((i+1))${C_RESET} › 🏷️  ${tag_names[$i]}"
    done
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    echo -e "  ${C_DIM}0 = kembali${C_RESET}"
    printf "  ${C_BOLD}▸ ${C_RESET}"
    local pick; read -r pick
    pick=$(echo "$pick" | tr -d '[:space:]')
    [ -z "$pick" ] || [ "$pick" = "0" ] && return

    if ! echo "$pick" | grep -qE '^[0-9]+$' || [ "$pick" -lt 1 ] || [ "$pick" -gt ${#tag_names[@]} ]; then
      echo -e "  ${C_RED}✖ Pilihan tidak valid.${C_RESET}"; sleep 1; return
    fi

    local sel_tag="${tag_names[$((pick-1))]}"
    echo ""
    printf "  ${C_RED}⚠️  Hapus tag '${sel_tag}'? (y/N) ▸ ${C_RESET}"
    local confirm; read -r confirm
    case "$confirm" in y|Y) ;; *) echo -e "  ${C_DIM}Dibatalkan.${C_RESET}"; sleep 1; return ;; esac

    echo -e "  ${C_CYAN}▸ Menghapus tag...${C_RESET}"
    local del_http
    del_http=$(curl -s -o /dev/null -w "%{http_code}" \
      -X DELETE \
      -H "Authorization: token ${TOKEN}" \
      -H "Accept: application/vnd.github+json" \
      -H "X-GitHub-Api-Version: 2022-11-28" \
      "https://api.github.com/repos/${USER}/${REPO}/git/refs/tags/${sel_tag}" 2>/dev/null)

    local _rt_ts; _rt_ts=$(TZ=Asia/Jakarta date '+%d %b %Y • %H:%M WIB' 2>/dev/null || date '+%d %b %Y • %H:%M')
    if [ "$del_http" = "204" ]; then
      echo -e "  ${C_GREEN}✅ Tag ${C_BOLD}${sel_tag}${C_RESET}${C_GREEN} berhasil dihapus.${C_RESET}"
      local _btn_deltag='{"inline_keyboard":[[{"text":"🏷️ Semua Tags","url":"https://github.com/'"${USER}"'/'"${REPO}"'/tags"},{"text":"🚀 Semua Releases","url":"https://github.com/'"${USER}"'/'"${REPO}"'/releases"}]]}'
      send_telegram_photo "https://w.wallhaven.cc/full/28/wallhaven-28mlj9.jpg" "🗑 <b>TAG DIHAPUS</b>
━━━━━━━━━━━━━━━━━━━━
📁 <code>${USER}/${REPO}</code>
🏷️ Tag: <code>${sel_tag}</code>
🕐 ${_rt_ts}" "$_btn_deltag"
    else
      echo -e "  ${C_RED}❌ Gagal hapus tag (HTTP ${del_http})${C_RESET}"
    fi
    prompt_back_or_exit
  }

  # ── Loop sub-menu ─────────────────────────────────────────────────────────
  while true; do
    _rt_menu
    local rpick; read -r rpick
    rpick=$(echo "$rpick" | tr -d '[:space:]')
    case "$rpick" in
      1) _rt_list_releases ;;
      2) _rt_create_release ;;
      3) _rt_delete_release ;;
      4) _rt_list_tags ;;
      5) _rt_create_tag ;;
      6) _rt_delete_tag ;;
      0|q|Q) return ;;
      *) echo -e "  ${C_RED}✖ Pilihan tidak valid.${C_RESET}"; sleep 1 ;;
    esac
  done
}

# ===== Ganti repo aktif secara realtime (opsi 14) =====
action_switch_repo() {
  local _SR_PAGE="${_SR_PAGE:-1}"
  local _SR_PAGE_SIZE=10

  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   🔄  GANTI REPO AKTIF           │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  mini_bar_start "Memuat daftar repo dari GitHub ..." 0.06

  # Ambil daftar repo milik USER via API (max 100 per halaman, sorted by updated)
  local _sr_raw
  _sr_raw=$(curl -s \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner" 2>/dev/null)

  local repos=()
  while IFS= read -r r; do
    [ -n "$r" ] && repos+=("$r")
  done < <(printf '%s' "$_sr_raw" | python3 -c '
import json,sys
try:
  data=json.load(sys.stdin)
  for r in data:
    n=r.get("full_name","")
    if n: print(n)
except: pass
' 2>/dev/null)

  if [ "${#repos[@]}" -eq 0 ]; then mini_bar_fail "Tidak ada repo"; else mini_bar_ok "${#repos[@]} repo dimuat"; fi
  local total=${#repos[@]}
  local total_pages=$(( (total + _SR_PAGE_SIZE - 1) / _SR_PAGE_SIZE ))
  [ "$total_pages" -eq 0 ] && total_pages=1
  [ "$_SR_PAGE" -gt "$total_pages" ] && _SR_PAGE=$total_pages
  [ "$_SR_PAGE" -lt 1 ] && _SR_PAGE=1

  local start=$(( (_SR_PAGE - 1) * _SR_PAGE_SIZE ))
  local end=$(( start + _SR_PAGE_SIZE ))
  [ "$end" -gt "$total" ] && end="$total"

  clear >/dev/tty 2>/dev/null || true
  echo -e "${C_BOLD}╭──────────────────────────────────╮${C_RESET}"
  echo -e "${C_BOLD}│   🔄  GANTI REPO AKTIF           │${C_RESET}"
  echo -e "${C_BOLD}╰──────────────────────────────────╯${C_RESET}"
  echo ""
  echo -e "  ${C_DIM}aktif sekarang  ${C_RESET}${C_GREEN}${C_BOLD}${USER}/${REPO}${C_RESET}"
  if [ "$total_pages" -gt 1 ]; then
    echo -e "  ${C_DIM}repo            ${C_RESET}${C_BOLD}$(( start + 1 ))–${end}${C_RESET}${C_DIM} dari ${total}  •  hal ${_SR_PAGE}/${total_pages}${C_RESET}"
  else
    echo -e "  ${C_DIM}total           ${C_RESET}${C_BOLD}${total} repo${C_RESET}"
  fi
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"

  if [ "$total" -eq 0 ]; then
    echo -e "  ${C_YELLOW}⚠️  Tidak bisa memuat repo. Cek token / koneksi.${C_RESET}"
    echo ""
    echo -e "  ${C_DIM}💡 Atau ketik langsung: ${C_RESET}${C_BOLD}user/repo${C_RESET}${C_DIM} lalu Enter${C_RESET}"
    echo -e "  ${C_RED} 0${C_RESET} ${C_BOLD}›${C_RESET} Kembali ke menu"
    echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
    printf "  ${C_BOLD}user/repo  [0 = kembali] ▸ ${C_RESET}"
    local _pick_manual
    read -r _pick_manual
    _pick_manual=$(echo "$_pick_manual" | tr -d '[:space:]')
    if [ -z "$_pick_manual" ] || [ "$_pick_manual" = "0" ]; then
      echo -e "${C_YELLOW}↩ Kembali ke menu.${C_RESET}"
      sleep 1
      return
    fi
    _sr_apply_switch "$_pick_manual"
    return
  fi

  for (( i=start; i<end; i++ )); do
    local _rn="${repos[$i]}"
    local _marker=""
    [ "$_rn" = "${USER}/${REPO}" ] && _marker=" ${C_GREEN}← aktif${C_RESET}"
    printf "  ${C_CYAN}%2d${C_RESET} ${C_BOLD}›${C_RESET} %s%b\n" "$(( i + 1 ))" "$_rn" "$_marker"
  done

  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  if [ "$total_pages" -gt 1 ]; then
    local _nav_sr=""
    [ "$_SR_PAGE" -lt "$total_pages" ] && _nav_sr="${_nav_sr}  ${C_CYAN}n${C_RESET} › Berikutnya"
    [ "$_SR_PAGE" -gt 1 ]              && _nav_sr="${_nav_sr}   ${C_CYAN}p${C_RESET} › Sebelumnya"
    [ -n "$_nav_sr" ] && echo -e "$_nav_sr"
    echo -e "  ${C_CYAN}f${C_RESET} › Awal   ${C_CYAN}l${C_RESET} › Akhir   ${C_DIM}h<angka> → loncat hal  (mis: h3)${C_RESET}"
  fi
  echo -e "  ${C_DIM}💡 Ketik nomor dari list ATAU ketik langsung: ${C_BOLD}user/repo${C_RESET}${C_DIM} / ${C_BOLD}namaRepo${C_RESET}"
  echo -e "  ${C_RED} 0${C_RESET} ${C_BOLD}›${C_RESET} Kembali ke menu"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}Nomor / user/repo ▸ ${C_RESET}"

  local pick
  read -r pick
  pick=$(echo "$pick" | tr -d '[:space:]')

  # Navigasi halaman
  case "$pick" in
    n|N) _SR_PAGE=$(( _SR_PAGE < total_pages ? _SR_PAGE + 1 : _SR_PAGE )) action_switch_repo; return ;;
    p|P) _SR_PAGE=$(( _SR_PAGE > 1 ? _SR_PAGE - 1 : 1 )) action_switch_repo; return ;;
    f|F) _SR_PAGE=1 action_switch_repo; return ;;
    l|L) _SR_PAGE=$total_pages action_switch_repo; return ;;
    h*|H*)
      local _pg_sr="${pick:1}"
      if echo "$_pg_sr" | grep -qE '^[0-9]+$' && [ "$_pg_sr" -ge 1 ] && [ "$_pg_sr" -le "$total_pages" ]; then
        _SR_PAGE=$_pg_sr action_switch_repo
      else
        echo -e "  ${C_RED}✖ Halaman tidak valid${C_RESET} ${C_DIM}(1–${total_pages})${C_RESET}"
        sleep 1
        _SR_PAGE=$_SR_PAGE action_switch_repo
      fi
      return ;;
  esac

  if [ -z "$pick" ] || [ "$pick" = "0" ]; then
    echo -e "${C_YELLOW}↩ Kembali ke menu.${C_RESET}"
    sleep 1
    return
  fi

  # Kalau angka → ambil dari list
  if echo "$pick" | grep -qE '^[0-9]+$'; then
    if [ "$pick" -ge 1 ] && [ "$pick" -le "$total" ]; then
      _sr_apply_switch "${repos[$((pick - 1))]}"
    else
      echo -e "${C_RED}✖ Nomor tidak ada dalam list.${C_RESET}"
      sleep 2
      _SR_PAGE=$_SR_PAGE action_switch_repo
    fi
    return
  fi

  # Input langsung: bisa "repo" atau "user/repo"
  _sr_apply_switch "$pick"
}

# ── Helper: terapkan switch repo setelah target ditentukan ──
_sr_apply_switch() {
  local _target="$1"
  local _new_user _new_repo

  # Parse: kalau ada "/" anggap "user/repo", kalau tidak pakai USER aktif
  if echo "$_target" | grep -q '/'; then
    _new_user="${_target%%/*}"
    _new_repo="${_target#*/}"
  else
    _new_user="$USER"
    _new_repo="$_target"
  fi

  # Validasi karakter
  if ! echo "$_new_user" | grep -qE '^[a-zA-Z0-9_-]+$' || \
     ! echo "$_new_repo" | grep -qE '^[a-zA-Z0-9._-]+$'; then
    echo -e "  ${C_RED}✖ Format tidak valid.${C_RESET} ${C_DIM}Gunakan: user/repo atau namaRepo${C_RESET}"
    sleep 2
    return
  fi

  # Sama seperti sekarang?
  if [ "$_new_user" = "$USER" ] && [ "$_new_repo" = "$REPO" ]; then
    echo -e "  ${C_YELLOW}ℹ️  Repo '${_new_user}/${_new_repo}' sudah aktif sekarang.${C_RESET}"
    sleep 2
    return
  fi

  # Verifikasi repo ada di GitHub
  echo ""
  echo -e "  ${C_CYAN}▸${C_RESET} Memeriksa repo ${C_BOLD}${_new_user}/${_new_repo}${C_RESET} di GitHub..."
  local _check_http
  _check_http=$(curl -s -o /tmp/_gh_sr_check.json -w "%{http_code}" \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${_new_user}/${_new_repo}" 2>/dev/null)

  if [ "$_check_http" != "200" ]; then
    local _api_msg
    _api_msg=$(grep -o '"message":"[^"]*"' /tmp/_gh_sr_check.json 2>/dev/null | head -1 | sed 's/"message":"//;s/"//')
    echo -e "  ${C_RED}❌ Repo tidak ditemukan atau tidak bisa diakses (HTTP ${_check_http})${C_RESET}"
    [ -n "$_api_msg" ] && echo -e "  ${C_DIM}   GitHub: ${_api_msg}${C_RESET}"
    sleep 3
    return
  fi

  # Konfirmasi
  echo ""
  echo -e "  ${C_YELLOW}⚠️  Yakin ganti repo aktif?${C_RESET}"
  echo -e "  ${C_DIM}${USER}/${REPO}${C_RESET} ${C_BOLD}→${C_RESET} ${C_GREEN}${_new_user}/${_new_repo}${C_RESET}"
  echo -e "  ${C_DIM}Remote URL lokal ikut diperbarui otomatis.${C_RESET}"
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  echo -e "  ${C_GREEN}1${C_RESET} ${C_BOLD}›${C_RESET} Ya, ganti sekarang"
  echo -e "  ${C_RED}0${C_RESET} ${C_BOLD}›${C_RESET} Batal"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local _confirm
  read -r _confirm
  if [ "$_confirm" != "1" ]; then
    echo -e "${C_YELLOW}↩ Dibatalkan.${C_RESET}"
    sleep 1
    return
  fi

  local _old_user="$USER"
  local _old_repo="$REPO"
  local _old_default="$DEFAULT_BRANCH"

  # Terapkan ke variabel runtime
  USER="$_new_user"
  REPO="$_new_repo"

  # Simpan permanen ke push.sh (ganti baris USER= dan REPO=)
  sed -i "s|^USER=.*|USER=\"${_new_user}\"|" "$0" 2>/dev/null || true
  sed -i "s|^REPO=.*|REPO=\"${_new_repo}\"|" "$0" 2>/dev/null || true

  # Perbarui remote URL lokal + variabel REMOTE_URL di memory
  local _new_remote_url="https://${_new_user}:${TOKEN}@github.com/${_new_user}/${_new_repo}.git"
  git remote set-url origin "$_new_remote_url" 2>/dev/null || true
  REMOTE_URL="$_new_remote_url"

  # Auto-detect DEFAULT_BRANCH dari repo baru via GitHub API
  echo -e "  ${C_CYAN}▸${C_RESET} Mendeteksi default branch repo baru..."
  local _new_default
  _new_default=$(curl -s \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/repos/${_new_user}/${_new_repo}" 2>/dev/null \
    | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d.get("default_branch",""))' 2>/dev/null)

  # Fallback: pakai git ls-remote kalau API gagal
  if [ -z "$_new_default" ]; then
    _new_default=$(git ls-remote --symref origin HEAD 2>/dev/null \
      | awk '/^ref:/{print $2; exit}' \
      | sed 's|^refs/heads/||')
  fi

  if [ -n "$_new_default" ]; then
    DEFAULT_BRANCH="$_new_default"
    sed -i "s|^DEFAULT_BRANCH=.*|DEFAULT_BRANCH=\"${_new_default}\"|" "$0" 2>/dev/null || true
    echo -e "  ${C_GREEN}✅ DEFAULT_BRANCH:${C_RESET} ${C_DIM}${_old_default}${C_RESET} ${C_BOLD}→${C_RESET} ${C_GREEN}${_new_default}${C_RESET}"
  else
    echo -e "  ${C_YELLOW}⚠️  Gagal deteksi default branch, DEFAULT_BRANCH tetap: ${DEFAULT_BRANCH}${C_RESET}"
  fi

  # Fetch remote baru agar data branch & tracking up-to-date
  echo -e "  ${C_CYAN}▸${C_RESET} Fetching repo baru dari GitHub..."
  git fetch origin --quiet 2>/dev/null || true

  # Update upstream tracking branch → pakai DEFAULT_BRANCH repo baru
  # Ini yang bikin angka ahead/behind di banner jadi akurat
  local _cur_branch
  _cur_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
  if [ -n "$_cur_branch" ] && [ -n "$DEFAULT_BRANCH" ]; then
    # Cek apakah branch DEFAULT_BRANCH ada di remote baru
    if git ls-remote --exit-code --heads origin "$DEFAULT_BRANCH" >/dev/null 2>&1; then
      git branch --set-upstream-to="origin/${DEFAULT_BRANCH}" "$_cur_branch" 2>/dev/null || true
      echo -e "  ${C_GREEN}✅ Upstream tracking:${C_RESET} ${C_DIM}@{u}${C_RESET} ${C_BOLD}→${C_RESET} ${C_GREEN}origin/${DEFAULT_BRANCH}${C_RESET}"
    else
      # Branch tidak ada di repo baru — hapus upstream agar tidak error di banner
      git branch --unset-upstream "$_cur_branch" 2>/dev/null || true
      echo -e "  ${C_YELLOW}⚠️  Branch '${DEFAULT_BRANCH}' belum ada di repo baru — upstream di-reset${C_RESET}"
    fi
  fi

  echo ""
  echo -e "  ${C_GREEN}✅ Repo aktif berhasil diganti!${C_RESET}"
  echo -e "     ${C_DIM}${_old_user}/${_old_repo}${C_RESET} ${C_BOLD}→${C_RESET} ${C_GREEN}${_new_user}/${_new_repo}${C_RESET}"
  echo -e "  ${C_BLUE}🔗 https://github.com/${_new_user}/${_new_repo}${C_RESET}"
  echo -e "  ${C_DIM}USER, REPO, DEFAULT_BRANCH, REMOTE_URL & upstream tracking diperbarui.${C_RESET}"

  local _ts_sr; _ts_sr=$(date '+%H:%M:%S %d %b %Y')
  local _btn_sr='{"inline_keyboard":[[{"text":"📁 Buka Repo","url":"https://github.com/'"${_new_user}"'/'"${_new_repo}"'"},{"text":"🌿 Branches","url":"https://github.com/'"${_new_user}"'/'"${_new_repo}"'/branches"}],[{"text":"📊 Commits","url":"https://github.com/'"${_new_user}"'/'"${_new_repo}"'/commits"},{"text":"⚙️ Settings","url":"https://github.com/'"${_new_user}"'/'"${_new_repo}"'/settings"}]]}'
  send_telegram_photo "https://w.wallhaven.cc/full/jx/wallhaven-jx8p1y.png" "🔄 <b>REPO AKTIF DIGANTI</b>
━━━━━━━━━━━━━━━━━━━━
👤 <code>${_old_user}/${_old_repo}</code>
  ↓
📁 <code>${_new_user}/${_new_repo}</code>
🌿 Default: <code>${DEFAULT_BRANCH}</code>
🔗 github.com/${_new_user}/${_new_repo}
━━━━━━━━━━━━━━━━━━━━
🕐 ${_ts_sr}" "$_btn_sr" 2>/dev/null &
  sleep 2
}

# ===== Helper: prompt tunggal setelah setiap action =====
prompt_back_or_exit() {
  echo ""
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_DIM}Enter = kembali ke menu  •  ${C_RESET}${C_RED}0${C_RESET}${C_DIM} = keluar${C_RESET}\n"
  echo -e "${C_DIM}  ──────────────────────────────────${C_RESET}"
  printf "  ${C_BOLD}▸ ${C_RESET}"
  local _ans
  read -r _ans </dev/tty 2>/dev/null || read -r _ans
  case "${_ans:-}" in
    0|q|Q|exit) goodbye_prompt ;;
  esac
}

# ===== Cek token realtime — auto re-login tanpa restart script =====
check_token_realtime() {
  local http
  http=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: token ${TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2022-11-28" \
    "https://api.github.com/user" 2>/dev/null)

  # 200 = valid, 000 = no network (biarkan, bukan salah token)
  case "$http" in 200|000|"") return 0 ;; esac

  # Token invalid/expired → re-login inline
  clear >/dev/tty 2>/dev/null || true
  printf "\n"
  printf "  \033[1m╔══════════════════════════════════════╗\033[0m\n"
  printf "  \033[1m║   🔴  TOKEN EXPIRED — LOGIN ULANG    ║\033[0m\n"
  printf "  \033[1m╚══════════════════════════════════════╝\033[0m\n\n"
  printf "  \033[31mHTTP %s — Token tidak valid atau sudah kadaluarsa.\033[0m\n" "$http"
  printf "  \033[33mSilakan paste token baru — tidak perlu restart script.\033[0m\n\n"

  rm -f .token.secret 2>/dev/null
  _delete_token_backup 2>/dev/null || true

  TOKEN=$(setup_token)
  [ "$TOKEN" = "__EXIT__" ] && exit 0
  while true; do
    local _vr=0
    validate_token "$TOKEN" || _vr=$?
    [ "$_vr" -eq 0 ] || [ "$_vr" -eq 2 ] && break
    TOKEN=$(setup_token)
    [ "$TOKEN" = "__EXIT__" ] && exit 0
  done

  REMOTE_URL="https://${USER}:${TOKEN}@github.com/${USER}/${REPO}.git"
  git remote set-url origin "$REMOTE_URL" 2>/dev/null || true

  printf "\n  \033[32m✅ Re-login berhasil! Melanjutkan...\033[0m\n"
  sleep 0.8
}

# ===== Re-login otomatis jika API call mid-operation dapat 401/403 =====
relogin_if_needed() {
  local code="$1" context="${2:-operasi}"
  case "$code" in 401|403) ;; *) return 0 ;; esac

  clear >/dev/tty 2>/dev/null || true
  printf "\n"
  printf "  \033[1m╔══════════════════════════════════════╗\033[0m\n"
  printf "  \033[1m║   🔴  TOKEN EXPIRED — LOGIN ULANG    ║\033[0m\n"
  printf "  \033[1m╚══════════════════════════════════════╝\033[0m\n\n"
  printf "  \033[31mHTTP %s saat %s — Token tidak valid.\033[0m\n" "$code" "$context"
  printf "  \033[33mPaste token baru — tidak perlu restart script.\033[0m\n\n"

  rm -f .token.secret 2>/dev/null
  _delete_token_backup 2>/dev/null || true

  TOKEN=$(setup_token)
  [ "$TOKEN" = "__EXIT__" ] && exit 0
  while true; do
    local _vr=0
    validate_token "$TOKEN" || _vr=$?
    [ "$_vr" -eq 0 ] || [ "$_vr" -eq 2 ] && break
    TOKEN=$(setup_token)
    [ "$TOKEN" = "__EXIT__" ] && exit 0
  done

  REMOTE_URL="https://${USER}:${TOKEN}@github.com/${USER}/${REPO}.git"
  git remote set-url origin "$REMOTE_URL" 2>/dev/null || true

  printf "\n  \033[32m✅ Re-login berhasil! Operasi %s dapat diulang.\033[0m\n" "$context"
  sleep 0.8
  return 1
}

# ===== Loop menu utama =====
main_loop() {
  while true; do
    SELECTED_BRANCHES=()
    check_token_realtime
    show_main_menu
  done
}

# ===== Trap Ctrl+C → tawarkan masuk lagi =====
on_interrupt() {
  echo ""
  echo -e "${C_YELLOW}⚠️  Dibatalkan (Ctrl+C).${C_RESET}"
  goodbye_prompt
}
trap on_interrupt INT

main_loop