import { Request, Response } from "express";
import { PayPalService } from "../services/paypal.service";
import { paypalConfig } from "../config/paypal";

export class DonateController {
	/**
	 * GET /donate
	 * Donation page for supporting the project.
	 */
	public index = (_req: Request, res: Response): void => {
		res.render("donate/index", {
			title: "Support WeighTogether",
			description:
				"Help us keep WeighTogether free and ad-free by making a donation.",
			paypalClientId: paypalConfig.clientId,
			suggestedAmounts: paypalConfig.donationAmounts.suggested,
			defaultAmount: paypalConfig.donationAmounts.default,
			minAmount: paypalConfig.donationAmounts.min,
			maxAmount: paypalConfig.donationAmounts.max,
		});
	};

	/**
	 * GET /donate/thank-you
	 * Thank you page after PayPal donation.
	 * PayPal passes query parameters: tx (transaction ID), amt (amount), st (status), cc (currency)
	 */
	public thankYou = async (req: Request, res: Response): Promise<void> => {
		// Extract PayPal query parameters (for legacy redirect flow)
		const transactionId = req.query.tx as string | undefined;
		const amount = req.query.amt as string | undefined;
		const status = req.query.st as string | undefined;
		const currency = req.query.cc as string | undefined;
		const itemName = req.query.item_name as string | undefined;

		// For new PayPal SDK flow
		const orderId = req.query.token as string | undefined;
		const subscriptionId = req.query.subscription_id as string | undefined;
		const isSubscription = req.query.subscription === "true";

		let formattedAmount: string | undefined;
		let isSuccess = false;
		let finalTransactionId = transactionId;
		let subscriptionActive = false;

		try {
			// Handle order capture (one-time donation)
			if (orderId && !isSubscription) {
				const result = await PayPalService.captureOrder(orderId);
				isSuccess = result.success;
				finalTransactionId = result.transactionId;
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const donation = result.donation as any;
				if (donation) {
					const currencySymbol =
						donation.currency === "USD" ? "$" : donation.currency;
					formattedAmount = `${currencySymbol}${donation.amount.toFixed(2)}`;
				}
			}
			// Handle subscription activation
			else if (subscriptionId || isSubscription) {
				const subId =
					subscriptionId || (req.query.subscription_id as string);
				if (subId) {
					const result =
						await PayPalService.activateSubscription(subId);
					isSuccess = result.success;
					subscriptionActive = true;
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					const subscription = result.subscription as any;
					if (subscription) {
						const currencySymbol =
							subscription.currency === "USD"
								? "$"
								: subscription.currency;
						formattedAmount = `${currencySymbol}${subscription.amount.toFixed(2)}/${subscription.type === "MONTHLY" ? "month" : "year"}`;
					}
				}
			}
			// Legacy flow
			else if (status) {
				isSuccess = status.toLowerCase() === "completed";
				if (amount) {
					const currencySymbol =
						currency === "USD" ? "$" : currency || "$";
					formattedAmount = `${currencySymbol}${parseFloat(amount).toFixed(2)}`;
				}
			} else {
				// No payment info, assume success for direct visits
				isSuccess = true;
			}
		} catch (error) {
			console.error("Error processing donation callback:", error);
			isSuccess = false;
		}

		res.render("donate/thank-you", {
			title: "Thank You for Your Donation",
			description:
				"Your donation helps keep WeighTogether free and ad-free.",
			transactionId: finalTransactionId,
			amount: formattedAmount,
			rawAmount: amount,
			status,
			currency: currency || "USD",
			itemName,
			isSuccess,
			isSubscription: subscriptionActive,
		});
	};

	/**
	 * POST /api/donate/create-order
	 * Create a PayPal order for one-time donation
	 */
	public createOrder = async (req: Request, res: Response): Promise<void> => {
		try {
			const { amount, currency = "USD" } = req.body;

			if (
				!amount ||
				amount < paypalConfig.donationAmounts.min ||
				amount > paypalConfig.donationAmounts.max
			) {
				res.status(400).json({
					error: `Amount must be between $${paypalConfig.donationAmounts.min} and $${paypalConfig.donationAmounts.max}`,
				});
				return;
			}

			// Get user ID if logged in
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const userId = (req as any).user?.id || null;

			const { orderId, approvalUrl } = await PayPalService.createOrder(
				amount,
				currency,
				userId,
			);

			res.json({ orderId, approvalUrl });
		} catch (error) {
			console.error("Error creating PayPal order:", error);
			res.status(500).json({
				error: "Failed to create donation order",
			});
		}
	};

	/**
	 * POST /api/donate/capture-order
	 * Capture a PayPal order after user approval
	 */
	public captureOrder = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const { orderId } = req.body;

			if (!orderId) {
				res.status(400).json({ error: "Order ID is required" });
				return;
			}

			const result = await PayPalService.captureOrder(orderId);
			res.json(result);
		} catch (error) {
			console.error("Error capturing PayPal order:", error);
			res.status(500).json({
				error: "Failed to capture donation",
			});
		}
	};

	/**
	 * POST /api/donate/create-subscription
	 * Create a PayPal subscription for recurring donations
	 */
	public createSubscription = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const { planType } = req.body;

			if (!planType || !["monthly", "yearly"].includes(planType)) {
				res.status(400).json({
					error: "Plan type must be 'monthly' or 'yearly'",
				});
				return;
			}

			// Get user ID if logged in
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const userId = (req as any).user?.id || null;

			const { subscriptionId, approvalUrl } =
				await PayPalService.createSubscription(planType, userId);

			res.json({ subscriptionId, approvalUrl });
		} catch (error) {
			console.error("Error creating PayPal subscription:", error);
			res.status(500).json({
				error:
					error instanceof Error
						? error.message
						: "Failed to create subscription",
			});
		}
	};

	/**
	 * POST /api/donate/cancel-subscription
	 * Cancel a PayPal subscription
	 */
	public cancelSubscription = async (
		req: Request,
		res: Response,
	): Promise<void> => {
		try {
			const { subscriptionId, reason } = req.body;

			if (!subscriptionId) {
				res.status(400).json({
					error: "Subscription ID is required",
				});
				return;
			}

			const result = await PayPalService.cancelSubscription(
				subscriptionId,
				reason,
			);
			res.json(result);
		} catch (error) {
			console.error("Error cancelling subscription:", error);
			res.status(500).json({
				error: "Failed to cancel subscription",
			});
		}
	};

	/**
	 * POST /api/donate/webhook
	 * Handle PayPal webhook events
	 */
	public webhook = async (req: Request, res: Response): Promise<void> => {
		try {
			// TODO: Verify webhook signature using paypalConfig.webhookId
			// For now, we trust the event (should be verified in production)
			const event = req.body;

			await PayPalService.handleWebhook(event);

			res.status(200).json({ received: true });
		} catch (error) {
			console.error("Error handling PayPal webhook:", error);
			res.status(500).json({ error: "Webhook processing failed" });
		}
	};

	/**
	 * GET /api/donate/stats
	 * Get donation statistics (admin only in future)
	 */
	public getStats = async (_req: Request, res: Response): Promise<void> => {
		try {
			const stats = await PayPalService.getDonationStats();
			res.json(stats);
		} catch (error) {
			console.error("Error getting donation stats:", error);
			res.status(500).json({ error: "Failed to get donation stats" });
		}
	};
}
