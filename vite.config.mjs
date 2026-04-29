import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function copyPromptsPlugin() {
  return {
    name: "copy-prompts",
    closeBundle() {
      const srcDir = join(__dirname, "prompts");
      const destDir = join(__dirname, "public", "prompts");
      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }
      const files = readdirSync(srcDir).filter((f) => f.endsWith(".json"));
      for (const file of files) {
        copyFileSync(join(srcDir, file), join(destDir, file));
      }
      console.log(`\u2713 copied ${files.length} prompt files to public/prompts`);
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    copyPromptsPlugin(),
    visualizer({
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: "stats.html",
    }),
  ],
  publicDir: false,
  build: {
    outDir: "public",
    emptyOutDir: true,
  },
});
