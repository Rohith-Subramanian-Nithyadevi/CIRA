import { Router } from 'express';
import { getActiveBatches } from '../controllers/batch.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';

const router = Router();

// Retrieve all active batches (public so Registration page can load dropdowns)
router.get('/', getActiveBatches);

export default router;
