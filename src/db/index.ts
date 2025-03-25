import * as mongoose from "mongoose";
import {ConnectOptions} from "mongoose";

import {ENVIRONMENT} from "@/common";

interface CustomConnectOptions extends ConnectOptions {
    maxPoolSize?: number;
    minPoolSize?: number;
    // autoIndex: process.env.NODE_ENV !== 'production',
}

export const db = async (): Promise<void> => {
    try {
        const connect = await mongoose.connect(ENVIRONMENT.DB.URL, {
            minPoolSize: 100,
            maxPoolSize: 100,
        } as CustomConnectOptions);

        console.log("MongoDB Connected to " + connect.connection.name);
    } catch (error) {
        console.error('Error:' + (error as Error).message);
        process.exit(1);
    }
}