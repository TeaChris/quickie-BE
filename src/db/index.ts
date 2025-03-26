import * as mongoose from "mongoose";
import { ConnectOptions } from "mongoose";

import {ENVIRONMENT} from "@/common";

const { DB, APP } = ENVIRONMENT

interface CustomConnectOptions extends ConnectOptions {
    maxPoolSize?: number;
    minPoolSize?: number;
    // autoIndex: process.env.NODE_ENV !== 'production',
}

// export const db = async (): Promise<void> => {
//     try {
//         const connect = await mongoose.connect(DB.URL, {
//             minPoolSize: 100,
//             maxPoolSize: 100,
//             autoIndex: true,
//         } as CustomConnectOptions);
//
//         console.log("MongoDB Connected to " + connect.connection.name);
//     } catch (error) {
//         console.error('Error:' + (error as Error).message);
//         process.exit(1);
//     }
// }


const numCPUs = process.env.NODE_ENV === 'production'
    ? require('os').cpus().length
    : 1;

export const db = async (): Promise<void> => {
    try {
        const connect = await mongoose.connect(DB.URL, {
            maxPoolSize: Math.floor(100 / numCPUs),
            minPoolSize: 5,
            autoIndex: APP.ENV !== 'production',
            socketTimeoutMS: 30000,
            connectTimeoutMS: 5000,
            serverSelectionTimeoutMS: 5000,
            retryWrites: true,
            w: 'majority'
        } as ConnectOptions);

        console.log("MongoDB Connected to " + connect.connection.name);
    } catch (error) {
        console.error('Database connection error:', error);

        await mongoose.disconnect();
        process.exit(1);
    }
}