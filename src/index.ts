import dotenv from "dotenv";
dotenv.config();

import express from "express";
import { PrismaClient } from "@prisma/client";

import { Metabase } from "./wrapper/Metabase";
import { GraphService } from "./services/GraphService";

const app = express();
const prisma = new PrismaClient({
    log: ['info', 'warn', 'error'],
});

app.use('/graph', GraphService);

prisma.$connect().then(async () => {
    await Metabase.connect();

    const server = app.listen(3000, () =>
        console.log('[%s] Server running', JSON.stringify(server.address()))
    );
});
