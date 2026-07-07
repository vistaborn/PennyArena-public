import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        penny: {
          navy: "#004445",
          gold: "#f79d28",
          sand: "#f2ebe3",
          coral: "#ff8f72",
          mint: "#7ee8d8",
        },
      },
    },
  },
  plugins: [],
};

export default config;
