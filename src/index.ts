import dotenv from "dotenv";
dotenv.config();

import cors from 'cors';
import express from "express";
import { PrismaClient } from "@prisma/client";

import { Metabase } from "./wrapper/Metabase";
import { GraphService } from "./services/GraphService";
import { DashboardService } from "./services/DashboardService";

const app = express();
const prisma = new PrismaClient({
    log: ['info', 'warn', 'error'],
});

app.use(cors());
app.use('/dashboards', DashboardService);
app.use('/graphs', GraphService);

prisma.$connect().then(async () => {
    await Metabase.connect();

    const server = app.listen(3000, () =>
        console.log('[%s] Server running', JSON.stringify(server.address()))
    );
});
