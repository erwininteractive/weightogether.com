import { SocialProvider } from "@prisma/client";
import prisma from "./database";
import { AuthService } from "./auth.service";
import { SafeUser, TokenPair } from "../types/auth";

export interface SocialProfile {
	provider: SocialProvider;
	providerUserId: string;
	email?: string;
	displayName?: string;
	avatarUrl?: string;
}

export interface SocialAuthResult {
	user: SafeUser;
	tokens: TokenPair;
	isNewUser: boolean;
}

/**
 * Service for handling social authentication (Google, Facebook, Twitter/X)
 */
export class SocialAuthService {
	/**
	 * Find or create a user from a social profile
	 * Handles both new registrations and linking to existing accounts
	 */
	static async findOrCreateUser(
		profile: SocialProfile,
	): Promise<SocialAuthResult> {
		// First, check if this social account is already linked
		const existingSocialAccount = await prisma.socialAccount.findUnique({
			where: {
				provider_providerUserId: {
					provider: profile.provider,
					providerUserId: profile.providerUserId,
				},
			},
			include: { user: true },
		});

		if (existingSocialAccount) {
			// User already has this social account linked - log them in
			const user = existingSocialAccount.user;

			if (!user.isActive) {
				throw new Error("Account is deactivated");
			}

			// Update last login
			await prisma.user.update({
				where: { id: user.id },
				data: { lastLoginAt: new Date() },
			});

			// Generate tokens
			const payload = await AuthService.buildJwtPayload(user.id);
			const tokens = AuthService.generateTokenPair(payload);

			// Store refresh token
			const expiresAt = new Date();
			expiresAt.setDate(expiresAt.getDate() + 7);
			await prisma.refreshToken.create({
				data: {
					token: tokens.refreshToken,
					userId: user.id,
					expiresAt,
				},
			});

			const { passwordHash: _, ...safeUser } = user;
			return { user: safeUser, tokens, isNewUser: false };
		}

		// Check if a user with this email already exists
		if (profile.email) {
			const existingUser = await prisma.user.findFirst({
				where: {
					email: profile.email,
					deletedAt: null,
				},
			});

			if (existingUser) {
				// Link this social account to existing user
				await prisma.socialAccount.create({
					data: {
						userId: existingUser.id,
						provider: profile.provider,
						providerUserId: profile.providerUserId,
						email: profile.email,
						displayName: profile.displayName,
						avatarUrl: profile.avatarUrl,
					},
				});

				// Mark email as verified since it came from OAuth provider
				if (!existingUser.emailVerified) {
					await prisma.user.update({
						where: { id: existingUser.id },
						data: {
							emailVerified: true,
							emailVerificationToken: null,
							emailVerificationExpires: null,
						},
					});
				}

				// Update last login
				await prisma.user.update({
					where: { id: existingUser.id },
					data: { lastLoginAt: new Date() },
				});

				// Generate tokens
				const payload = await AuthService.buildJwtPayload(
					existingUser.id,
				);
				const tokens = AuthService.generateTokenPair(payload);

				const expiresAt = new Date();
				expiresAt.setDate(expiresAt.getDate() + 7);
				await prisma.refreshToken.create({
					data: {
						token: tokens.refreshToken,
						userId: existingUser.id,
						expiresAt,
					},
				});

				const { passwordHash: _, ...safeUser } = existingUser;
				return { user: safeUser, tokens, isNewUser: false };
			}
		}

		// Create a new user
		const username = await this.generateUniqueUsername(profile);

		const newUser = await prisma.user.create({
			data: {
				email:
					profile.email ||
					`${profile.providerUserId}@${profile.provider.toLowerCase()}.placeholder`,
				username,
				displayName: profile.displayName || username,
				avatarUrl: profile.avatarUrl,
				emailVerified: !!profile.email, // Verified if we got email from provider
				passwordHash: null, // No password for social auth users
				socialAccounts: {
					create: {
						provider: profile.provider,
						providerUserId: profile.providerUserId,
						email: profile.email,
						displayName: profile.displayName,
						avatarUrl: profile.avatarUrl,
					},
				},
			},
		});

		// Update last login
		await prisma.user.update({
			where: { id: newUser.id },
			data: { lastLoginAt: new Date() },
		});

		// Generate tokens
		const payload = await AuthService.buildJwtPayload(newUser.id);
		const tokens = AuthService.generateTokenPair(payload);

		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + 7);
		await prisma.refreshToken.create({
			data: {
				token: tokens.refreshToken,
				userId: newUser.id,
				expiresAt,
			},
		});

		const { passwordHash: _, ...safeUser } = newUser;
		return { user: safeUser, tokens, isNewUser: true };
	}

	/**
	 * Generate a unique username from social profile
	 */
	private static async generateUniqueUsername(
		profile: SocialProfile,
	): Promise<string> {
		// Start with display name or email prefix
		let baseUsername = "";

		if (profile.displayName) {
			baseUsername = profile.displayName
				.toLowerCase()
				.replace(/[^a-z0-9]/g, "")
				.slice(0, 15);
		} else if (profile.email) {
			baseUsername = profile.email
				.split("@")[0]
				.toLowerCase()
				.replace(/[^a-z0-9]/g, "")
				.slice(0, 15);
		} else {
			baseUsername = `user`;
		}

		// Ensure minimum length
		if (baseUsername.length < 3) {
			baseUsername = `user${baseUsername}`;
		}

		// Check if username is unique
		let username = baseUsername;
		let counter = 1;

		while (true) {
			const existing = await prisma.user.findUnique({
				where: { username },
			});

			if (!existing) {
				return username;
			}

			// Add a random suffix
			username = `${baseUsername}${counter}`;
			counter++;

			if (counter > 1000) {
				// Fallback to UUID-based username
				username = `user_${profile.providerUserId.slice(0, 8)}`;
				break;
			}
		}

		return username;
	}

	/**
	 * Link a social account to an existing user
	 */
	static async linkSocialAccount(
		userId: string,
		profile: SocialProfile,
	): Promise<void> {
		// Check if this social account is already linked to another user
		const existing = await prisma.socialAccount.findUnique({
			where: {
				provider_providerUserId: {
					provider: profile.provider,
					providerUserId: profile.providerUserId,
				},
			},
		});

		if (existing) {
			if (existing.userId === userId) {
				throw new Error(
					"This social account is already linked to your account",
				);
			} else {
				throw new Error(
					"This social account is already linked to another user",
				);
			}
		}

		await prisma.socialAccount.create({
			data: {
				userId,
				provider: profile.provider,
				providerUserId: profile.providerUserId,
				email: profile.email,
				displayName: profile.displayName,
				avatarUrl: profile.avatarUrl,
			},
		});
	}

	/**
	 * Unlink a social account from a user
	 */
	static async unlinkSocialAccount(
		userId: string,
		provider: SocialProvider,
	): Promise<void> {
		// Check if user has a password or other social accounts
		const user = await prisma.user.findUnique({
			where: { id: userId },
			include: { socialAccounts: true },
		});

		if (!user) {
			throw new Error("User not found");
		}

		// Ensure user has another way to log in
		const hasPassword = !!user.passwordHash;
		const otherSocialAccounts = user.socialAccounts.filter(
			(sa) => sa.provider !== provider,
		);

		if (!hasPassword && otherSocialAccounts.length === 0) {
			throw new Error(
				"Cannot unlink this account. You must have a password or another linked social account.",
			);
		}

		await prisma.socialAccount.deleteMany({
			where: {
				userId,
				provider,
			},
		});
	}

	/**
	 * Get linked social accounts for a user
	 */
	static async getLinkedAccounts(userId: string): Promise<
		{
			provider: SocialProvider;
			displayName: string | null;
			email: string | null;
			linkedAt: Date;
		}[]
	> {
		const accounts = await prisma.socialAccount.findMany({
			where: { userId },
			select: {
				provider: true,
				displayName: true,
				email: true,
				createdAt: true,
			},
		});

		return accounts.map((a) => ({
			provider: a.provider,
			displayName: a.displayName,
			email: a.email,
			linkedAt: a.createdAt,
		}));
	}
}
