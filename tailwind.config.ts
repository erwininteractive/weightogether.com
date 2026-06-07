import type { Config } from "tailwindcss";

const config: Config = {
	content: [
		"./src/views/**/*.ejs",
		"./src/views/**/*.html",
		"./public/**/*.html",
	],
};

export default config;
