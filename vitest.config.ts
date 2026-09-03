import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["apps/**/src/**/*.test.{ts,tsx}", "packages/**/src/**/*.test.ts"],
    // Server code is pure Node; frontend tests opt into jsdom with a
    // `@vitest-environment jsdom` docblock.
    environment: "node",
  },
});
