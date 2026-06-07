import nodemailer, { Transporter } from "nodemailer";
import crypto from "crypto";

export class EmailService {
	private transporter: Transporter;
	private isDevelopment: boolean;

	constructor() {
		this.isDevelopment = process.env.NODE_ENV !== "production";

		// In development, if SMTP is not configured, use a test account
		if (this.isDevelopment && !process.env.SMTP_HOST) {
			console.warn(
				"SMTP not configured. Emails will be logged to console only.",
			);
			// Create a fake transporter for development
			this.transporter = nodemailer.createTransport({
				streamTransport: true,
				newline: "unix",
				buffer: true,
			});
		} else {
			// Configure nodemailer with SMTP settings
			this.transporter = nodemailer.createTransport({
				host: process.env.SMTP_HOST || "localhost",
				port: parseInt(process.env.SMTP_PORT || "587"),
				secure: process.env.SMTP_SECURE === "true", // true for 465, false for other ports
				auth:
					process.env.SMTP_USER && process.env.SMTP_PASS
						? {
								user: process.env.SMTP_USER,
								pass: process.env.SMTP_PASS,
							}
						: undefined,
				connectionTimeout: 10000, // 10 second connection timeout
				greetingTimeout: 10000, // 10 second greeting timeout
				socketTimeout: 30000, // 30 second socket timeout
				tls: {
					// Reject invalid certs unless explicitly disabled
					rejectUnauthorized:
						process.env.SMTP_REJECT_UNAUTHORIZED !== "false",
					minVersion: "TLSv1.2",
				},
			});
		}
	}

	/**
	 * Generate a secure email verification token
	 */
	generateVerificationToken(): string {
		return crypto.randomBytes(32).toString("hex");
	}

	/**
	 * Send email verification message
	 */
	async sendVerificationEmail(
		email: string,
		username: string,
		token: string,
	): Promise<void> {
		const verificationUrl = `${process.env.APP_URL || "http://localhost:3000"}/verify-email?token=${token}`;

		const mailOptions = {
			from: process.env.SMTP_FROM || "noreply@example.com",
			to: email,
			subject: "Verify your email address",
			html: this.getVerificationEmailTemplate(username, verificationUrl),
			text: `Hello ${username},\n\nPlease verify your email address by clicking the following link:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you did not create an account, please ignore this email.`,
		};

		try {
			const info = await this.transporter.sendMail(mailOptions);

			if (this.isDevelopment) {
				console.log("Email sent (development mode)");
				console.log("   To:", email);
				console.log("   Subject:", mailOptions.subject);
				console.log("   Verification URL:", verificationUrl);
				if (info.messageId) {
					console.log("   Message ID:", info.messageId);
				}
			}
		} catch (error) {
			console.error("Failed to send verification email:", error);
			if (error instanceof Error) {
				console.error("   Error name:", error.name);
				console.error("   Error message:", error.message);
			}
			throw new Error(
				`Failed to send verification email: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Send password reset email
	 */
	async sendPasswordResetEmail(
		email: string,
		username: string,
		token: string,
	): Promise<void> {
		const resetUrl = `${process.env.APP_URL || "http://localhost:3000"}/reset-password?token=${token}`;

		const mailOptions = {
			from: process.env.SMTP_FROM || "noreply@example.com",
			to: email,
			subject: "Reset your password",
			html: this.getPasswordResetEmailTemplate(username, resetUrl),
			text: `Hello ${username},\n\nYou requested to reset your password. Click the following link to reset it:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you did not request a password reset, please ignore this email.`,
		};

		try {
			const info = await this.transporter.sendMail(mailOptions);

			if (this.isDevelopment) {
				console.log("Email sent (development mode)");
				console.log("   To:", email);
				console.log("   Subject:", mailOptions.subject);
				console.log("   Reset URL:", resetUrl);
				if (info.messageId) {
					console.log("   Message ID:", info.messageId);
				}
			}
		} catch (error) {
			console.error("Failed to send password reset email:", error);
			if (error instanceof Error) {
				console.error("   Error name:", error.name);
				console.error("   Error message:", error.message);
			}
			throw new Error(
				`Failed to send password reset email: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Get HTML template for verification email
	 */
	private getVerificationEmailTemplate(
		username: string,
		verificationUrl: string,
	): string {
		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Verify Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
	<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
		<tr>
			<td style="padding: 20px 0;">
				<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
					<!-- Header -->
					<tr>
						<td style="padding: 40px 30px; text-align: center; background-color: #4f46e5; border-radius: 8px 8px 0 0;">
							<h1 style="margin: 0; color: #ffffff; font-size: 28px;">WeighTogether</h1>
						</td>
					</tr>

					<!-- Content -->
					<tr>
						<td style="padding: 40px 30px;">
							<h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Verify Your Email Address</h2>
							<p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
								Hello ${username},
							</p>
							<p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
								Thank you for signing up! Please verify your email address to complete your registration and start tracking your weight loss journey.
							</p>
							<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
								<tr>
									<td style="padding: 20px 0; text-align: center;">
										<a href="${verificationUrl}" style="display: inline-block; padding: 14px 40px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">Verify Email Address</a>
									</td>
								</tr>
							</table>
							<p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
								Or copy and paste this link into your browser:<br>
								<a href="${verificationUrl}" style="color: #4f46e5; word-break: break-all;">${verificationUrl}</a>
							</p>
							<p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 1.5;">
								This link will expire in 24 hours.
							</p>
						</td>
					</tr>

					<!-- Footer -->
					<tr>
						<td style="padding: 30px; text-align: center; border-top: 1px solid #eeeeee;">
							<p style="margin: 0; color: #999999; font-size: 14px;">
								If you did not create an account, please ignore this email.
							</p>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
		`;
	}

	/**
	 * Get HTML template for password reset email
	 */
	private getPasswordResetEmailTemplate(
		username: string,
		resetUrl: string,
	): string {
		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
	<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
		<tr>
			<td style="padding: 20px 0;">
				<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
					<!-- Header -->
					<tr>
						<td style="padding: 40px 30px; text-align: center; background-color: #4f46e5; border-radius: 8px 8px 0 0;">
							<h1 style="margin: 0; color: #ffffff; font-size: 28px;">WeighTogether</h1>
						</td>
					</tr>

					<!-- Content -->
					<tr>
						<td style="padding: 40px 30px;">
							<h2 style="margin: 0 0 20px 0; color: #333333; font-size: 24px;">Reset Your Password</h2>
							<p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
								Hello ${username},
							</p>
							<p style="margin: 0 0 20px 0; color: #666666; font-size: 16px; line-height: 1.5;">
								We received a request to reset your password. Click the button below to choose a new password.
							</p>
							<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
								<tr>
									<td style="padding: 20px 0; text-align: center;">
										<a href="${resetUrl}" style="display: inline-block; padding: 14px 40px; background-color: #4f46e5; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 16px; font-weight: bold;">Reset Password</a>
									</td>
								</tr>
							</table>
							<p style="margin: 20px 0 0 0; color: #666666; font-size: 14px; line-height: 1.5;">
								Or copy and paste this link into your browser:<br>
								<a href="${resetUrl}" style="color: #4f46e5; word-break: break-all;">${resetUrl}</a>
							</p>
							<p style="margin: 20px 0 0 0; color: #999999; font-size: 14px; line-height: 1.5;">
								This link will expire in 1 hour.
							</p>
						</td>
					</tr>

					<!-- Footer -->
					<tr>
						<td style="padding: 30px; text-align: center; border-top: 1px solid #eeeeee;">
							<p style="margin: 0; color: #999999; font-size: 14px;">
								If you did not request a password reset, please ignore this email and your password will remain unchanged.
							</p>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
		`;
	}

	/**
	 * Send feedback email to admin
	 */
	async sendFeedbackEmail(options: {
		adminEmail: string;
		type: string;
		subject: string;
		message: string;
		user: { id: string; username: string; email: string };
	}): Promise<void> {
		const { adminEmail, type, subject, message, user } = options;

		const typeLabels: Record<string, string> = {
			bug: "Bug Report",
			feature: "Feature Request",
			question: "Question",
			other: "Other",
		};

		const mailOptions = {
			from: process.env.SMTP_FROM || "noreply@example.com",
			to: adminEmail,
			replyTo: user.email,
			subject: `[${typeLabels[type] || type}] ${subject}`,
			html: this.getFeedbackEmailTemplate({
				type: typeLabels[type] || type,
				subject,
				message,
				user,
			}),
			text: `Feedback from ${user.username} (${user.email})\n\nType: ${typeLabels[type] || type}\nSubject: ${subject}\n\nMessage:\n${message}\n\nUser ID: ${user.id}`,
		};

		try {
			const info = await this.transporter.sendMail(mailOptions);

			if (this.isDevelopment) {
				console.log("Feedback email sent (development mode)");
				console.log("   To:", adminEmail);
				console.log("   From User:", user.email);
				console.log("   Subject:", mailOptions.subject);
				if (info.messageId) {
					console.log("   Message ID:", info.messageId);
				}
			}
		} catch (error) {
			console.error("Failed to send feedback email:", error);
			throw new Error(
				`Failed to send feedback email: ${error instanceof Error ? error.message : "Unknown error"}`,
			);
		}
	}

	/**
	 * Get HTML template for feedback email
	 */
	private getFeedbackEmailTemplate(options: {
		type: string;
		subject: string;
		message: string;
		user: { id: string; username: string; email: string };
	}): string {
		const { type, subject, message, user } = options;
		const escapedMessage = message
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/\n/g, "<br>");

		return `
<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>User Feedback</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f4f4f4;">
	<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f4f4f4;">
		<tr>
			<td style="padding: 20px 0;">
				<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
					<!-- Header -->
					<tr>
						<td style="padding: 40px 30px; text-align: center; background-color: #0d9488; border-radius: 8px 8px 0 0;">
							<h1 style="margin: 0; color: #ffffff; font-size: 28px;">WeighTogether Feedback</h1>
						</td>
					</tr>

					<!-- Content -->
					<tr>
						<td style="padding: 40px 30px;">
							<table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
								<tr>
									<td style="padding: 10px 0; border-bottom: 1px solid #eeeeee;">
										<strong style="color: #666666;">Type:</strong>
										<span style="color: #333333; margin-left: 10px;">${type}</span>
									</td>
								</tr>
								<tr>
									<td style="padding: 10px 0; border-bottom: 1px solid #eeeeee;">
										<strong style="color: #666666;">From:</strong>
										<span style="color: #333333; margin-left: 10px;">${user.username} (${user.email})</span>
									</td>
								</tr>
								<tr>
									<td style="padding: 10px 0; border-bottom: 1px solid #eeeeee;">
										<strong style="color: #666666;">Subject:</strong>
										<span style="color: #333333; margin-left: 10px;">${subject}</span>
									</td>
								</tr>
							</table>

							<div style="margin-top: 30px;">
								<strong style="color: #666666; display: block; margin-bottom: 10px;">Message:</strong>
								<div style="background-color: #f9f9f9; padding: 20px; border-radius: 6px; color: #333333; line-height: 1.6;">
									${escapedMessage}
								</div>
							</div>
						</td>
					</tr>

					<!-- Footer -->
					<tr>
						<td style="padding: 20px 30px; text-align: center; border-top: 1px solid #eeeeee; background-color: #f9f9f9; border-radius: 0 0 8px 8px;">
							<p style="margin: 0; color: #999999; font-size: 12px;">
								User ID: ${user.id}<br>
								You can reply directly to this email to respond to the user.
							</p>
						</td>
					</tr>
				</table>
			</td>
		</tr>
	</table>
</body>
</html>
		`;
	}

	/**
	 * Verify SMTP connection
	 */
	async verifyConnection(): Promise<boolean> {
		try {
			await this.transporter.verify();
			console.log("SMTP connection verified successfully");
			return true;
		} catch (error) {
			console.error("SMTP connection error:", error);
			return false;
		}
	}
}

export const emailService = new EmailService();
