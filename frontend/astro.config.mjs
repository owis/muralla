import { defineConfig } from "astro/config"
import tailwind from "@astrojs/tailwind"
import react from "@astrojs/react"

export default defineConfig({
  integrations: [tailwind(), react()],
  vite: {
    define: {
      "import.meta.env.PUBLIC_API_URL": JSON.stringify(process.env.PUBLIC_API_URL || "http://localhost:3001"),
      "import.meta.env.PUBLIC_WS_URL": JSON.stringify(process.env.PUBLIC_WS_URL || "ws://localhost:3001"),
    },
  },
})
