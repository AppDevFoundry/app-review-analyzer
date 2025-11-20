"use client"

/**
 * Test User Selector Component
 *
 * Dev-mode only component that displays quick-select buttons for all test users.
 * Each button shows the user's scenario and allows instant login for testing.
 */

import { useState } from "react"
import { useSearchParams } from "next/navigation"
import { signIn } from "next-auth/react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { Icons } from "@/components/shared/icons"

/**
 * Test user configurations matching the seed script
 */
const TEST_USERS = [
  {
    email: "owner@starter.dev",
    label: "Owner (Starter - Empty)",
    scenario: "STARTER • 0/1 apps • Test adding first app",
    plan: "STARTER",
    apps: "0/1",
  },
  {
    email: "owner@starter-limit.dev",
    label: "Owner (Starter - At Limit)",
    scenario: "STARTER • 1/1 apps • Test limit enforcement",
    plan: "STARTER",
    apps: "1/1",
    highlight: true, // This user has detailed review data
  },
  {
    email: "owner@pro.dev",
    label: "Owner (Pro)",
    scenario: "PRO • 3/10 apps • Test normal operations",
    plan: "PRO",
    apps: "3/10",
  },
  {
    email: "owner@business.dev",
    label: "Owner (Business)",
    scenario: "BUSINESS • 5/50 apps • Test large-scale ops",
    plan: "BUSINESS",
    apps: "5/50",
  },
  {
    email: "admin@pro.dev",
    label: "Admin (Pro)",
    scenario: "PRO • ADMIN role • Test admin permissions",
    plan: "PRO",
    role: "ADMIN",
    apps: "2/10",
  },
  {
    email: "member@pro.dev",
    label: "Member (Pro)",
    scenario: "PRO • MEMBER role • Test member permissions",
    plan: "PRO",
    role: "MEMBER",
    apps: "2/10",
  },
  {
    email: "viewer@pro.dev",
    label: "Viewer (Pro)",
    scenario: "PRO • VIEWER role • Test read-only access",
    plan: "PRO",
    role: "VIEWER",
    apps: "2/10",
  },
] as const

export function TestUserSelector() {
  const [loadingEmail, setLoadingEmail] = useState<string | null>(null)
  const searchParams = useSearchParams()

  async function handleDevLogin(email: string) {
    setLoadingEmail(email)

    try {
      const signInResult = await signIn("dev-login", {
        email,
        redirect: false,
        callbackUrl: searchParams?.get("from") || "/dashboard",
      })

      if (!signInResult?.ok) {
        toast.error("Login failed", {
          description: signInResult?.error || "User not found in database. Run: pnpm run db:seed",
        })
        setLoadingEmail(null)
        return
      }

      // Success - redirect
      window.location.href = searchParams?.get("from") || "/dashboard"
    } catch (error) {
      toast.error("Login failed", {
        description: "An unexpected error occurred",
      })
      setLoadingEmail(null)
    }
  }

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icons.warning className="size-4 text-blue-600" />
        <p className="text-sm font-semibold text-blue-900">
          Development Test Users
        </p>
      </div>

      <p className="text-xs text-blue-700 mb-4">
        Quick login buttons for testing different scenarios (disabled in production)
      </p>

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {TEST_USERS.map((user) => (
          <button
            key={user.email}
            type="button"
            onClick={() => handleDevLogin(user.email)}
            disabled={loadingEmail !== null}
            className={cn(
              "w-full text-left rounded-md border p-3 transition-all",
              "hover:bg-white hover:shadow-sm",
              user.highlight
                ? "border-blue-300 bg-blue-100"
                : "border-gray-200 bg-white",
              loadingEmail === user.email && "opacity-75",
              loadingEmail !== null && loadingEmail !== user.email && "opacity-50"
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user.label}
                  </p>
                  {user.highlight && (
                    <span className="inline-flex items-center rounded-full bg-blue-500 px-2 py-0.5 text-xs font-medium text-white">
                      Rich Data
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  {user.scenario}
                </p>
              </div>
              {loadingEmail === user.email && (
                <Icons.spinner className="size-4 animate-spin text-blue-600 flex-shrink-0 mt-0.5" />
              )}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-blue-200">
        <p className="text-xs text-blue-600">
          💡 Need fresh data? Run: <code className="bg-blue-100 px-1 py-0.5 rounded">pnpm run db:seed</code>
        </p>
      </div>
    </div>
  )
}
