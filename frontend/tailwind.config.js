/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'status-work': '#10b981',
                'status-break': '#f43f5e',
                'status-out': '#475569',
            }
        },
    },
    plugins: [],
}
