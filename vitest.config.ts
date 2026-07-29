import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        // executeScripts re-injects <script> elements so pasted embed snippets
        // actually run. jsdom ignores dynamically-inserted scripts unless asked
        // not to, which would make that module's test pass for the wrong reason.
        runScripts: "dangerously",
      },
    },
    setupFiles: "./src/test/setup.ts",
    globals: true,
    include: ["src/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@payload-config": path.resolve(__dirname, "./src/payload.config.ts"),
      "lucide-react": path.resolve(__dirname, "./src/test/mocks/lucide-react.ts"),
    },
  },
});
