import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";
import Resend from "next-auth/providers/resend";
import Credentials from "next-auth/providers/credentials";

import { env } from "@/env.mjs";
import { sendVerificationRequest } from "@/lib/email";
import { prisma } from "@/lib/db";

// Test credentials provider for development only
const testCredentialsProvider = Credentials({
  id: "test-credentials",
  name: "Test Login",
  credentials: {
    email: { label: "Email", type: "email", placeholder: "demo@example.com" },
    password: { label: "Password", type: "password", placeholder: "any password works in dev" },
  },
  async authorize(credentials) {
    // Only allow in development
    if (process.env.NODE_ENV === "production") {
      console.warn("Test credentials provider is disabled in production");
      return null;
    }

    const email = credentials?.email as string;
    if (!email) return null;

    // Find or create the test user
    let user = await prisma.user.findUnique({
      where: { email },
    });

    // Auto-create test user if they don't exist (dev convenience)
    if (!user && email.endsWith("@example.com")) {
      user = await prisma.user.create({
        data: {
          email,
          name: email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, c => c.toUpperCase()),
          emailVerified: new Date(),
        },
      });
      console.log(`[Test Auth] Created test user: ${email}`);
    }

    if (!user) {
      console.log(`[Test Auth] User not found: ${email}`);
      return null;
    }

    console.log(`[Test Auth] Authenticated: ${user.email}`);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  },
});

export default {
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    }),
    Resend({
      apiKey: env.RESEND_API_KEY,
      from: env.EMAIL_FROM,
      // sendVerificationRequest,
    }),
    // Test credentials - only functional in development
    ...(process.env.NODE_ENV !== "production" ? [testCredentialsProvider] : []),
  ],
} satisfies NextAuthConfig;
