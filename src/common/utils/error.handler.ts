import { NextFunction, Request, Response } from 'express'
import AppError from './app.error'

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    console.error(err)

    if (!(err instanceof AppError)) {
        err = new AppError(
            err.message || 'Internal Server Error',
            err.statusCode || 500
        )
    }

    const { statusCode, status, message, data, stack } = err

    const errorResponse: any = {
        status,
        message,
        ...(data && { data }),
    }

    // Include stack trace in development environment
    if (process.env.NODE_ENV === 'development') {
        errorResponse.stack = stack
    }

    res.status(statusCode).json(errorResponse)
}
