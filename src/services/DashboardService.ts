import { Router } from "express";
import { Metabase } from "../wrapper/Metabase";

export const DashboardService = Router();

DashboardService.get('/', async (req, res) => {
    return Metabase.getDashboards()
        .then(data => {
            res.status(200).json(data);
        })
        .catch(error => {
            console.error(error);
            res.status(500).send();
        });
});

DashboardService.get('/:id', async (req, res) => {
    const dashboardId = req.params.id;

    return Metabase.getDashboard(dashboardId)
        .then(data => {
            res.status(200).json(data);
        })
        .catch(error => {
            console.error(error);
            res.status(500).send();
        });
});
