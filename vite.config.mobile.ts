import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Статическая SPA-сборка для упаковки в Android (Capacitor).
// Без Nitro/Vercel, без серверных плагинов. Результат: dist/client/index.html
export default defineConfig({
  resolve: { tsconfigPaths: true },
  build: { outDir: "dist", emptyOutDir: true },
  plugins: [
    tailwindcss(),
    tanstackStart({
      spa: {
        enabled: true,
        prerender: { outputPath: "/index", crawlLinks: false },
      },
    }),
    viteReact(),
  ],
});
