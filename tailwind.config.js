/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: "#17247a",
          deep: "#10184f",
          orange: "#ef7418",
          canvas: "#f6f7fc",
          ink: "#17204f",
          muted: "#78819b",
          line: "#e5e8f2",
        },
      },
    },
  },
  plugins: [],
};
