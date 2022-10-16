import { Router } from "express";
import { Metabase } from "../wrapper/Metabase";

export const QueryService = Router();

QueryService.get('/options', async (req, res) => {
    return Metabase.getQueryOptions()
        .then(data => {
            res.status(200).json(data);
        })
        .catch(error => {
            console.error(error);
            res.status(500).send();
        });
});

QueryService.post('/', async (req, res) => {
    return Metabase.query(req.body)
        .then(data => {
            res.status(200).json(data);
        })
        .catch(error => {
            console.error(error);
            res.status(500).send();
        });
});
