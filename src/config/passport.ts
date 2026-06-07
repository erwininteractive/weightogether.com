import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as FacebookStrategy } from "passport-facebook";
import { Strategy as TwitterStrategy } from "passport-twitter";
import { SocialProvider } from "@prisma/client";
import {
	SocialAuthService,
	SocialProfile,
	SocialAuthResult,
} from "../services/social-auth.service";

// Environment variables
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || "";
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || "";
const TWITTER_CONSUMER_KEY = process.env.TWITTER_CONSUMER_KEY || "";
const TWITTER_CONSUMER_SECRET = process.env.TWITTER_CONSUMER_SECRET || "";
const APP_URL = process.env.APP_URL || "http://localhost:3000";

/**
 * Configure Passport strategies for social authentication
 * Note: We don't use Passport sessions - we issue our own JWT tokens
 */
export function configurePassport(): void {
	// Google OAuth2 Strategy
	if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
		passport.use(
			new GoogleStrategy(
				{
					clientID: GOOGLE_CLIENT_ID,
					clientSecret: GOOGLE_CLIENT_SECRET,
					callbackURL: `${APP_URL}/auth/google/callback`,
					scope: ["profile", "email"],
				},
				async (_accessToken, _refreshToken, profile, done) => {
					try {
						const socialProfile: SocialProfile = {
							provider: SocialProvider.GOOGLE,
							providerUserId: profile.id,
							email: profile.emails?.[0]?.value,
							displayName: profile.displayName,
							avatarUrl: profile.photos?.[0]?.value,
						};

						const result =
							await SocialAuthService.findOrCreateUser(
								socialProfile,
							);
						// Pass the result as an object that Express can handle
						done(null, result as unknown as Express.User);
					} catch (error) {
						done(error as Error);
					}
				},
			),
		);
	}

	// Facebook Strategy
	if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
		passport.use(
			new FacebookStrategy(
				{
					clientID: FACEBOOK_APP_ID,
					clientSecret: FACEBOOK_APP_SECRET,
					callbackURL: `${APP_URL}/auth/facebook/callback`,
					profileFields: ["id", "displayName", "emails", "photos"],
				},
				async (_accessToken, _refreshToken, profile, done) => {
					try {
						const socialProfile: SocialProfile = {
							provider: SocialProvider.FACEBOOK,
							providerUserId: profile.id,
							email: profile.emails?.[0]?.value,
							displayName: profile.displayName,
							avatarUrl: profile.photos?.[0]?.value,
						};

						const result =
							await SocialAuthService.findOrCreateUser(
								socialProfile,
							);
						done(null, result as unknown as Express.User);
					} catch (error) {
						done(error as Error);
					}
				},
			),
		);
	}

	// Twitter Strategy (OAuth 1.0a)
	if (TWITTER_CONSUMER_KEY && TWITTER_CONSUMER_SECRET) {
		passport.use(
			new TwitterStrategy(
				{
					consumerKey: TWITTER_CONSUMER_KEY,
					consumerSecret: TWITTER_CONSUMER_SECRET,
					callbackURL: `${APP_URL}/auth/twitter/callback`,
					includeEmail: true,
				},
				async (_token, _tokenSecret, profile, done) => {
					try {
						const socialProfile: SocialProfile = {
							provider: SocialProvider.TWITTER,
							providerUserId: profile.id,
							email: profile.emails?.[0]?.value,
							displayName: profile.displayName,
							avatarUrl: profile.photos?.[0]?.value,
						};

						const result =
							await SocialAuthService.findOrCreateUser(
								socialProfile,
							);
						done(null, result as unknown as Express.User);
					} catch (error) {
						done(error as Error);
					}
				},
			),
		);
	}

	// We don't use sessions, but passport requires serialize/deserialize
	passport.serializeUser((user, done) => {
		done(null, user);
	});

	passport.deserializeUser((user, done) => {
		done(null, user as Express.User);
	});
}

/**
 * Check which providers are configured
 */
export function getConfiguredProviders(): {
	google: boolean;
	facebook: boolean;
	twitter: boolean;
} {
	return {
		google: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET),
		facebook: !!(FACEBOOK_APP_ID && FACEBOOK_APP_SECRET),
		twitter: !!(TWITTER_CONSUMER_KEY && TWITTER_CONSUMER_SECRET),
	};
}

export { SocialAuthResult };
