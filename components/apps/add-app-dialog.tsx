"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Plus, ExternalLink, Info } from "lucide-react"
import { toast } from "sonner"

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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

import { createApp } from "@/actions/create-app"
import { createAppSchema, type CreateAppInput } from "@/lib/validations/app"
import { isMockModeEnabled, getMockAppIds } from "@/lib/apple"

interface AddAppDialogProps {
  used: number
  limit: number
  disabled?: boolean
}

export function AddAppDialog({ used, limit, disabled }: AddAppDialogProps) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const isAtLimit = used >= limit

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateAppInput>({
    resolver: zodResolver(createAppSchema),
    defaultValues: {
      identifier: "",
      nickname: "",
    },
  })

  const onSubmit = handleSubmit((data) => {
    startTransition(async () => {
      const result = await createApp(data)

      if (result.status === "success" && result.data) {
        toast.success(`Added "${result.data.name}" to your apps`)
        setOpen(false)
        reset()
      } else if (result.error) {
        if (result.error.code === "PLAN_LIMIT_EXCEEDED") {
          toast.error(result.error.message, {
            action: {
              label: "Upgrade",
              onClick: () => window.location.href = "/pricing",
            },
          })
        } else {
          toast.error(result.error.message)
        }
      }
    })
  })

  const mockMode = isMockModeEnabled()
  const mockAppIds = mockMode ? getMockAppIds() : []

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={disabled || isAtLimit}>
          <Plus className="mr-2 size-4" />
          Add App
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>Add App to Track</DialogTitle>
            <DialogDescription>
              Enter an App Store URL or numeric ID to start tracking reviews.
              {used > 0 && (
                <span className="block mt-1 font-medium">
                  Using {used} of {limit} app slots
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="identifier">App Store URL or ID</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="size-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p>
                        Paste the full App Store URL or just the numeric ID.
                        Example: <code className="text-xs">1570489264</code> or{" "}
                        <code className="text-xs">https://apps.apple.com/app/id1570489264</code>
                      </p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <Input
                id="identifier"
                placeholder="https://apps.apple.com/app/id1570489264"
                {...register("identifier")}
                disabled={isPending}
                autoFocus
              />
              {errors.identifier && (
                <p className="text-sm text-destructive">
                  {errors.identifier.message}
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="nickname">
                Custom Name <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id="nickname"
                placeholder="Leave blank to use App Store name"
                {...register("nickname")}
                disabled={isPending}
              />
              {errors.nickname && (
                <p className="text-sm text-destructive">
                  {errors.nickname.message}
                </p>
              )}
            </div>

            {mockMode && (
              <div className="rounded-md border border-dashed border-orange-300 bg-orange-50 p-3 dark:border-orange-800 dark:bg-orange-950/30">
                <p className="text-sm font-medium text-orange-800 dark:text-orange-200 mb-2">
                  Mock Mode Enabled
                </p>
                <p className="text-xs text-orange-600 dark:text-orange-400 mb-2">
                  Available test app IDs:
                </p>
                <div className="flex flex-wrap gap-1">
                  {mockAppIds.map((id) => (
                    <code
                      key={id}
                      className="cursor-pointer rounded bg-orange-100 px-1.5 py-0.5 text-xs text-orange-700 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-300 dark:hover:bg-orange-800"
                      onClick={() => {
                        const input = document.getElementById("identifier") as HTMLInputElement
                        if (input) input.value = id
                      }}
                    >
                      {id}
                    </code>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || isAtLimit}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="mr-2 size-4" />
                  Add App
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
