// Apply theme to the document
const applyTheme = (theme) => {
	const htmlElement = document.documentElement;
	htmlElement.classList.remove("light", "dark");

	if (theme === "system") {
		const prefersDark = window.matchMedia(
			"(prefers-color-scheme: dark)",
		).matches;
		htmlElement.classList.add(prefersDark ? "dark" : "light");
	} else {
		htmlElement.classList.add(theme);
	}
};

// Global function to toggle theme (called from Alpine.js)
window.toggleTheme = async function () {
	let currentTheme = localStorage.getItem("theme") || "system";
	let nextTheme;

	// Simple light/dark toggle for better UX
	if (currentTheme === "light") {
		nextTheme = "dark";
	} else if (currentTheme === "dark") {
		nextTheme = "light";
	} else {
		// If system, toggle to the opposite of current system preference
		const prefersDark = window.matchMedia(
			"(prefers-color-scheme: dark)",
		).matches;
		nextTheme = prefersDark ? "light" : "dark";
	}

	// Update localStorage
	localStorage.setItem("theme", nextTheme);

	// Apply theme immediately
	applyTheme(nextTheme);

	// Update Alpine.js component state
	const themeComponent = document.querySelector('[x-data*="theme"]');
	if (
		themeComponent &&
		themeComponent._x_dataStack &&
		themeComponent._x_dataStack[0]
	) {
		themeComponent._x_dataStack[0].theme = nextTheme;
	}

	// Save to server if user is logged in (check if we're authenticated)
	const refreshToken = document.cookie.includes("refreshToken");
	if (refreshToken) {
		try {
			const response = await fetch("/api/settings/theme", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ theme: nextTheme }),
			});

			if (!response.ok) {
				console.error("Failed to save theme preference to server");
			}
		} catch (error) {
			console.error("Error saving theme:", error);
		}
	}
};

document.addEventListener("DOMContentLoaded", () => {
	const themeSelect = document.getElementById("theme");

	// Set up theme select dropdown if it exists (settings page)
	if (themeSelect) {
		// Set the select element to match current localStorage value
		const currentTheme = localStorage.getItem("theme") || "system";
		themeSelect.value = currentTheme;

		themeSelect.addEventListener("change", async (event) => {
			const selectedTheme = event.target.value;
			localStorage.setItem("theme", selectedTheme);
			applyTheme(selectedTheme);

			// Save to server if logged in
			try {
				const response = await fetch("/api/settings/theme", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ theme: selectedTheme }),
				});

				if (!response.ok) {
					console.error("Failed to save theme preference to server");
				}
			} catch (error) {
				console.error("Error saving theme:", error);
			}
		});
	}

	// Listen for changes in system preference if current theme is 'system'
	window
		.matchMedia("(prefers-color-scheme: dark)")
		.addEventListener("change", () => {
			const currentTheme = localStorage.getItem("theme") || "system";
			if (currentTheme === "system") {
				applyTheme("system");
			}
		});
});
