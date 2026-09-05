import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#16324f", teal: "#147d77", mist: "#f4f8f7" },
      boxShadow: { soft: "0 16px 45px rgba(22,50,79,.08)" }
    }
  },
  plugins: []
};

export default config;
