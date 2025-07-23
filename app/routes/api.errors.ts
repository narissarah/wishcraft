import type { ActionFunctionArgs } from "@remix-run/node";
import { log } from "~/lib/logger.server";
import { apiResponse } from "~/lib/api-response.server";
import { checkRateLimit, RATE_LIMITS } from "~/lib/rate-limit.server";
import { z } from "zod";

const ErrorReportSchema = z.object({
  type: z.literal("error"),
  errorId: z.string(),
  message: z.string(),
  stack: z.string().optional(),
  componentStack: z.string().optional(),
  level: z.enum(["page", "component", "widget"]),
  timestamp: z.string(),
  url: z.string().url(),
  userAgent: z.string()
});

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Rate limiting for error reports
    const ip = request.headers.get("x-forwarded-for") || "unknown";
    const rateLimitResult = checkRateLimit(ip, RATE_LIMITS.api.limit, RATE_LIMITS.api.window);
    if (!rateLimitResult.allowed) {
      return apiResponse.rateLimitExceeded(60);
    }

    const data = await request.json();
    
    let errorReport;
    try {
      errorReport = ErrorReportSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return apiResponse.validationError({ error: ["Invalid error report data"] });
      }
      throw error;
    }
    
    // Log the error report
    log.error("Client-side error reported", {
      errorId: errorReport.errorId,
      message: errorReport.message,
      level: errorReport.level,
      url: errorReport.url,
      userAgent: errorReport.userAgent,
      timestamp: errorReport.timestamp
    });
    
    return apiResponse.success({ received: true });
  } catch (error) {
    log.error("Failed to process error report", error as Error);
    return apiResponse.serverError(error);
  }
}