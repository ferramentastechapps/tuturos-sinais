// Winston Logger — Structured JSON logging with daily rotation

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOG_DIR = path.resolve(__dirname, '../../logs');

const logFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
);

const consoleFormat = winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `${timestamp} [${level}]: ${message}${metaStr}`;
    })
);

const fileRotateTransport = new DailyRotateFile({
    dirname: LOG_DIR,
    filename: 'signal-engine-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    format: logFormat,
});

const errorRotateTransport = new DailyRotateFile({
    dirname: LOG_DIR,
    filename: 'signal-engine-error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
    format: logFormat,
});

export const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: 'signal-engine' },
    transports: [
        new winston.transports.Console({
            format: consoleFormat,
        }),
        fileRotateTransport,
        errorRotateTransport,
    ],
});

export const botLogger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    defaultMeta: { service: 'telegram-bot' },
    transports: [
        new winston.transports.Console({
            format: consoleFormat,
        }),
        new DailyRotateFile({
            dirname: LOG_DIR,
            filename: 'telegram-bot-%DATE%.log',
            datePattern: 'YYYY-MM-DD',
            maxSize: '20m',
            maxFiles: '30d',
            format: logFormat,
        }),
    ],
});
