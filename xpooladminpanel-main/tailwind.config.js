/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    yellow: '#FFD700',
                    black: '#000000',
                    white: '#FFFFFF',
                }
            }
        },
    },
    plugins: [],
}
