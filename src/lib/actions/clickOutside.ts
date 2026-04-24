import type { Action } from "svelte/action";

interface ClickOutsideOptions {
	callback: () => void;
	exclude?: HTMLElement[];
}

export const clickOutside: Action<HTMLElement, (() => void) | ClickOutsideOptions> = (node, options) => {
	const { callback, exclude = [] } = typeof options === "function" ? { callback: options, exclude: [] } : options;

	const handleClick = (event: MouseEvent) => {
		const target = event.target as Node;
		if (
			node &&
			!node.contains(target) &&
			!event.defaultPrevented &&
			!exclude.some((el) => el && el.contains(target))
		) {
			callback?.();
		}
	};

	document.addEventListener("click", handleClick, true);

	return {
		destroy() {
			document.removeEventListener("click", handleClick, true);
		},
	};
};
