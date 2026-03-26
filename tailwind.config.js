/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        neon: {
          green: "#39ff14", // High-intensity neon green
          cyan: "#00ffff", // Electric cyan
          orange: "#ff6600", // Saturated orange
          purple: "#d672ff", // Vibrant bright purple
          red: "#ff003c", // Pure red glow
          yellow: "#ffff00", // Pure yellow
          blue: "#1b66ff", // Deep but visible blue
        },
        bg: {
          deep: "#0a0b10", // Base background (slightly lighter for contrast)
          card: "#a5a5a5ff", // Standard card background
          lighter: "#1a1d29", // Lighter surface for tabs/panels
          header: "#0e1017", // Header specific background
        },
        // Legacy/Utility compatibility
        surface: "#12141d",
        panel: "#1a1d29",
        accent: "#00ffff",
        muted: "#636e7b", // Slightly brighter muted text
      },
      fontFamily: {
        orbitron: ["Orbitron", "sans-serif"],
        mono: ["Share Tech Mono", "monospace"],
        inter: ["Inter", "sans-serif"],
      },
      boxShadow: {
        "glow-cyan":
          "0 0 15px rgba(0, 255, 255, 0.4), 0 0 5px rgba(0, 255, 255, 0.2)",
        "glow-green":
          "0 0 15px rgba(57, 255, 20, 0.4), 0 0 5px rgba(57, 255, 20, 0.2)",
        "glow-purple":
          "0 0 15px rgba(214, 114, 255, 0.4), 0 0 5px rgba(214, 114, 255, 0.2)",
        "glow-orange":
          "0 0 15px rgba(255, 102, 0, 0.4), 0 0 5px rgba(255, 102, 0, 0.2)",
        "glow-red":
          "0 0 15px rgba(255, 0, 60, 0.4), 0 0 5px rgba(255, 0, 60, 0.2)",
      },
      backgroundImage: {
        "neon-grid":
          "linear-gradient(rgba(0, 255, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 255, 255, 0.04) 1px, transparent 1px)",
        "glass-radial":
          "radial-gradient(circle at center, rgba(255, 255, 255, 0.05) 0%, transparent 100%)",
      },
    },
  },
  plugins: [],
};
