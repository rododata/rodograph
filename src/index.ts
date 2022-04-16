import express from "express";
import { PrismaClient } from "@prisma/client";

const app = express();
const prisma = new PrismaClient({
    log: ['info', 'warn', 'error'],
});

prisma.$connect().then(() => {
    const server = app.listen(3000, () =>
        console.log('[%s] Server running', JSON.stringify(server.address()))
    );
});
