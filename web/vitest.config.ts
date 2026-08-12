import { defineConfig } from "vitest/config";
import path from "path";

// Unit tests run in node by default; the recorder-hook test opts into jsdom via
// a `// @vitest-environment jsdom` docblock. `@` resolves to the web/ root, same
// as the app's tsconfig paths.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, ".") } },
  test: {
    environment: "node",
    include: ["lib/**/*.test.{ts,tsx}"],
  },
});
