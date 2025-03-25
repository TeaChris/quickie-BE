import { Model } from 'mongoose'
import type { SignOptions } from 'jsonwebtoken'

import { Gender, Provider, Role } from '../constants'
import { ITwoFactor } from './2fa'

export interface IUser {
    firstName: string
    lastName: string
    username: string
    email: string
    password: string
    refreshToken: string
    photo: string
    blurHash: string
    role: Role
    isProfileComplete: boolean
    provider: Provider
    phoneNumber: string
    verificationToken: string
    verificationTokenExpiresAt: Date
    passwordResetToken: string
    passwordResetExpires: Date
    passwordResetRetries: number
    passwordChangedAt: Date
    ipAddress: string
    loginRetries: number
    address: string[]
    gender: Gender
    isVerified: boolean
    isSuspended: boolean
    isMobileVerified: boolean
    isEmailVerified: boolean
    isDeleted: boolean
    accountRestoreToken: string
    twoFA: ITwoFactor
    isTermAndConditionAccepted: boolean
    lastLogin: Date
    createdAt: Date
    updatedAt: Date
}

export interface UserMethods extends Omit<IUser, 'toJSON'> {
    generateAccessToken(options?: SignOptions): string
    generateRefreshToken(options?: SignOptions): string
    verifyPassword(enteredPassword: string): Promise<boolean>
    toJSON(excludedFields?: Array<keyof IUser>): object
}

export type UserModel = Model<UserMethods>
