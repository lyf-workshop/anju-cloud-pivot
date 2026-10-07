import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root,
  base: "./",
  publicDir: "public",
  build: {
    outDir: path.resolve(root, "../../dist/client"),
    emptyOutDir: true,
    sourcemap: false,
    target: "es2022",
  },
  server: { host: "127.0.0.1", port: 5173 },
  preview: { host: "127.0.0.1", port: 4173 },
});
