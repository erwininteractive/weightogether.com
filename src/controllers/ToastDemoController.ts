import { Request, Response } from 'express';

export class ToastDemoController {
    /**
     * GET /toast-demo
     * Display toast notifications demo page
     */
    static async index(_req: Request, res: Response): Promise<void> {
        res.render('toast-demo', {
            title: 'Toast Notifications Demo',
        });
    }
}
