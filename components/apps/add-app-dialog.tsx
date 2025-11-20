"use client"

/**
 * Add App Dialog Component
 *
 * Modal dialog for adding new apps to the workspace.
 * Features:
 * - App Store URL or ID input with validation
 * - Optional nickname field
 * - Country selector
 * - Plan limit indicator
 * - Real-time validation and error handling
 * - Loading states and success feedback
 */

import { useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Loader2, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createApp } from "@/app/actions/apps"
import { createAppSchema, type CreateAppInput } from "@/lib/validations/app"

interface AddAppDialogProps {
  /**
   * Current number of apps in workspace
   */
  currentApps: number
  /**
   * Maximum apps allowed for current plan
   */
  maxApps: number
  /**
   * Workspace plan name for display
   */
  planName?: string
  /**
   * Trigger button variant (default or custom)
   */
  variant?: "default" | "outline" | "ghost"
}

/**
 * Common App Store countries
 */
const COUNTRIES = [
  { code: "us", name: "United States" },
  { code: "gb", name: "United Kingdom" },
  { code: "ca", name: "Canada" },
  { code: "au", name: "Australia" },
  { code: "de", name: "Germany" },
  { code: "fr", name: "France" },
  { code: "es", name: "Spain" },
  { code: "it", name: "Italy" },
  { code: "jp", name: "Japan" },
  { code: "cn", name: "China" },
  { code: "in", name: "India" },
  { code: "br", name: "Brazil" },
  { code: "mx", name: "Mexico" },
] as const

export function AddAppDialog({
  currentApps,
  maxApps,
  planName = "current plan",
  variant = "default",
}: AddAppDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isAtLimit = currentApps >= maxApps
  const appsRemaining = Math.max(0, maxApps - currentApps)

  const form = useForm<CreateAppInput>({
    resolver: zodResolver(createAppSchema),
    defaultValues: {
      identifier: "",
      nickname: "",
      country: "us",
    },
  })

  async function onSubmit(data: CreateAppInput) {
    setIsSubmitting(true)

    try {
      const result = await createApp(data)

      if (!result.success) {
        // Handle specific error codes
        if (result.code === "PLAN_LIMIT_EXCEEDED") {
          toast.error("Plan limit reached", {
            description: result.error,
            action: {
              label: "Upgrade Plan",
              onClick: () => router.push("/dashboard/billing"),
            },
          })
        } else if (result.code === "DUPLICATE_APP") {
          form.setError("identifier", {
            type: "manual",
            message: result.error,
          })
          toast.error("App already exists", {
            description: result.error,
          })
        } else if (result.code === "INVALID_IDENTIFIER") {
          form.setError("identifier", {
            type: "manual",
            message: "Invalid App Store URL or ID",
          })
          toast.error("Invalid input", {
            description: result.error,
          })
        } else if (result.code === "APP_NOT_FOUND") {
          form.setError("identifier", {
            type: "manual",
            message: "App not found in App Store",
          })
          toast.error("App not found", {
            description: result.error,
          })
        } else if (result.code === "PERMISSION_DENIED") {
          toast.error("Permission denied", {
            description: result.error,
          })
        } else {
          toast.error("Failed to add app", {
            description: result.error || "An unexpected error occurred",
          })
        }
        return
      }

      // Success!
      toast.success("App added successfully", {
        description: `${result.data.metadata.name} has been added to your workspace`,
      })

      form.reset()
      setOpen(false)
      router.refresh()
    } catch (error) {
      console.error("Error adding app:", error)
      toast.error("Failed to add app", {
        description: "An unexpected error occurred. Please try again.",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={variant}>
          <Plus className="mr-2 h-4 w-4" />
          Add App
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add App to Workspace</DialogTitle>
          <DialogDescription>
            Track any iOS app from the App Store by entering its URL or ID.
          </DialogDescription>
        </DialogHeader>

        {/* Plan limit indicator */}
        <div className="rounded-lg border bg-muted/50 p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Apps used</span>
            <span className="font-medium">
              {currentApps} of {maxApps}
            </span>
          </div>
          {appsRemaining <= 2 && appsRemaining > 0 && (
            <p className="mt-1 text-xs text-amber-600">
              {appsRemaining} {appsRemaining === 1 ? "slot" : "slots"} remaining
              on {planName}
            </p>
          )}
          {isAtLimit && (
            <div className="mt-2 flex items-center justify-between rounded border border-amber-200 bg-amber-50 p-2 text-xs">
              <span className="text-amber-900">Plan limit reached</span>
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0 text-xs text-amber-700 hover:text-amber-900"
                onClick={() => router.push("/dashboard/billing")}
              >
                Upgrade Plan
              </Button>
            </div>
          )}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* App Store URL or ID field */}
            <FormField
              control={form.control}
              name="identifier"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>App Store URL or ID</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="https://apps.apple.com/us/app/myapp/id1234567890"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Paste the full App Store URL or just the numeric app ID
                    (e.g., 1234567890)
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Optional nickname field */}
            <FormField
              control={form.control}
              name="nickname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Nickname <span className="text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My competitor app"
                      {...field}
                      disabled={isSubmitting}
                    />
                  </FormControl>
                  <FormDescription>
                    Add a custom label to help identify this app in your workspace
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Country selector */}
            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Country/Region</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a country" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {COUNTRIES.map((country) => (
                        <SelectItem key={country.code} value={country.code}>
                          {country.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    The App Store region to fetch reviews from
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || isAtLimit}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isSubmitting ? "Adding..." : "Add App"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
