import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { log } from "~/lib/logger.server";
import { db } from "~/lib/db.server";

/**
 * CSP Violation Reporting Endpoint
 * Handles Content Security Policy violation reports from browsers
 */
export async function action({ request }: ActionFunctionArgs) {
  try {
    const contentType = request.headers.get("content-type");
    
    // CSP reports are sent as application/csp-report or application/json
    if (!contentType?.includes("json") && !contentType?.includes("csp-report")) {
      return json({ error: "Invalid content type" }, { status: 400 });
    }

    const report = await request.json();
    const cspReport = report["csp-report"] || report;

    // Extract violation details
    const violation = {
      documentUri: cspReport["document-uri"] || cspReport.documentURI,
      violatedDirective: cspReport["violated-directive"] || cspReport.violatedDirective,
      effectiveDirective: cspReport["effective-directive"] || cspReport.effectiveDirective,
      originalPolicy: cspReport["original-policy"] || cspReport.originalPolicy,
      blockedUri: cspReport["blocked-uri"] || cspReport.blockedURI,
      lineNumber: cspReport["line-number"] || cspReport.lineNumber,
      columnNumber: cspReport["column-number"] || cspReport.columnNumber,
      sourceFile: cspReport["source-file"] || cspReport.sourceFile,
      statusCode: cspReport["status-code"] || cspReport.statusCode,
      scriptSample: cspReport["script-sample"] || cspReport.scriptSample,
      referrer: cspReport.referrer,
      userAgent: request.headers.get("user-agent"),
      timestamp: new Date().toISOString()
    };

    // Log the violation
    log.warn("CSP Violation Reported", violation);

    // Get shop ID from URL or session
    const url = new URL(request.url);
    const shopId = url.searchParams.get("shop");

    if (shopId) {
      // Store violation in audit log
      await db.auditLog.create({
        data: {
          shopId,
          action: "csp_violation",
          resource: "security",
          resourceId: "csp",
          metadata: JSON.stringify(violation),
          ipAddress: request.headers.get("x-forwarded-for") || 
                     request.headers.get("x-real-ip") ||
                     "unknown",
          userAgent: violation.userAgent,
          timestamp: new Date()
        }
      });
    }

    // Analyze violation patterns
    analyzeViolation(violation);

    // Return 204 No Content as per CSP reporting spec
    return new Response(null, { status: 204 });
  } catch (error) {
    log.error("Failed to process CSP report", error);
    // Still return 204 to prevent browser from retrying
    return new Response(null, { status: 204 });
  }
}

// GET requests should return 405 Method Not Allowed
export async function loader() {
  return json({ error: "Method not allowed" }, { status: 405 });
}

/**
 * Analyze CSP violations for patterns and security issues
 */
function analyzeViolation(violation: any) {
  // Check for common issues
  const knownIssues = {
    "inline-script": "Inline scripts blocked - use nonce or move to external files",
    "inline-style": "Inline styles blocked - use nonce or external stylesheets",
    "unsafe-eval": "eval() usage blocked - refactor code to avoid eval",
    "data:": "Data URIs blocked - use proper image hosting",
    "blob:": "Blob URIs blocked - review dynamic content generation",
    "http:": "HTTP resources blocked on HTTPS site - use HTTPS URLs"
  };

  const blockedUri = violation.blockedUri?.toLowerCase() || "";
  const directive = violation.violatedDirective?.toLowerCase() || "";

  // Log specific recommendations
  if (directive.includes("script-src") && blockedUri === "inline") {
    log.info("CSP: Inline script violation - ensure all scripts use nonce");
  } else if (directive.includes("style-src") && blockedUri === "inline") {
    log.info("CSP: Inline style violation - ensure all styles use nonce");
  } else if (blockedUri.startsWith("http:") && violation.documentUri?.startsWith("https:")) {
    log.warn("CSP: Mixed content violation - HTTP resource on HTTPS page");
  } else if (blockedUri.includes("googletagmanager") || blockedUri.includes("analytics")) {
    log.info("CSP: Analytics blocked - add to allowed sources if needed");
  }

  // Track violation frequency (in-memory for now)
  trackViolationFrequency(violation);
}

// Simple in-memory tracking (reset on server restart)
const violationCounts = new Map<string, number>();

function trackViolationFrequency(violation: any) {
  const key = `${violation.violatedDirective}:${violation.blockedUri}`;
  const count = (violationCounts.get(key) || 0) + 1;
  violationCounts.set(key, count);

  // Alert on high frequency violations
  if (count > 10 && count % 10 === 0) {
    log.warn(`High frequency CSP violation: ${key} (${count} occurrences)`);
  }
}