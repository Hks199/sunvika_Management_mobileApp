/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#080875",
          deep: "#07075c",
          orange: "#ff7000",
          canvas: "#f5f6fc",
          ink: "#171b4b",
          muted: "#78819b",
          line: "#e3e5f2",
        },
      },
    },
  },
  plugins: [],
};
