import { Request, Response, NextFunction } from "express";

export const logger = (
	req: Request,
	_res: Response,
	next: NextFunction,
): void => {
	const timestamp = new Date().toISOString();
	console.log(`[${timestamp}] ${req.method} ${req.path}`);
	next();
};
