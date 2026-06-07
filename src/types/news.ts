/**
 * Types for fitness and nutrition news articles
 *
 * Designed for integration with news APIs like:
 * - RapidAPI Live Fitness and Health News
 * - NewsAPI.org (health category)
 * - GNews.io (health topic)
 */

export interface NewsArticle {
	id: string;
	title: string;
	description: string;
	content?: string;
	url: string;
	imageUrl?: string;
	source: NewsSource;
	author?: string;
	publishedAt: Date;
	category: NewsCategory;
}

export interface NewsSource {
	id: string;
	name: string;
	url?: string;
}

export type NewsCategory =
	| "fitness"
	| "nutrition"
	| "health"
	| "wellness"
	| "weight-loss"
	| "exercise"
	| "diet";

export interface NewsFetchOptions {
	category?: NewsCategory;
	limit?: number;
	page?: number;
}

export interface NewsFetchResult {
	articles: NewsArticle[];
	totalResults: number;
	page: number;
	hasMore: boolean;
}
