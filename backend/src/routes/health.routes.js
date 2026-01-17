import express from 'express';

const router = express.Router();


router.route("/health-check").get((_, res) => res.json({msg:"Server is Healthy"}));

export { router as healthRoutes };