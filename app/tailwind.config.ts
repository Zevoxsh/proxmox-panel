import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Sora", "ui-sans-serif", "system-ui"],
        body: ["Inter", "ui-sans-serif", "system-ui"],
      },
      colors: {
        base: "#0b0e14",
        card: "#101520",
        border: "#1f2937",
        primary: "#4f46e5",
        muted: "#94a3b8",
      },
    },
  },
  plugins: [],
};

export default config;
