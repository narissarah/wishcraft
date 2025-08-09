import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { log } from "~/lib/logger.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const report = await request.json();
    
    log.warn("CSP Violation Report", {
      documentUri: report["csp-report"]?.["document-uri"],
      violatedDirective: report["csp-report"]?.["violated-directive"],
      blockedUri: report["csp-report"]?.["blocked-uri"],
      lineNumber: report["csp-report"]?.["line-number"],
      columnNumber: report["csp-report"]?.["column-number"],
      sourceFile: report["csp-report"]?.["source-file"],
    });
    
    return json({ success: true });
  } catch (error) {
    log.error("Failed to process CSP report", { error });
    return json({ success: false }, { status: 500 });
  }
}

export async function loader() {
  return json({ message: "Method not allowed" }, { status: 405 });
}