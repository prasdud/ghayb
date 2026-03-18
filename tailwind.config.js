/** @type {import('tailwindcss').Config} */
module.exports = {
    content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                background: '#FDFCF8',
                foreground: '#2C2C24',
                primary: {
                    DEFAULT: '#5D7052',
                    foreground: '#F3F4F1',
                },
                secondary: {
                    DEFAULT: '#C18C5D',
                    foreground: '#FFFFFF',
                },
                accent: {
                    DEFAULT: '#E6DCCD',
                    foreground: '#4A4A40',
                },
                muted: {
                    DEFAULT: '#F0EBE5',
                    foreground: '#78786C',
                },
                border: '#DED8CF',
                destructive: '#A85448',
                timber: '#DED8CF',
                moss: '#5D7052',
                clay: '#C18C5D',
                sand: '#E6DCCD',
            },
            fontFamily: {
                serif: ['Fraunces', 'serif'],
                sans: ['Nunito', 'sans-serif'],
            },
        },
    },
    plugins: [],
};
