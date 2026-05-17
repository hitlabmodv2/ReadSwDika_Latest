// PM2 Ecosystem Config — Wily Bot (ReadswDika V13)
// Usage:
//   pm2 start ecosystem.config.cjs        → jalanin bot
//   pm2 logs wily-bot                     → liat log realtime
//   pm2 restart wily-bot                  → restart bot
//   pm2 stop wily-bot                     → matiin bot
//   pm2 delete wily-bot                   → hapus dari pm2 list
//   pm2 save && pm2 startup               → auto-start saat server reboot

module.exports = {
  apps: [
    {
      name: "wily-bot",
      script: "./index.js",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      min_uptime: "10s",
      max_restarts: 10,
      restart_delay: 3000,
      kill_timeout: 5000,
      env: {
        NODE_ENV: "production",
      },
      env_development: {
        NODE_ENV: "development",
      },
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      merge_logs: true,
      time: true,
    },
  ],
};
