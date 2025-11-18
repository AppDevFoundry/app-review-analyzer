import { defineConfig } from "vitest/config"
import path from "path"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],

  test: {
    // Test environment - can be overridden per file
    // Use 'node' for server/API tests, 'jsdom' for React component tests
    environment: "node",

    // Global setup/teardown
    setupFiles: ["./tests/setup.ts"],

    // Coverage configuration
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/**",
        "tests/**",
        "**/*.config.*",
        "**/*.d.ts",
        ".next/**",
        ".contentlayer/**",
        "prisma/migrations/**",
      ],
    },

    // Test file patterns
    include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
    exclude: ["node_modules/**", ".next/**", ".contentlayer/**"],

    // Globals (optional - enables describe, it, expect without imports)
    globals: true,

    // Timeout
    testTimeout: 10000,

    // Run tests in sequence for database operations
    pool: "forks",
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
})
