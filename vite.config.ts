import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";

export default defineConfig({
  server: {
    port: 3000,
    allowedHosts: true,
  },
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tanstackStart({
      srcDirectory: "src",
      router: {
        routesDirectory: "routes",
      },
    }),
    nitro(),
    viteReact(),
  ],
  ssr: {
    external: ["bcrypt", "pg"],
  },
  optimizeDeps: {
    exclude: ["bcrypt", "pg"],
  },
});
