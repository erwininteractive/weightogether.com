import "./env";

export const authConfig = {
	jwt: {
		accessTokenSecret:
			process.env.JWT_ACCESS_SECRET ||
			"your-access-secret-change-in-production",
		refreshTokenSecret:
			process.env.JWT_REFRESH_SECRET ||
			"your-refresh-secret-change-in-production",
		accessTokenExpiresIn: "15m",
		refreshTokenExpiresIn: "7d",
	},
	bcrypt: {
		saltRounds: 12,
	},
	cookie: {
		refreshTokenName: "refreshToken",
		options: {
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "strict" as const,
			maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in ms
		},
	},
};
