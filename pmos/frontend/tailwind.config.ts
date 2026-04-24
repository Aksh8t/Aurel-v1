import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: "#fafafa",
        foreground: "#18181b"
      },
      borderRadius: {
        xl: "1rem",
        lg: "0.75rem"
      }
    }
  },
  plugins: []
};

export default config;
