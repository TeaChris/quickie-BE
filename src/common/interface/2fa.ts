import { twoFactorTypeEnum } from '../constants'

export interface ITwoFactor {
    type?: twoFactorTypeEnum
    secret?: string
    recoveryCode?: string
    active: boolean
    verificationTime?: Date
    isVerified?: boolean
}
