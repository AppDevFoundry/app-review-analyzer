import { z } from "zod"
import { AppStatus, AppPlatform } from "@prisma/client"
import { isValidAppStoreIdentifier } from "@/lib/apple"

/**
 * Schema for creating a new app.
 * Accepts App Store URL or numeric ID.
 */
export const createAppSchema = z.object({
  identifier: z
    .string()
    .min(1, "App Store URL or ID is required")
    .trim()
    .refine(
      (val) => isValidAppStoreIdentifier(val),
      "Invalid App Store URL or ID. Please enter a valid URL (e.g., https://apps.apple.com/app/id1570489264) or numeric ID."
    ),
  nickname: z
    .string()
    .max(100, "Nickname must be 100 characters or less")
    .optional()
    .transform((val) => val?.trim() || undefined),
  country: z
    .string()
    .length(2, "Country code must be 2 characters")
    .default("us")
    .optional(),
})

export type CreateAppInput = z.infer<typeof createAppSchema>

/**
 * Schema for updating app status.
 */
export const updateAppStatusSchema = z.object({
  appId: z.string().cuid("Invalid app ID"),
  status: z.nativeEnum(AppStatus).refine(
    (val) => val === AppStatus.ACTIVE || val === AppStatus.PAUSED,
    "Can only set status to ACTIVE or PAUSED"
  ),
})

export type UpdateAppStatusInput = z.infer<typeof updateAppStatusSchema>

/**
 * Schema for deleting an app.
 */
export const deleteAppSchema = z.object({
  appId: z.string().cuid("Invalid app ID"),
  hardDelete: z.boolean().default(false).optional(),
})

export type DeleteAppInput = z.infer<typeof deleteAppSchema>

/**
 * Schema for app search/filter params.
 */
export const appFilterSchema = z.object({
  status: z.nativeEnum(AppStatus).optional(),
  platform: z.nativeEnum(AppPlatform).optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
})

export type AppFilterInput = z.infer<typeof appFilterSchema>

/**
 * Client-side validation helper for the identifier field.
 * Use this for real-time validation in forms.
 */
export function validateAppIdentifier(identifier: string): {
  valid: boolean
  error?: string
} {
  if (!identifier.trim()) {
    return { valid: false, error: "App Store URL or ID is required" }
  }

  if (!isValidAppStoreIdentifier(identifier)) {
    return {
      valid: false,
      error: "Invalid format. Enter a URL like https://apps.apple.com/app/id1234567890 or just the numeric ID.",
    }
  }

  return { valid: true }
}
