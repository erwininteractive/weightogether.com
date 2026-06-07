import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
	plugins: [tailwindcss()],
	publicDir: false,
	build: {
		outDir: "public/dist",
		emptyOutDir: true,
		rollupOptions: {
			input: path.resolve(__dirname, "src/styles/main.css"),
			output: {
				assetFileNames: "[name][extname]",
			},
		},
	},
});
