import { Request, Response, NextFunction } from "express";
import { NewsService } from "../services/news.service";

const GNEWS_COUNT = parseInt(process.env.GNEWS_COUNT || "6", 10);

/**
 * HomeController handles all public (non-authenticated) pages.
 * This includes the home page, about, resources, and contribute pages.
 */
export class HomeController {
	/**
	 * GET /
	 * Home page with featured news.
	 */
	static index = async (
		_req: Request,
		res: Response,
		next: NextFunction,
	): Promise<void> => {
		try {
			// Fetch featured news for the homepage
			const featuredNews = await NewsService.getFeaturedNews(GNEWS_COUNT);

			// Format the published dates for display
			const newsWithFormattedDates = featuredNews.map((article) => ({
				...article,
				formattedDate: NewsService.formatRelativeTime(
					article.publishedAt,
				),
			}));

			res.render("home/index", {
				title: "WeighTogether - Track Together, Transform Together",
				featuredNews: newsWithFormattedDates,
			});
		} catch (error) {
			next(error);
		}
	};

	/**
	 * GET /about
	 * About Us page.
	 */
	static about = (_req: Request, res: Response): void => {
		res.render("about/index", {
			title: "About Us",
			description:
				"Learn about WeighTogether - a community-driven platform for sustainable weight loss through tracking, teams, and accountability.",
		});
	};

	/**
	 * GET /resources
	 * Resources page with weight loss and nutrition links.
	 */
	static resources = (_req: Request, res: Response): void => {
		res.render("resources/index", {
			title: "Resources",
			description:
				"Reliable resources for weight loss, nutrition, and healthy living from trusted health organizations.",
		});
	};

	/**
	 * GET /contribute
	 * Contribute page - how to contribute to the open source project.
	 */
	static contribute = (_req: Request, res: Response): void => {
		res.render("contribute/index", {
			title: "Contribute",
			description:
				"WeighTogether is free and open source. Learn how to contribute to the project and join our community of developers.",
		});
	};

	/**
	 * GET /privacy
	 * Privacy Policy page.
	 */
	static privacy = (_req: Request, res: Response): void => {
		res.render("legal/privacy", {
			title: "Privacy Policy",
			description:
				"Learn how WeighTogether collects, uses, and protects your personal information.",
		});
	};
}
