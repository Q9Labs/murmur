const colors = require( "./constants/theme-colors" );

/** @type {import('tailwindcss').Config} */
module.exports = {
	content: [ "./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}" ],
	presets: [ require( "nativewind/preset" ) ],
	theme: {
		extend: {
			colors: colors,
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
