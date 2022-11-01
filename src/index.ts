import dotenv from "dotenv";
dotenv.config();

import cors from 'cors';
import express from "express";
import { applicationDefault, initializeApp } from "firebase-admin/app";

import { Metabase } from "./wrapper/Metabase";
import { GraphService } from "./services/GraphService";
import { DashboardService } from "./services/DashboardService";
import { QueryService } from "./services/QueryService";

const app = express();

initializeApp({
    credential: applicationDefault(),
});

app.use(cors());
app.use(express.json());

app.use('/dashboards', DashboardService);
app.use('/graphs', GraphService);
app.use('/query', QueryService);

Metabase.connect().then(() => {
    const server = app.listen(3001, () =>
        console.log('[%s] Server running', JSON.stringify(server.address()))
    );
});
