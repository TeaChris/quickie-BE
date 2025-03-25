// src/utils/logger.ts
import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

import { ENVIRONMENT } from '@/common'

const { APP } = ENVIRONMENT

// Custom log levels and colors
const LOG_LEVELS = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
}

const LOG_COLORS = {
  fatal: 'magenta',
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'blue',
  trace: 'gray',
}

winston.addColors(LOG_COLORS)

// Base log format
const baseFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format((info) => {
    info.service = APP.NAME
    info.environment = APP.ENV
    info.processId = process.pid
    return info
  })()
)

// Development format
const devFormat = winston.format.combine(
  baseFormat,
  winston.format.colorize({ all: true }),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    let log = `${timestamp} [${level}] ${message}`
    if (stack) log += `\n${stack}`
    if (Object.keys(meta).length > 3) {
      // Skip service, environment, processId
      log += `\n${JSON.stringify(meta, null, 2)}`
    }
    return log
  })
)

// Production format
const prodFormat = winston.format.combine(baseFormat, winston.format.json())

// Transport configuration
const transports: winston.transport[] = [
  new DailyRotateFile({
    filename: 'logs/error-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '30d',
    level: 'error',
    format: prodFormat,
  }),
  new DailyRotateFile({
    filename: 'logs/combined-%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '7d',
    format: prodFormat,
  }),
]

if (NODE_ENV !== 'production') {
  transports.push(
    new winston.transports.Console({
      level: 'trace',
      format: devFormat,
    })
  )
}

// Create logger instance
const logger = winston.createLogger({
  levels: LOG_LEVELS,
  level: APP.ENV === 'production' ? 'info' : 'trace',
  transports,
  exceptionHandlers: [
    new DailyRotateFile({
      filename: 'logs/exceptions-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: prodFormat,
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      filename: 'logs/rejections-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: prodFormat,
    }),
  ],
})

// Add HTTP request logging middleware
export const httpLogger = winston.createLogger({
  levels: { http: 0 },
  transports: [
    new DailyRotateFile({
      filename: 'logs/access-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '100m',
      maxFiles: '7d',
      format: prodFormat,
    }),
  ],
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
})

// Express middleware for HTTP logging
export const expressLogger = (req: any, res: any, next: any) => {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    httpLogger.log('http', {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    })
  })

  next()
}

// Proxy console methods
console.log = (...args) => logger.info.call(logger, ...args)
console.error = (...args) => logger.error.call(logger, ...args)
console.warn = (...args) => logger.warn.call(logger, ...args)
console.info = (...args) => logger.info.call(logger, ...args)
console.debug = (...args) => logger.debug.call(logger, ...args)

export default logger
