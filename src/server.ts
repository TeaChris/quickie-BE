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

import cors from 'cors'
import morgan from 'morgan'
import helmet from 'helmet'
import express from 'express'
import cluster from 'cluster'
import mongoose from 'mongoose'
import compression from 'compression'
import rateLimit from 'express-rate-limit'

import {Request, Response} from "express";

import { db } from '@/db'
import { ENVIRONMENT, errorHandler } from '@/common'

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

if (cluster.isPrimary) {
  console.log(`Master ${process.pid} is running`)

  // Fork workers
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork()
  }

  cluster.on('exit', (worker) => {
    console.log(`Worker ${worker.process.pid} died`)
    cluster.fork() // Restart dead worker
  })
} else {
  // Worker process
  const appName = ENVIRONMENT.APP.NAME
  const port = ENVIRONMENT.APP.PORT

  // Express setup
  const app = express()

  // Security middleware
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"]
      }
    }
  }));
  app.use(
    cors({
      origin: ['http://localhost:3000', 'http://localhost:3001'],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
    })
  )

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

  // Compression
  app.use(compression())

  // Body parsing
  app.set('trust proxy', ['loopback', 'linklocal', 'uniquelocal']) // Enable trust proxy
  // app.use(cookieParser())
  app.use(express.json({ limit: '10kb' }))
  app.use(express.urlencoded({ limit: '50mb', extended: true }))

  // Logging
  app.use(morgan('combined'))

  // Database connection with optimized settings
  const dbOptions: mongoose.ConnectOptions = {
    autoIndex: process.env.NODE_ENV !== 'production', // Disable in prod
    maxPoolSize: 50, // Connection pool size
    socketTimeoutMS: 30000,
    heartbeatFrequencyMS: 10000,
  }

  // Health check endpoint
    app.get('/health', (req: Request, res: Response) => {
        res.status(200).json({ status: 'ok' });
    });

  // Apply rate limiting
  app.use('/api', apiLimiter)
  app.use('/api/flash-sale', flashSaleLimiter)

  // Routes
  app.use('/api', require('@/routes'))

  // Error handling
  app.use(errorHandler)

  // Create server
  const server = http.createServer(app)

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down gracefully...')
    server.close(async () => {
      await mongoose.disconnect()
      console.log('HTTP server closed and MongoDB disconnected')
      process.exit(0)
    })

    setTimeout(() => {
      console.error('Force shutdown after timeout')
      process.exit(1)
    }, 5000)
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)

  // Handle uncaught exceptions
  process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err)
    shutdown()
  })

  process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason)
    shutdown()
  })

  // Start server
  server.listen(port, async () => {
    await db()
    console.log(
      `=> ${appName} worker ${process.pid} listening on port ${port}!`
    )
  })
}
