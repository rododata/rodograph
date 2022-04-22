import { Router } from "express";
import { Metabase } from "../wrapper/Metabase";

export const GraphService = Router();

GraphService.get('/:id', async (req, res) => {
    const cardId = req.params.id;

    return Metabase.fetchCard(cardId)
        .then(data => {
            res.status(200).json(data);
        })
        .catch(error => {
            console.error(error);
            res.status(500).send();
        });
});
