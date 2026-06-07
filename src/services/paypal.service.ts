import { paypalConfig } from "../config/paypal";
import prisma from "./database";
import {
	DonationType,
	DonationStatus,
	SubscriptionStatus,
} from "@prisma/client";

interface PayPalTokenResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
}

interface PayPalOrderResponse {
	id: string;
	status: string;
	links: Array<{ href: string; rel: string; method: string }>;
}

interface PayPalCaptureResponse {
	id: string;
	status: string;
	purchase_units: Array<{
		payments: {
			captures: Array<{
				id: string;
				status: string;
				amount: { currency_code: string; value: string };
			}>;
		};
	}>;
	payer: {
		email_address: string;
		payer_id: string;
		name?: { given_name: string; surname: string };
	};
}

interface PayPalSubscriptionResponse {
	id: string;
	status: string;
	subscriber?: {
		email_address: string;
		payer_id: string;
		name?: { given_name: string; surname: string };
	};
	billing_info?: {
		next_billing_time: string;
		last_payment?: {
			amount: { currency_code: string; value: string };
			time: string;
		};
	};
	links: Array<{ href: string; rel: string; method: string }>;
}

export class PayPalService {
	private static accessToken: string | null = null;
	private static tokenExpiry: Date | null = null;

	/**
	 * Get PayPal access token (cached)
	 */
	private static async getAccessToken(): Promise<string> {
		// Return cached token if still valid
		if (
			this.accessToken &&
			this.tokenExpiry &&
			this.tokenExpiry > new Date()
		) {
			return this.accessToken;
		}

		const auth = Buffer.from(
			`${paypalConfig.clientId}:${paypalConfig.clientSecret}`,
		).toString("base64");

		const response = await fetch(`${paypalConfig.apiUrl}/v1/oauth2/token`, {
			method: "POST",
			headers: {
				Authorization: `Basic ${auth}`,
				"Content-Type": "application/x-www-form-urlencoded",
			},
			body: "grant_type=client_credentials",
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to get PayPal access token: ${error}`);
		}

		const data = (await response.json()) as PayPalTokenResponse;
		this.accessToken = data.access_token;
		// Set expiry 5 minutes before actual expiry for safety
		this.tokenExpiry = new Date(
			Date.now() + (data.expires_in - 300) * 1000,
		);

		return this.accessToken;
	}

	/**
	 * Create a one-time donation order
	 */
	static async createOrder(
		amount: number,
		currency: string = "USD",
		userId?: string,
	): Promise<{ orderId: string; approvalUrl: string }> {
		const accessToken = await this.getAccessToken();

		const orderPayload = {
			intent: "CAPTURE",
			purchase_units: [
				{
					amount: {
						currency_code: currency,
						value: amount.toFixed(2),
					},
					description: "Donation to WeighTogether",
				},
			],
			application_context: {
				brand_name: "WeighTogether",
				landing_page: "NO_PREFERENCE",
				user_action: "PAY_NOW",
				return_url: paypalConfig.returnUrl,
				cancel_url: paypalConfig.cancelUrl,
			},
		};

		const response = await fetch(`${paypalConfig.apiUrl}/v2/checkout/orders`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(orderPayload),
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to create PayPal order: ${error}`);
		}

		const order = (await response.json()) as PayPalOrderResponse;

		// Create pending donation in database
		await prisma.donation.create({
			data: {
				paypalOrderId: order.id,
				type: DonationType.ONE_TIME,
				status: DonationStatus.PENDING,
				amount,
				currency,
				userId: userId || null,
			},
		});

		const approvalUrl =
			order.links.find((link) => link.rel === "approve")?.href || "";

		return { orderId: order.id, approvalUrl };
	}

	/**
	 * Capture a PayPal order after user approval
	 */
	static async captureOrder(
		orderId: string,
	): Promise<{ success: boolean; transactionId: string; donation: unknown }> {
		const accessToken = await this.getAccessToken();

		const response = await fetch(
			`${paypalConfig.apiUrl}/v2/checkout/orders/${orderId}/capture`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
			},
		);

		if (!response.ok) {
			const error = await response.text();
			// Update donation status to failed
			await prisma.donation.updateMany({
				where: { paypalOrderId: orderId },
				data: { status: DonationStatus.FAILED },
			});
			throw new Error(`Failed to capture PayPal order: ${error}`);
		}

		const capture = (await response.json()) as PayPalCaptureResponse;
		const transactionId =
			capture.purchase_units[0]?.payments?.captures[0]?.id || "";

		// Update donation in database
		const donation = await prisma.donation.update({
			where: { paypalOrderId: orderId },
			data: {
				paypalTransactionId: transactionId,
				paypalPayerId: capture.payer.payer_id,
				paypalPayerEmail: capture.payer.email_address,
				donorName: capture.payer.name
					? `${capture.payer.name.given_name} ${capture.payer.name.surname}`
					: null,
				donorEmail: capture.payer.email_address,
				status: DonationStatus.COMPLETED,
				completedAt: new Date(),
			},
		});

		return { success: true, transactionId, donation };
	}

	/**
	 * Create a subscription for recurring donations
	 */
	static async createSubscription(
		planType: "monthly" | "yearly",
		userId?: string,
	): Promise<{ subscriptionId: string; approvalUrl: string }> {
		const accessToken = await this.getAccessToken();
		const planId =
			planType === "monthly"
				? paypalConfig.plans.monthly
				: paypalConfig.plans.yearly;

		if (!planId) {
			throw new Error(
				`PayPal ${planType} plan ID not configured. Please create a subscription plan in PayPal.`,
			);
		}

		const subscriptionPayload = {
			plan_id: planId,
			application_context: {
				brand_name: "WeighTogether",
				locale: "en-US",
				shipping_preference: "NO_SHIPPING",
				user_action: "SUBSCRIBE_NOW",
				return_url: `${paypalConfig.returnUrl}?subscription=true`,
				cancel_url: paypalConfig.cancelUrl,
			},
		};

		const response = await fetch(
			`${paypalConfig.apiUrl}/v1/billing/subscriptions`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify(subscriptionPayload),
			},
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to create PayPal subscription: ${error}`);
		}

		const subscription = (await response.json()) as PayPalSubscriptionResponse;

		// Get plan amount based on type
		const amount = planType === "monthly" ? 5 : 50; // Default amounts

		// Create subscription record in database
		await prisma.donationSubscription.create({
			data: {
				paypalSubscriptionId: subscription.id,
				paypalPlanId: planId,
				type:
					planType === "monthly"
						? DonationType.MONTHLY
						: DonationType.YEARLY,
				status: SubscriptionStatus.PENDING,
				amount,
				currency: "USD",
				userId: userId || null,
			},
		});

		const approvalUrl =
			subscription.links.find((link) => link.rel === "approve")?.href ||
			"";

		return { subscriptionId: subscription.id, approvalUrl };
	}

	/**
	 * Activate a subscription after user approval
	 */
	static async activateSubscription(
		subscriptionId: string,
	): Promise<{ success: boolean; subscription: unknown }> {
		const accessToken = await this.getAccessToken();

		// Get subscription details from PayPal
		const response = await fetch(
			`${paypalConfig.apiUrl}/v1/billing/subscriptions/${subscriptionId}`,
			{
				method: "GET",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
			},
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to get PayPal subscription: ${error}`);
		}

		const paypalSubscription =
			(await response.json()) as PayPalSubscriptionResponse;

		// Update subscription in database
		const subscription = await prisma.donationSubscription.update({
			where: { paypalSubscriptionId: subscriptionId },
			data: {
				status:
					paypalSubscription.status === "ACTIVE"
						? SubscriptionStatus.ACTIVE
						: SubscriptionStatus.PENDING,
				subscriberName: paypalSubscription.subscriber?.name
					? `${paypalSubscription.subscriber.name.given_name} ${paypalSubscription.subscriber.name.surname}`
					: null,
				subscriberEmail:
					paypalSubscription.subscriber?.email_address || null,
				nextBillingDate:
					paypalSubscription.billing_info?.next_billing_time
						? new Date(
								paypalSubscription.billing_info.next_billing_time,
							)
						: null,
			},
		});

		// If subscription is active and there's a payment, create a donation record
		if (
			paypalSubscription.status === "ACTIVE" &&
			paypalSubscription.billing_info?.last_payment
		) {
			await prisma.donation.create({
				data: {
					type: subscription.type,
					status: DonationStatus.COMPLETED,
					amount: parseFloat(
						paypalSubscription.billing_info.last_payment.amount
							.value,
					),
					currency:
						paypalSubscription.billing_info.last_payment.amount
							.currency_code,
					userId: subscription.userId,
					subscriptionId: subscription.id,
					donorName: subscription.subscriberName,
					donorEmail: subscription.subscriberEmail,
					completedAt: new Date(
						paypalSubscription.billing_info.last_payment.time,
					),
				},
			});
		}

		return { success: true, subscription };
	}

	/**
	 * Cancel a subscription
	 */
	static async cancelSubscription(
		subscriptionId: string,
		reason: string = "User requested cancellation",
	): Promise<{ success: boolean }> {
		const accessToken = await this.getAccessToken();

		const response = await fetch(
			`${paypalConfig.apiUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`,
			{
				method: "POST",
				headers: {
					Authorization: `Bearer ${accessToken}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ reason }),
			},
		);

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`Failed to cancel PayPal subscription: ${error}`);
		}

		// Update subscription in database
		await prisma.donationSubscription.update({
			where: { paypalSubscriptionId: subscriptionId },
			data: {
				status: SubscriptionStatus.CANCELLED,
				cancelledAt: new Date(),
			},
		});

		return { success: true };
	}

	/**
	 * Handle PayPal webhook events
	 */
	static async handleWebhook(
		event: { event_type: string; resource: Record<string, unknown> },
	): Promise<void> {
		const { event_type, resource } = event;

		switch (event_type) {
			case "PAYMENT.CAPTURE.COMPLETED":
				// One-time payment completed
				await this.handlePaymentCompleted(resource);
				break;

			case "BILLING.SUBSCRIPTION.ACTIVATED":
				// Subscription activated
				await this.handleSubscriptionActivated(resource);
				break;

			case "BILLING.SUBSCRIPTION.CANCELLED":
				// Subscription cancelled
				await this.handleSubscriptionCancelled(resource);
				break;

			case "PAYMENT.SALE.COMPLETED":
				// Recurring payment completed
				await this.handleRecurringPayment(resource);
				break;

			default:
				console.log(`Unhandled PayPal webhook event: ${event_type}`);
		}
	}

	private static async handlePaymentCompleted(
		resource: Record<string, unknown>,
	): Promise<void> {
		const orderId = resource.supplementary_data as {
			related_ids?: { order_id?: string };
		};
		if (orderId?.related_ids?.order_id) {
			try {
				await this.captureOrder(orderId.related_ids.order_id);
			} catch (error) {
				console.error("Error handling payment completed:", error);
			}
		}
	}

	private static async handleSubscriptionActivated(
		resource: Record<string, unknown>,
	): Promise<void> {
		const subscriptionId = resource.id as string;
		if (subscriptionId) {
			try {
				await this.activateSubscription(subscriptionId);
			} catch (error) {
				console.error(
					"Error handling subscription activated:",
					error,
				);
			}
		}
	}

	private static async handleSubscriptionCancelled(
		resource: Record<string, unknown>,
	): Promise<void> {
		const subscriptionId = resource.id as string;
		if (subscriptionId) {
			await prisma.donationSubscription.updateMany({
				where: { paypalSubscriptionId: subscriptionId },
				data: {
					status: SubscriptionStatus.CANCELLED,
					cancelledAt: new Date(),
				},
			});
		}
	}

	private static async handleRecurringPayment(
		resource: Record<string, unknown>,
	): Promise<void> {
		const billingAgreementId = resource.billing_agreement_id as string;
		const amount = resource.amount as {
			total: string;
			currency: string;
		};

		if (billingAgreementId && amount) {
			// Find the subscription
			const subscription = await prisma.donationSubscription.findUnique({
				where: { paypalSubscriptionId: billingAgreementId },
			});

			if (subscription) {
				// Create donation record for this payment
				await prisma.donation.create({
					data: {
						type: subscription.type,
						status: DonationStatus.COMPLETED,
						amount: parseFloat(amount.total),
						currency: amount.currency,
						userId: subscription.userId,
						subscriptionId: subscription.id,
						donorName: subscription.subscriberName,
						donorEmail: subscription.subscriberEmail,
						completedAt: new Date(),
					},
				});

				// Update subscription last payment date
				await prisma.donationSubscription.update({
					where: { id: subscription.id },
					data: { lastPaymentDate: new Date() },
				});
			}
		}
	}

	/**
	 * Get donation statistics
	 */
	static async getDonationStats(): Promise<{
		totalDonations: number;
		totalAmount: number;
		activeSubscriptions: number;
		monthlyRecurring: number;
	}> {
		const [donations, subscriptions] = await Promise.all([
			prisma.donation.aggregate({
				where: { status: DonationStatus.COMPLETED },
				_count: true,
				_sum: { amount: true },
			}),
			prisma.donationSubscription.findMany({
				where: { status: SubscriptionStatus.ACTIVE },
			}),
		]);

		const monthlyRecurring = subscriptions.reduce((total, sub) => {
			if (sub.type === DonationType.MONTHLY) {
				return total + sub.amount;
			} else if (sub.type === DonationType.YEARLY) {
				return total + sub.amount / 12;
			}
			return total;
		}, 0);

		return {
			totalDonations: donations._count,
			totalAmount: donations._sum.amount || 0,
			activeSubscriptions: subscriptions.length,
			monthlyRecurring,
		};
	}
}
