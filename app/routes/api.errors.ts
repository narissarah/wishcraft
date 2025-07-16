import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { log } from "~/lib/logger.server";
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
    const data = await request.json();
    const validation = ErrorReportSchema.safeParse(data);
    
    if (!validation.success) {
      return json({ error: "Invalid error report format" }, { status: 400 });
    }
    
    const errorReport = validation.data;
    
    // Log the error report
    log.error("Client-side error reported", {
      errorId: errorReport.errorId,
      message: errorReport.message,
      level: errorReport.level,
      url: errorReport.url,
      userAgent: errorReport.userAgent,
      timestamp: errorReport.timestamp
    });
    
    return json({ success: true });
  } catch (error) {
    log.error("Failed to process error report", error as Error);
    return json({ error: "Failed to process error report" }, { status: 500 });
  }
}