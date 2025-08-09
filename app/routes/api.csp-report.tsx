/**
 * Simplified CSP Violation Reporting Endpoint
 * Basic CSP violation logging without complex analysis
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { log } from "~/lib/logger.server";
import { db } from "~/lib/db.server";
import crypto from "crypto";
import { checkRateLimit, RATE_LIMITS } from "~/lib/rate-limit.server";

export async function action({ request }: ActionFunctionArgs) {
  // Apply rate limiting to prevent log flooding
  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const rateLimit = checkRateLimit(`csp-${ip}`, 30, 60 * 1000); // 30 reports per minute per IP
  
  if (!rateLimit.allowed) {
    log.warn("CSP report rate limit exceeded", { ip });
    return new Response(null, { status: 204 }); // Still return 204 to prevent retries
  }
  
  try {
    const contentType = request.headers.get("content-type");
    
    // Only accept JSON/CSP report content
    if (!contentType?.includes("json") && !contentType?.includes("csp-report")) {
      return new Response(null, { status: 204 });
    }

    const report = await request.json();
    const cspReport = report["csp-report"] || report;

    // Extract basic violation details
    const violation = {
      documentUri: cspReport["document-uri"] || cspReport.documentURI,
      violatedDirective: cspReport["violated-directive"] || cspReport.violatedDirective,
      blockedUri: cspReport["blocked-uri"] || cspReport.blockedURI,
      sourceFile: cspReport["source-file"] || cspReport.sourceFile,
      userAgent: request.headers.get("user-agent"),
      timestamp: new Date().toISOString()
    };

    // Log the violation
    log.warn("CSP Violation", violation);

    // Store in audit log if shop ID provided
    const url = new URL(request.url);
    const shopId = url.searchParams.get("shop");

    if (shopId) {
      await db.audit_logs.create({
        data: {
          id: crypto.randomUUID(),
          shopId,
          action: "csp_violation",
          resource: "security",
          resourceId: "csp",
          metadata: JSON.stringify(violation),
          ipAddress: request.headers.get("x-forwarded-for") || "unknown",
          userAgent: violation.userAgent
        }
      });
    }

    // Return 204 as per CSP spec
    return new Response(null, { status: 204 });
  } catch (error) {
    log.error("Failed to process CSP report", error);
    // Always return 204 to prevent browser retries
    return new Response(null, { status: 204 });
  }
}

export async function loader() {
  return new Response("Method not allowed", { status: 405 });
}