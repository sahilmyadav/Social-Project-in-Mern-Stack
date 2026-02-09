import { Router } from 'express';
import { getTurnCredentials } from '../controllers/webrtc.controller.js';
import { verifyJwt } from '../middleware/auth.middleware.js';

const router = Router();

// Authenticated users can request ephemeral TURN credentials
router.use(verifyJwt);

router.get('/turn-credentials', getTurnCredentials);

export default router;
