export const paypalConfig = {
	clientId: process.env.PAYPAL_CLIENT_ID || "",
	clientSecret: process.env.PAYPAL_CLIENT_SECRET || "",
	// Use sandbox for development, live for production
	// Set PAYPAL_USE_LIVE=true to use live API in development
	apiUrl:
		process.env.NODE_ENV === "production" || process.env.PAYPAL_USE_LIVE === "true"
			? "https://api-m.paypal.com"
			: "https://api-m.sandbox.paypal.com",
	// Return URLs after payment
	returnUrl:
		process.env.PAYPAL_RETURN_URL ||
		"http://localhost:3000/donate/thank-you",
	cancelUrl:
		process.env.PAYPAL_CANCEL_URL || "http://localhost:3000/donate",
	// Webhook ID for verifying webhook events
	webhookId: process.env.PAYPAL_WEBHOOK_ID || "",
	// Donation amounts
	donationAmounts: {
		suggested: [5, 10, 25, 50, 100],
		default: 10,
		min: 1,
		max: 10000,
	},
	// Subscription plan IDs (will be created in PayPal dashboard or via API)
	plans: {
		monthly: process.env.PAYPAL_MONTHLY_PLAN_ID || "",
		yearly: process.env.PAYPAL_YEARLY_PLAN_ID || "",
	},
};
