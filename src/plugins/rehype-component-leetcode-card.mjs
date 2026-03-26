/// <reference types="mdast" />
import { h } from "hastscript";

/**
 * Creates a LeetCode problem card component.
 *
 * @param {Object} properties - The properties of the component.
 * @param {string} properties.id - The LeetCode problem number (e.g. "662").
 * @param {string} properties.title - The English problem title (used for URL).
 * @param {string} [properties.zh] - Optional Chinese problem title.
 * @param {('easy'|'medium'|'hard')} properties.difficulty - The difficulty level.
 * @param {import('mdast').RootContent[]} children - The children elements of the component.
 * @returns {import('mdast').Parent} The created LeetCode card component.
 */
export function LeetcodeCardComponent(properties, children) {
	if (Array.isArray(children) && children.length !== 0)
		return h("div", { class: "hidden" }, [
			'Invalid directive. ("leetcode" directive must be leaf type "::leetcode{id="662" title="..." difficulty="medium"}")',
		]);

	const { id, title, zh, difficulty } = properties;

	if (!id || !title || !difficulty)
		return h(
			"div",
			{ class: "hidden" },
			'Invalid leetcode card. Required attributes: id, title, difficulty.',
		);

	const difficultyLower = difficulty.toLowerCase();
	const url = `https://leetcode.cn/problems/${slugify(title)}/`;
	const displayTitle = zh ? zh : title;

	return h(
		"a",
		{
			class: `card-leetcode lc-${difficultyLower}`,
			href: url,
			target: "_blank",
		},
		[
			h("div", { class: "lc-left" }, [
				h("span", { class: "lc-id" }, `#${id}`),
				h("span", { class: "lc-title" }, displayTitle),
			]),
			h("div", { class: "lc-right" }, [
				h("span", { class: "lc-difficulty" }, difficulty.charAt(0).toUpperCase() + difficulty.slice(1).toLowerCase()),
			]),
		],
	);
}

function slugify(title) {
	return title
		.toLowerCase()
		.replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
		.replace(/^-|-$/g, "");
}
