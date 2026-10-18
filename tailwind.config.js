/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ttb: {
          navy: "#112e51",
          blue: "#005ea2",
          light: "#f0f4f8",
          gold: "#ffbe2e",
          green: "#00a91c",
          red: "#d54309",
        },
      },
    },
  },
  plugins: [],
};
