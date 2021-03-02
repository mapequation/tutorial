module.exports = {
  purge: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  darkMode: 'class', // or 'media' or 'class'
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
      backgroundImage: (theme) => ({
        noise: 'url("images/noise-100-90-5.png")',
      }),
      backgroundSize: {
        // prettier-ignore
        '50': '50px 50px',
      },
    },
  },
  variants: {
    extend: {
      backgroundColor: ['active'],
      textColor: ['active'],
      borderColor: ['active'],
      transform: ['hover', 'focus'],
    },
  },
  plugins: [],
};
