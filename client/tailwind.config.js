export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        market: {
          green: "#10b981",
          emerald: "#059669",
          teal: "#14b8a6",
          navy: "#0f172a",
          ink: "#172033",
          page: "#f7fbf8",
          line: "#dbe8e5",
          cyan: "#06b6d4",
          purple: "#7c3aed",
          mint: "#dffaf0",
          yellow: "#facc15",
        },
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 23, 42, 0.08)",
        glow: "0 18px 45px rgba(16, 185, 129, 0.18)",
      },
    },
  },
  plugins: [],
};
