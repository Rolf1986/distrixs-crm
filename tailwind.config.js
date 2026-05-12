/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Distrixs brand palette
        brand: {
          blue:        "#0170B9",   // primary blauw
          "blue-dark": "#015a94",   // hover blauw
          "blue-light":"#e8f3fb",   // lichte achtergrond blauw
          orange:      "#ff6600",   // accent oranje
          "orange-dark":"#e55a00",  // hover oranje
          "orange-light":"#fff3eb", // lichte achtergrond oranje
          dark:        "#2a2a2a",   // sidebar / koppen
          "dark-2":    "#3a3a3a",   // iets lichter
          text:        "#4B4F58",   // body tekst
          "bg-subtle": "#F2F5F7",   // lichte achtergrond
          "bg-light":  "#F5F5F5",   // nog lichter
        },
      },
    },
  },
  plugins: [],
};
