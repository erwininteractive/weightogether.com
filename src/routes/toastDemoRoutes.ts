import { Router } from 'express';
import { ToastDemoController } from '../controllers/ToastDemoController';

const router = Router();

router.get('/', ToastDemoController.index);

export default router;
