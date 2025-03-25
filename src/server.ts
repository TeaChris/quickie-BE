///////////////////////////////////////////////////////////////////////
// DO NOT CHANGE THE ORDER OF THE IMPORTS;
// DOT ENV AND MODULE ALIAS WILL NOT WORK PROPERLY UNLESS THEY ARE IMPORTED FIRST

import * as dotenv from 'dotenv';
dotenv.config();
if (process.env.NODE_ENV === 'production') {
    require('module-alias/register');
}

///////////////////////////////////////////////////////////////////////

import os from 'os'
import http from "http";

import {db} from "@/db";
import {ENVIRONMENT} from "@/common";


const numCPUs = process.env.NODE_ENV === 'production' ? os.cpus().length : 1;


dotenv.config();


const appName= ENVIRONMENT.APP.NAME
const port = ENVIRONMENT.APP.PORT;

const server = http.createServer((req, res) => {})

const appServer=server.listen(port, async ()=>{
    await db()

    console.log(`=> ${appName} app listening on port ${port}!`)
});
