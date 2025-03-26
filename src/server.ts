///////////////////////////////////////////////////////////////////////
// DO NOT CHANGE THE ORDER OF THE IMPORTS;
// DOT ENV AND MODULE ALIAS WILL NOT WORK PROPERLY UNLESS THEY ARE IMPORTED FIRST

import * as dotenv from 'dotenv'
dotenv.config()
if (process.env.NODE_ENV === 'production') {
  require('module-alias/register')
}

///////////////////////////////////////////////////////////////////////

import os from 'os'
import http from 'http'

import hpp from 'hpp'
import cors from 'cors'
import morgan from 'morgan'
import express, { NextFunction } from 'express'
import cluster from 'cluster'
import mongoose from 'mongoose'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import helmet, { HelmetOptions } from 'helmet'
import mongoSanitize from 'express-mongo-sanitize'

import { Request, Response } from 'express'

import { db } from '@/db'
import { timeoutMiddleware, validateDataWithZod, xssClean } from './middlewares'
import { ENVIRONMENT, errorHandler, logger, stream } from '@/common'

const { APP } = ENVIRONMENT

const numCPUs = process.env.NODE_ENV === 'production' ? os.cpus().length : 1

// dotenv.config();
//
//
// const appName= ENVIRONMENT.APP.NAME
// const port = ENVIRONMENT.APP.PORT;
//
// const server = http.createServer((req, res) => {})
//
// const appServer=server.listen(port, async ()=>{
//     await db()
//
//     console.log(`=> ${appName} app listening on port ${port}!`)
// });

/**
 * Default app configurations
 */
const app = express()
const port = ENVIRONMENT.APP.PORT
const appName = ENVIRONMENT.APP.NAME

/**
 * Express configuration
 */
app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']) // Enable trust proxy
// app.use(cookieParser())
app.use(express.json({ limit: '10kb' }))
app.use(express.urlencoded({ limit: '50mb', extended: true }))

/**
 * Compression Middleware
 */
app.use(compression())

// Rate limiting (different for flash sale endpoints)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP for normal endpoints
  standardHeaders: true,
  message: 'Too many requests, please try again later.',
})

const flashSaleLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 5 minutes
  max: 10, // stricter limit for flash sales
  message: 'Too many flash sale requests, please try again later.',
})

app.use('/api', apiLimiter)

//Middleware to allow CORS from frontend
app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:3001'],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    credentials: true,
  })
)

//Configure Content Security Policy (CSP)
//prevent Cross-Site Scripting (XSS) attacks by not allowing the loading of content from other domains.
// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [
          "'self'",
          'https://www.flashsale.com',
          'https://flashsale.com',
          'https://api.flashsale.com',
        ],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:'],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
  })
)
const helmetConfig: HelmetOptions = {
  // X-Frame-Options header to prevent clickjacking
  frameguard: { action: 'deny' },
  // X-XSS-Protection header to enable browser's built-in XSS protection
  xssFilter: true,
  // Referrer-Policy header
  referrerPolicy: { policy: 'strict-origin' },
  // Strict-Transport-Security (HSTS) header for HTTPS enforcement
  hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
}

app.use(helmet(helmetConfig))

//Secure cookies and other helmet-related configurations
app.use(helmet.hidePoweredBy())
app.use(helmet.noSniff())
app.use(helmet.ieNoOpen())
app.use(helmet.dnsPrefetchControl())
app.use(helmet.permittedCrossDomainPolicies())

// Prevent browser from caching sensitive information
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
  res.set('Pragma', 'no-cache')
  res.set('Expires', '0')
  next()
})

// Data sanitization against NoSQL query injection
app.use(mongoSanitize())

// Data sanitization against XSS
app.use(xssClean())

// prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
)

/**
 * Logger Middleware
 */
app.use(
  morgan(ENVIRONMENT.APP.ENV !== 'development' ? 'combined' : 'dev', { stream })
)
// Add request time to req object
app.use((req: Request, res: Response, next: NextFunction) => {
  req['requestTime'] = new Date().toISOString()
  next()
})

/**
 * Initialize routes
 */
app.use(validateDataWithZod)
// app.use('/api/v1/alive', (req: Request, res: Response) =>
//   res
//     .status(200)
//     .json({ status: 'success', message: 'Server is up and running' })
// );

// Apply rate limiting
app.use('/api', apiLimiter)
app.use('/api/flash-sale', flashSaleLimiter)

app.use('/api', require('@/routes'))

// Error handling
app.use(errorHandler)

app.all('/*', async (req, res) => {
  // Assuming the request ID was set earlier in middleware and is available in res.locals.logContext
  const context = res.locals.logContext || {}

  logger.error('Route not found', {
    ...context,
    timestamp: new Date().toISOString(),
    originalUrl: req.originalUrl,
  })

  res.status(404).json({
    status: 'error',
    message: `OOPs!! No handler defined for ${req.method.toUpperCase()}: ${
      req.url
    } route. Check the API documentation for more details.`,
  })
})

// to ensure all the express middlewares are set up before starting the socket server
// including security headers and other middlewares
const server = http.createServer(app)

const appServer = server.listen(port, async () => {
  await db()
  console.log('=> ' + appName + ' app listening on port ' + port + '!')
  // start the email worker and queues

  // ;(async () => {
  //   await startAllQueuesAndWorkers()
  // })()
})

/**
 * Error handler middlewares
 */
app.use(timeoutMiddleware)
app.use(errorHandler)

/**
 * unhandledRejection  handler
 */

process.on('unhandledRejection', async (error: Error) => {
  console.log('UNHANDLED REJECTION! 💥 Server Shutting down...')
  console.log(error.name, error.message)
  logger.error(
    'UNHANDLED REJECTION! 💥 Server Shutting down... ' +
      new Date(Date.now()) +
      error.name,
    // @ts-ignore
    error.message
  )
  // await stopAllQueuesAndWorkers()
  appServer.close(() => {
    process.exit(1)
  })
})
