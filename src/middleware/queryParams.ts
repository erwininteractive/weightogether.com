import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to make query parameters available to all views
 * This allows us to access flash messages passed via query strings
 */
export const queryParams = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    res.locals.query = req.query;
    next();
};
