import { Require_id } from "mongoose";
import type {File as MulterFile} from "multer";

import type {IUser} from './'

declare global {
    namespace  Express {
        interface Request {
            user?: Require_id<IUser>
            file?: MulterFile
        }
    }
}

declare module 'express-serve-static-core' {
    export interface CookieOptions {
        partitioned?: boolean
    }
}
