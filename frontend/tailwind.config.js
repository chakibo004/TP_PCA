/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{ts,tsx}", // Adjust this path to match where your components are
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
    },
  },
  variants: {},
  plugins: [
    require('@tailwindcss/forms'), // Pour styliser les formulaires
    require('@tailwindcss/typography'), // Pour des styles typographiques avancés
    require('@tailwindcss/aspect-ratio'), // Pour gérer les ratios d'aspect (images, vidéos, etc.)
  ],
}