/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx}',
    './src/components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          'Lato',
          'Lucida Sans Unicode',
          'Lucida Grande',
          'Garuda',
          'sans-serif',
        ],
        brand: ['Philosopher', 'sans-serif'],
      },
      colors: {
        brand: '#b22222',
      },
      backgroundImage: {
        noise: 'url("/demo/images/noise-100-90-5.png")',
      },
      backgroundSize: {
        '50': '50px 50px',
      },
    },
  },
  plugins: [],
};
