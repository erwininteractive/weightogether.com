import { Request } from "express";
import { User } from "@prisma/client";

export interface JwtPayload {
	sub: string; // user id
	email: string;
	username: string;
	teams: string[]; // team ids for quick permission checks
	iat?: number;
	exp?: number;
}

export interface TokenPair {
	accessToken: string;
	refreshToken: string;
}

export interface AuthenticatedRequest extends Request {
	user?: JwtPayload;
}

export type SafeUser = Omit<User, "passwordHash">;

export interface RegisterInput {
	email: string;
	username: string;
	password: string;
	displayName?: string;
	dateOfBirth?: Date;
	unitSystem?: "IMPERIAL" | "METRIC";
	currentWeight?: number;
	goalWeight?: number;
	height?: number;
	activityLevel?:
		| "SEDENTARY"
		| "LIGHTLY_ACTIVE"
		| "MODERATELY_ACTIVE"
		| "VERY_ACTIVE"
		| "EXTREMELY_ACTIVE";
}

export interface LoginInput {
	email: string;
	password: string;
}
