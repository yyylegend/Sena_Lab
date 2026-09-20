import { type CollectionEntry, getCollection } from "astro:content";
import I18nKey from "@i18n/i18nKey";
import { i18n } from "@i18n/translation";
import { getCategoryUrl } from "@utils/url-utils.ts";

export function getSlug(entry: { id: string }): string {
	return entry.id.replace(/\.md$/, "");
}

// // Retrieve posts and sort them by publication date
async function getRawSortedPosts(includeArchived = false) {
	const allBlogPosts = await getCollection("posts", ({ data }) => {
		const isPublic = import.meta.env.PROD ? data.draft !== true : true;
		return isPublic && (includeArchived || data.archived !== true);
	});

	const sorted = allBlogPosts.sort((a, b) => {
		const dateA = new Date(a.data.published);
		const dateB = new Date(b.data.published);
		return dateA > dateB ? -1 : 1;
	});
	return sorted;
}

export async function getSortedPosts(includeArchived = false) {
	const sorted = await getRawSortedPosts(includeArchived);

	for (let i = 1; i < sorted.length; i++) {
		sorted[i].data.nextSlug = getSlug(sorted[i - 1]);
		sorted[i].data.nextTitle = sorted[i - 1].data.title;
	}
	for (let i = 0; i < sorted.length - 1; i++) {
		sorted[i].data.prevSlug = getSlug(sorted[i + 1]);
		sorted[i].data.prevTitle = sorted[i + 1].data.title;
	}

	return sorted;
}
export type PostForList = {
	slug: string;
	data: CollectionEntry<"posts">["data"];
};
export async function getSortedPostsList(includeArchived = false): Promise<PostForList[]> {
	const sortedFullPosts = await getRawSortedPosts(includeArchived);

	// delete post.body
	const sortedPostsList = sortedFullPosts.map((post) => ({
		slug: getSlug(post),
		data: post.data,
	}));

	return sortedPostsList;
}

export async function getSeriesPosts(series: string) {
	const posts = await getRawSortedPosts(true);
	return posts
		.filter((post) => post.data.series === series)
		.sort((a, b) => {
			const orderA = a.data.seriesOrder ?? Number.MAX_SAFE_INTEGER;
			const orderB = b.data.seriesOrder ?? Number.MAX_SAFE_INTEGER;
			if (orderA !== orderB) return orderA - orderB;
			return a.data.published > b.data.published ? -1 : 1;
		});
}

export async function getFeaturedPosts() {
	return (await getRawSortedPosts(false))
		.filter((post) => post.data.featured === true)
		.sort((a, b) => {
			const orderA = a.data.featuredOrder ?? Number.MAX_SAFE_INTEGER;
			const orderB = b.data.featuredOrder ?? Number.MAX_SAFE_INTEGER;
			if (orderA !== orderB) return orderA - orderB;
			return a.data.published > b.data.published ? -1 : 1;
		})
		.slice(0, 3);
}

export async function getRelatedPosts(
	current: CollectionEntry<"posts">,
	limit = 3,
) {
	const currentTags = new Set(current.data.tags);
	const posts = await getRawSortedPosts(false);

	return posts
		.filter((post) => post.id !== current.id)
		.map((post) => {
			const sharedTags = post.data.tags.filter((tag) => currentTags.has(tag)).length;
			const sameCategory =
				current.data.category &&
				post.data.category === current.data.category
					? 3
					: 0;
			const sameSeries =
				current.data.series &&
				post.data.series === current.data.series
					? 5
					: 0;
			return { post, score: sharedTags + sameCategory + sameSeries };
		})
		.filter(({ score }) => score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, limit)
		.map(({ post }) => post);
}
export type Tag = {
	name: string;
	count: number;
};

export async function getTagList(): Promise<Tag[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		const isPublic = import.meta.env.PROD ? data.draft !== true : true;
		return isPublic && data.archived !== true;
	});

	const countMap: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { tags: string[] } }) => {
		post.data.tags.forEach((tag: string) => {
			if (!countMap[tag]) countMap[tag] = 0;
			countMap[tag]++;
		});
	});

	// sort tags
	const keys: string[] = Object.keys(countMap).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return keys.map((key) => ({ name: key, count: countMap[key] }));
}

export type Category = {
	name: string;
	count: number;
	url: string;
};

export async function getCategoryList(): Promise<Category[]> {
	const allBlogPosts = await getCollection<"posts">("posts", ({ data }) => {
		const isPublic = import.meta.env.PROD ? data.draft !== true : true;
		return isPublic && data.archived !== true;
	});
	const count: { [key: string]: number } = {};
	allBlogPosts.forEach((post: { data: { category: string | null } }) => {
		if (!post.data.category) {
			const ucKey = i18n(I18nKey.uncategorized);
			count[ucKey] = count[ucKey] ? count[ucKey] + 1 : 1;
			return;
		}

		const categoryName =
			typeof post.data.category === "string"
				? post.data.category.trim()
				: String(post.data.category).trim();

		count[categoryName] = count[categoryName] ? count[categoryName] + 1 : 1;
	});

	const lst = Object.keys(count).sort((a, b) => {
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	const ret: Category[] = [];
	for (const c of lst) {
		ret.push({
			name: c,
			count: count[c],
			url: getCategoryUrl(c),
		});
	}
	return ret;
}
