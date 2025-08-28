import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import { minify } from "terser";
import htmlMinifier from "html-minifier-terser";
import { createHash } from "crypto";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'file-hash',
      generateBundle(outputOptions, bundle) {
        Object.keys(bundle).forEach(fileName => {
          const chunk = bundle[fileName];
          
          // Only process chunks (JS/CSS files)
          if (chunk.type !== 'chunk') return;
          
          // Generate SHA256 hash of the content
          const hash = createHash('sha256')
            .update(chunk.code)
            .digest('hex')
            .substring(0, 16); // Use first 16 chars for readability
          
          // Prepend hash comment to the file
          const hashComment = `/* HASH:${hash} */\n`;
          chunk.code = hashComment + chunk.code;
        });
      }
    },
    {
      name: "minify-sw-and-manifest",
      closeBundle: async () => {
        const swFile = "../server/dist/sw.js";
        if (fs.existsSync(swFile)) {
          const { code } = await minify(fs.readFileSync(swFile, "utf8"));
          fs.writeFileSync(swFile, code, "utf8");
          console.log("✅ Minified sw.js");
        }

        const manifestFile = "../server/dist/manifest.json";
        if (fs.existsSync(manifestFile)) {
          fs.writeFileSync(
            manifestFile,
            JSON.stringify(JSON.parse(fs.readFileSync(manifestFile, "utf8"))),
            "utf8"
          );
          console.log("✅ Minified manifest.json");
        }
      },
    },
    {
      name: "minify-index-html",
      closeBundle: async () => {
        const file = "../server/dist/index.html";
        if (fs.existsSync(file)) {
          const html = fs.readFileSync(file, "utf8");
          const minified = await htmlMinifier.minify(html, {
            collapseWhitespace: true,
            removeComments: true,
            removeRedundantAttributes: true,
            useShortDoctype: true,
          });
          fs.writeFileSync(file, minified, "utf8");
          console.log("✅ Minified index.html");
        }
      },
    },
  ],
  build: {
    outDir: "../server/dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: "app.js", // fixed main entry
        chunkFileNames: "chunks/[name].js", // optional for split chunks
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith(".css")) {
            return "style.css"; // fixed CSS name
          }
          return "assets/[name].[ext]";
        },
      },
    },
    minify: "terser",
  },
  server: {
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3000",
        changeOrigin: true,
      },
    },
  },
});
