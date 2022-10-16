import dotenv from "dotenv";
dotenv.config();

import cors from 'cors';
import express from "express";
import { applicationDefault, initializeApp } from "firebase-admin/app";
import { PrismaClient } from "@prisma/client";

import { Metabase } from "./wrapper/Metabase";
import { GraphService } from "./services/GraphService";
import { DashboardService } from "./services/DashboardService";
import { QueryService } from "./services/QueryService";

const app = express();
const prisma = new PrismaClient({
    log: ['info', 'warn', 'error'],
});

initializeApp({
    credential: applicationDefault(),
});

app.use(cors());
app.use(express.json());

app.use('/dashboards', DashboardService);
app.use('/graphs', GraphService);
app.use('/query', QueryService);

prisma.$connect().then(async () => {
    await Metabase.connect();

    const server = app.listen(3001, () =>
        console.log('[%s] Server running', JSON.stringify(server.address()))
    );
});
