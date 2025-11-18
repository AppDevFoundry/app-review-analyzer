import { beforeAll, afterAll, afterEach } from "vitest"
import { config } from "dotenv"

// Load test environment variables
config({ path: ".env.test" })

// Ensure we're using the test database
if (!process.env.DATABASE_URL_TEST && !process.env.DATABASE_URL) {
  console.warn(
    "Warning: No DATABASE_URL_TEST or DATABASE_URL found. Database tests may fail."
  )
}

// If DATABASE_URL_TEST is set, use it as DATABASE_URL for Prisma
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST
}

// Global test lifecycle hooks
beforeAll(async () => {
  // Any global setup can go here
  // For example, running migrations on test database
})

afterAll(async () => {
  // Global cleanup
})

afterEach(async () => {
  // Per-test cleanup can go here if needed
})
