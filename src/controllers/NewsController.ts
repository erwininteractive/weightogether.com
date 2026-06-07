import { Request, Response, NextFunction } from "express";
import { NewsService } from "../services/news.service";

export class NewsController {
	/**
	 * GET /news
	 * News listing page - accessible to all users
	 */
	public index = async (
		req: Request,
		res: Response,
		next: NextFunction
	): Promise<void> => {
		try {
			const category = req.query.category as string | undefined;
			const page = parseInt(req.query.page as string) || 1;

			const result = await NewsService.fetchNews({
				category: category as "fitness" | "nutrition" | "weight-loss" | "exercise" | undefined,
				limit: 12,
				page,
			});

			const newsWithFormattedDates = result.articles.map((article) => ({
				...article,
				formattedDate: NewsService.formatRelativeTime(article.publishedAt),
			}));

			res.render("news/index", {
				title: "Fitness & Nutrition News",
				description: "Stay up to date with the latest fitness, nutrition, and weight loss news.",
				articles: newsWithFormattedDates,
				currentCategory: category || "all",
				currentPage: page,
				hasMore: result.hasMore,
				totalResults: result.totalResults,
			});
		} catch (error) {
			next(error);
		}
	};
}
