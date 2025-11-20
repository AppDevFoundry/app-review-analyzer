/**
 * Global test setup file
 * Runs before all tests
 */

import { config } from "dotenv"
import { join } from "path"

// Load test environment variables
config({ path: join(__dirname, "..", ".env.test") })

// Set NODE_ENV to test
process.env.NODE_ENV = "test"

// Global test utilities can be added here
// For example: custom matchers, global mocks, etc.

console.log("🧪 Test environment initialized")
console.log(`   DATABASE_URL_TEST: ${process.env.DATABASE_URL_TEST ? "✓ Set" : "✗ Missing"}`)
