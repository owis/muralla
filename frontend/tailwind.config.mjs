/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Montserrat", "system-ui", "sans-serif"],
      },
      colors: {
        primary: "#0ea5e9",
        secondary: "#6366f1",
        dark: "#0f172a",
        light: "#f8fafc",
      },
      animation: {
        "slide-in": "slideIn 2s ease-out forwards",
        "fade-out": "fadeOut 1s ease-in forwards",
        "text-reveal": "textReveal 0.8s ease-out forwards",
        pulse: "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "marquee-3d": "marquee-3d 30s linear infinite",
      },
      keyframes: {
        slideIn: {
          "0%": {
            transform: "translateZ(-1000px) translateX(200px) scale(0.3)",
            opacity: "0",
          },
          "100%": {
            transform: "translateZ(0) translateX(0) scale(1)",
            opacity: "1",
          },
        },
        fadeOut: {
          "0%": { opacity: "1", transform: "scale(1)" },
          "100%": { opacity: "0", transform: "scale(1.1)" },
        },
        textReveal: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "marquee-3d": {
          "0%": { transform: "rotateY(-20deg) translateX(0%)" },
          "100%": { transform: "rotateY(-20deg) translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};
