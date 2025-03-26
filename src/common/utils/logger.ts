import winston from 'winston'
import DailyRotateFile from 'winston-daily-rotate-file'

import { Request, Response } from 'express'

import os from 'os'
import { v4 as uuidv4 } from 'uuid'

import { ENVIRONMENT } from '@/common'

const { APP } = ENVIRONMENT

// Enhanced log levels
const LOG_LEVELS = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
  trace: 5,
}

type LogContext = {
  who?: string // User ID or service account
  what?: string // Action being performed
  where?: string // System component
  why?: string // Business reason/error code
  requestId?: string
  [key: string]: any
}

class ContextualLogger {
  private logger: winston.Logger
  private requestId = uuidv4()
  private systemState: Record<string, unknown>

  constructor() {
    this.systemState = this.getSystemState()

    this.logger = winston.createLogger({
      levels: LOG_LEVELS,
      format: this.getLogFormat(),
      transports: this.getTransports(),
      exceptionHandlers: this.getExceptionHandlers(),
      rejectionHandlers: this.getRejectionHandlers(),
    })
  }

  private getSystemState() {
    return {
      hostname: os.hostname(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: os.cpus().length,
      load: os.loadavg(),
    }
  }

  private getLogFormat() {
    return winston.format.combine(
      winston.format.timestamp({ format: 'ISO8601' }),
      winston.format.errors({ stack: true }),
      winston.format((info) => ({
        ...info,
        ...this.systemState,
        service: APP.NAME,
        environment: APP.ENV,
        pid: process.pid,
      }))(),
      winston.format.json()
    )
  }

  private getTransports() {
    return [
      new DailyRotateFile({
        filename: 'logs/application-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '50m',
        maxFiles: '30d',
      }),
    ]
  }

  private getExceptionHandlers() {
    return [
      new DailyRotateFile({
        filename: 'logs/exceptions-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
      }),
    ]
  }

  private getRejectionHandlers() {
    return [
      new DailyRotateFile({
        filename: 'logs/rejections-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: true,
        maxSize: '20m',
        maxFiles: '30d',
      }),
    ]
  }

  // Core logging method with context
  private log(
    level: keyof typeof LOG_LEVELS,
    message: string,
    context: LogContext = {}
  ) {
    const fullContext = {
      ...context,
      requestId: this.requestId,
      where: context.where || 'application',
      why: context.why || 'operational',
      who: context.who || 'system',
    }

    this.logger.log(level, message, fullContext)
  }

  // Public methods
  public fatal(message: string, error: Error, context: LogContext = {}) {
    this.log('fatal', message, {
      ...context,
      error: this.serializeError(error),
      systemState: this.getSystemState(),
    })
  }

  public error(message: string, error: Error, context: LogContext = {}) {
    this.log('error', message, {
      ...context,
      error: this.serializeError(error),
    })
  }

  public warn(message: string, context: LogContext = {}) {
    this.log('warn', message, context)
  }

  public info(message: string, context: LogContext = {}) {
    this.log('info', message, context)
  }

  public debug(message: string, context: LogContext = {}) {
    this.log('debug', message, context)
  }

  private serializeError(error: Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      ...(error as any).toJSON?.(),
    }
  }

  // Express middleware for request context
  public expressLogger() {
    return (req: Request, res: Response, next: Function) => {
      const requestId = uuidv4()
      const start = Date.now()

      res.locals.logContext = {
        requestId,
        who: req.user?._id || 'unauthenticated',
        what: `${req.method} ${req.route?.path || req.originalUrl}`,
        where: 'http',
        why: 'request_processing',
      }

      res.setHeader('X-Request-ID', requestId)

      res.on('finish', () => {
        const duration = Date.now() - start
        this.logger.info('request_completed', {
          ...res.locals.logContext,
          statusCode: res.statusCode,
          duration,
          userAgent: req.headers['user-agent'],
          ip: req.ip,
        })
      })

      next()
    }
  }
}

export const logger = new ContextualLogger()

export const stream = {
  write: (message: string) => {
    logger.info(message.trim())
  },
}
