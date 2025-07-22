import type { ActionFunctionArgs } from "@remix-run/node";
import { log } from "~/lib/logger.server";
import { apiResponse } from "~/lib/api-response.server";
import { validateRequest } from "~/lib/validation.server";
import { rateLimiter } from "~/lib/security.server";
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
    const rateLimitResult = await rateLimiter.check(request);
    if (rateLimitResult && !rateLimitResult.allowed) {
      return apiResponse.rateLimitExceeded(60);
    }

    const data = await request.json();
    const validation = validateRequest(ErrorReportSchema, data);
    
    if (!validation.success) {
      return apiResponse.validationError(validation.errors || {});
    }
    
    const errorReport = validation.data;
    
    if (!errorReport) {
      return apiResponse.validationError({ error: ["Invalid error report data"] });
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