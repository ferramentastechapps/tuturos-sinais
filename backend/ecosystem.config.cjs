module.exports = {
    apps: [
        {
            name: "signal-engine",
            script: "./dist/index.js",
            cwd: "/var/www/signal-dashboard/backend",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "1G",
            env: {
                NODE_ENV: "production",
                PORT: 3001,
                SCALPING_BOT_ENABLED: "true",
                TELEGRAM_SCALPING_CHAT_ID: "-1003869871418"
            },
            error_file: "./logs/signal-engine-error.log",
            out_file: "./logs/signal-engine-out.log",
            log_date_format: "YYYY-MM-DD HH:mm:ss",
            merge_logs: true
        },
        {
            name: "telegram-bot",
            script: "./dist/bot.js",
            cwd: "/var/www/signal-dashboard/backend",
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: "512M",
            env: {
                NODE_ENV: "production",
                SCALPING_BOT_ENABLED: "true",
                TELEGRAM_SCALPING_CHAT_ID: "-1003869871418"
            },
            error_file: "./logs/telegram-bot-error.log",
            out_file: "./logs/telegram-bot-out.log",
            log_date_format: "YYYY-MM-DD HH:mm:ss",
            merge_logs: true
        }
    ]
};
