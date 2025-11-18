import { z } from "zod"
import { AppStatus } from "@prisma/client"

/**
 * Validation schemas for App-related operations
 */

/**
 * Schema for creating a new app
 */
export const createAppSchema = z.object({
  identifier: z
    .string()
    .min(1, "App Store URL or ID is required")
    .trim()
    .refine(
      (val) => {
        // Must be either a numeric ID or a valid URL containing an ID
        return /^\d+$/.test(val) || /\/id\d+/.test(val) || /[?&]id=\d+/.test(val)
      },
      {
        message: "Please provide a valid App Store URL or numeric ID",
      }
    ),
  nickname: z.string().trim().optional(),
  country: z.string().length(2).optional().default("us"),
})

export type CreateAppInput = z.infer<typeof createAppSchema>

/**
 * Schema for updating app status
 */
export const updateAppStatusSchema = z.object({
  appId: z.string().cuid("Invalid app ID"),
  status: z.enum([AppStatus.ACTIVE, AppStatus.PAUSED], {
    errorMap: () => ({ message: "Status must be ACTIVE or PAUSED" }),
  }),
})

export type UpdateAppStatusInput = z.infer<typeof updateAppStatusSchema>

/**
 * Schema for deleting an app
 */
export const deleteAppSchema = z.object({
  appId: z.string().cuid("Invalid app ID"),
  hardDelete: z.boolean().optional().default(false),
})

export type DeleteAppInput = z.infer<typeof deleteAppSchema>

/**
 * Schema for restoring a deleted app
 */
export const restoreAppSchema = z.object({
  appId: z.string().cuid("Invalid app ID"),
})

export type RestoreAppInput = z.infer<typeof restoreAppSchema>
