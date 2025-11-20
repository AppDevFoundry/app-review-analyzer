"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Plus, Sparkles, AlertCircle } from "lucide-react"

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
import { toast } from "@/components/ui/use-toast"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createApp } from "@/app/actions/apps"
import { createAppSchema } from "@/lib/validations/app"
import Link from "next/link"

type FormValues = z.infer<typeof createAppSchema>

interface AddAppDialogProps {
  /** Current number of apps in workspace */
  currentAppCount: number
  /** Maximum apps allowed by plan */
  maxApps: number
  /** Plan name for display */
  planName: string
  /** Trigger element (optional, defaults to Add App button) */
  trigger?: React.ReactNode
}

export function AddAppDialog({
  currentAppCount,
  maxApps,
  planName,
  trigger,
}: AddAppDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const isAtLimit = currentAppCount >= maxApps
  const appsRemaining = Math.max(0, maxApps - currentAppCount)

  const form = useForm<FormValues>({
    resolver: zodResolver(createAppSchema),
    defaultValues: {
      identifier: "",
      nickname: "",
      country: "us",
    },
  })

  async function onSubmit(data: FormValues) {
    if (isAtLimit) {
      toast({
        title: "Plan limit reached",
        description: `You've reached the maximum of ${maxApps} apps on your ${planName} plan.`,
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)

    try {
      const result = await createApp(data)

      if (!result.success) {
        // Handle specific error codes
        if (result.code === "PLAN_LIMIT_EXCEEDED") {
          toast({
            title: "Plan limit reached",
            description: result.error,
            variant: "destructive",
          })
        } else if (result.code === "DUPLICATE_APP") {
          toast({
            title: "App already exists",
            description: result.error,
            variant: "destructive",
          })
        } else if (result.code === "RATE_LIMIT_EXCEEDED") {
          toast({
            title: "Too many requests",
            description: result.error,
            variant: "destructive",
          })
        } else if (result.code === "APP_NOT_FOUND") {
          form.setError("identifier", {
            type: "manual",
            message: result.error,
          })
        } else if (result.code === "INVALID_IDENTIFIER") {
          form.setError("identifier", {
            type: "manual",
            message: result.error,
          })
        } else {
          toast({
            title: "Error",
            description: result.error || "Failed to add app. Please try again.",
            variant: "destructive",
          })
        }
        return
      }

      // Success!
      toast({
        title: "App added",
        description: `${result.data.metadata.name} has been added to your workspace.`,
      })

      setOpen(false)
      form.reset()
      router.refresh()
    } catch (error) {
      console.error("Error creating app:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button disabled={isAtLimit}>
            <Plus className="mr-2 h-4 w-4" />
            Add App
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Add an App</DialogTitle>
          <DialogDescription>
            Track reviews for an iOS app. Enter the App Store URL or numeric ID.
          </DialogDescription>
        </DialogHeader>

        {/* Plan usage indicator */}
        <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2 text-sm">
          <span className="text-muted-foreground">
            Apps used on {planName} plan
          </span>
          <span className="font-medium">
            {currentAppCount} of {maxApps}
          </span>
        </div>

        {isAtLimit && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>You've reached your plan limit.</span>
              <Link
                href="/pricing"
                className="font-medium underline underline-offset-4"
              >
                Upgrade plan
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                      disabled={isLoading || isAtLimit}
                    />
                  </FormControl>
                  <FormDescription>
                    Example: https://apps.apple.com/us/app/storygraph/id1570489264 or 1570489264
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="nickname"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nickname (optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="My competitor app"
                      {...field}
                      disabled={isLoading || isAtLimit}
                    />
                  </FormControl>
                  <FormDescription>
                    A custom name for internal reference
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || isAtLimit}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Adding...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Add App
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
