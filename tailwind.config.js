/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: 'class',
    content: [
        './frontends/**/*.{html,js}',
        './build_portal/**/*.{html,js}'
    ],
    theme: {
        extend: {
            colors: {
                // Brand compartido
                'primary':           '#ec5b13',
                // Menu / Meseros
                'terracotta':        '#B22222',
                'background-light':  '#f8f6f6',
                'background-dark':   '#1a110c',
                'mexi-dark':         '#221610',
                'mexicanRed':        '#D21034',
                'mexicanGreen':      '#006341',
                'brandGold':         '#C5A059',
                // Cashier
                'cashier-dark':      '#0f172a',
            },
            fontFamily: {
                'display': ['Public Sans', 'sans-serif'],
                'sans':    ['Public Sans', 'Inter', 'system-ui', 'sans-serif'],
            },
            borderRadius: {
                'DEFAULT': '0.25rem',
                'lg':      '0.5rem',
                'xl':      '0.75rem',
                'full':    '9999px',
            },
            keyframes: {
                'slide-up': {
                    '0%':   { opacity: '0', transform: 'translateY(12px)' },
                    '100%': { opacity: '1', transform: 'translateY(0)' },
                },
                'fade-in': {
                    '0%':   { opacity: '0' },
                    '100%': { opacity: '1' },
                },
            },
            animation: {
                'slide-up': 'slide-up 0.25s ease-out',
                'fade-in':  'fade-in 0.4s ease-out',
            },
        },
    },
    plugins: [
        require('@tailwindcss/forms'),
        require('@tailwindcss/container-queries'),
    ],
};
