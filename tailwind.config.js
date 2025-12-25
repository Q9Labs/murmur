/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
	presets: [require("nativewind/preset")],
	theme: {
		extend: {
			colors: {
				// Core Sunset Warmth palette
				midnight: "#3A3042",
				clay: "#DB9D47",
				coral: "#FF784F",
				peach: "#FFE19C",
				mint: "#EDFFD9",

				// Semantic background colors
				bg: {
					primary: "#FFFBF7",
					secondary: "#FFF8F0",
					mint: "#EDFFD9",
					peach: "#FFE19C",
				},

				// Accent colors
				accent: {
					DEFAULT: "#FF784F",
					secondary: "#DB9D47",
					dark: "#3A3042",
				},

				// Ink (text) colors
				ink: {
					DEFAULT: "#3A3042",
					secondary: "#5A4A62",
					muted: "#8A7A92",
				},
			},
			borderRadius: {
				"4xl": "2rem",
				"5xl": "2.5rem",
			},
			boxShadow: {
				soft: "0 4px 24px -4px rgba(58, 48, 66, 0.12)",
				elevated: "0 8px 32px -8px rgba(58, 48, 66, 0.16)",
				glow: "0 0 24px -4px rgba(255, 120, 79, 0.3)",
				"glow-strong": "0 0 32px -4px rgba(255, 120, 79, 0.4)",
			},
		},
	},
	plugins: [],
};
