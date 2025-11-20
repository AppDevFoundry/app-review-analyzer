/**
 * Structured logger for the application
 *
 * Provides consistent JSON logging for observability.
 * Can be swapped out for a more sophisticated logging solution later.
 */

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogContext {
  workspaceId?: string
  appId?: string
  userId?: string
  runId?: string
  [key: string]: unknown
}

interface LogEntry {
  level: LogLevel
  event: string
  message?: string
  timestamp: string
  context?: LogContext
  duration?: number
  error?: {
    name: string
    message: string
    stack?: string
  }
}

/**
 * Format a log entry as JSON
 */
function formatLog(entry: LogEntry): string {
  return JSON.stringify(entry)
}

/**
 * Get current ISO timestamp
 */
function getTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Format error for logging
 */
function formatError(error: unknown): LogEntry["error"] | undefined {
  if (!error) return undefined

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    }
  }

  return {
    name: "Unknown",
    message: String(error),
  }
}

/**
 * Structured logger instance
 */
export const logger = {
  /**
   * Log a debug message (only in development)
   */
  debug(event: string, context?: LogContext, message?: string) {
    if (process.env.NODE_ENV !== "development") return

    const entry: LogEntry = {
      level: "debug",
      event,
      message,
      timestamp: getTimestamp(),
      context,
    }

    console.debug(formatLog(entry))
  },

  /**
   * Log an info message
   */
  info(event: string, context?: LogContext, message?: string) {
    const entry: LogEntry = {
      level: "info",
      event,
      message,
      timestamp: getTimestamp(),
      context,
    }

    console.info(formatLog(entry))
  },

  /**
   * Log a warning message
   */
  warn(event: string, context?: LogContext, message?: string) {
    const entry: LogEntry = {
      level: "warn",
      event,
      message,
      timestamp: getTimestamp(),
      context,
    }

    console.warn(formatLog(entry))
  },

  /**
   * Log an error message
   */
  error(event: string, error: unknown, context?: LogContext, message?: string) {
    const entry: LogEntry = {
      level: "error",
      event,
      message,
      timestamp: getTimestamp(),
      context,
      error: formatError(error),
    }

    console.error(formatLog(entry))
  },

  /**
   * Log with timing information
   * Returns a function to call when the operation is complete
   */
  time(event: string, context?: LogContext, message?: string): () => void {
    const startTime = Date.now()

    return () => {
      const entry: LogEntry = {
        level: "info",
        event,
        message,
        timestamp: getTimestamp(),
        context,
        duration: Date.now() - startTime,
      }

      console.info(formatLog(entry))
    }
  },

  /**
   * Log a metric value
   */
  metric(name: string, value: number, context?: LogContext, unit?: string) {
    const entry: LogEntry = {
      level: "info",
      event: "metric",
      message: name,
      timestamp: getTimestamp(),
      context: {
        ...context,
        metricValue: value,
        metricUnit: unit,
      },
    }

    console.info(formatLog(entry))
  },
}

// ============================================================================
// Review Ingestion Specific Logging
// ============================================================================

/**
 * Specific log events for review ingestion
 */
export const ingestionLogger = {
  /**
   * Log when ingestion starts
   */
  started(runId: string, appId: string, workspaceId: string, reason: string) {
    logger.info("ingestion_started", {
      runId,
      appId,
      workspaceId,
      reason,
    })
  },

  /**
   * Log page fetch progress
   */
  pageFetched(runId: string, page: number, source: string, reviewCount: number) {
    logger.debug("ingestion_page_fetched", {
      runId,
      page,
      source,
      reviewCount,
    })
  },

  /**
   * Log when ingestion completes successfully
   */
  completed(
    runId: string,
    appId: string,
    workspaceId: string,
    stats: {
      reviewsFetched: number
      reviewsNew: number
      reviewsDuplicate: number
      pagesProcessed: number
      durationMs: number
    }
  ) {
    logger.info("ingestion_completed", {
      runId,
      appId,
      workspaceId,
      ...stats,
    })
  },

  /**
   * Log when ingestion fails
   */
  failed(
    runId: string,
    appId: string,
    workspaceId: string,
    error: unknown,
    errorCode?: string
  ) {
    logger.error(
      "ingestion_failed",
      error,
      {
        runId,
        appId,
        workspaceId,
        errorCode,
      }
    )
  },

  /**
   * Log rate limit hit
   */
  rateLimited(workspaceId: string, source: string) {
    logger.warn("ingestion_rate_limited", {
      workspaceId,
      source,
    })
  },

  /**
   * Log daily limit exceeded
   */
  dailyLimitExceeded(workspaceId: string, currentCount: number, limit: number) {
    logger.warn("ingestion_daily_limit_exceeded", {
      workspaceId,
      currentCount,
      limit,
    })
  },

  /**
   * Log Apple API error
   */
  appleApiError(runId: string, url: string, error: unknown, attempt: number) {
    logger.error(
      "apple_api_error",
      error,
      {
        runId,
        url,
        attempt,
      }
    )
  },
}

export default logger
