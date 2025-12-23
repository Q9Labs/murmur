/** @type {import('tailwindcss').Config} */
module.exports = {
    // NOTE: Update this to include the paths to all files that contain Nativewind classes.
    content: [ "./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}" ],
    presets: [ require( "nativewind/preset" ) ],
    theme: {
        extend: {
            colors: {
                pastel: {
                    purple: '#DCD6F7',
                    pink: '#FFC4D6',
                    blue: '#A9DEF9',
                    mint: '#D0F4DE',
                    cream: '#FCF6BD',
                    text: '#4A4E69',
                    'text-light': '#9A8C98',
                }
            }
        },
    },
    plugins: [],
}