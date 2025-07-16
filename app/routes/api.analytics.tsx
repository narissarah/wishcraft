import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { AnalyticsSchemas, withValidation, validationErrorResponse } from "~/lib/validation-unified.server";
import { responses } from "~/lib/response-utils.server";
/**
 * Simple analytics endpoint for web vitals
 * Production-ready with error handling
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Accept both POST body and GET query params
    let rawData: any = null;
    
    if (request.method === "POST") {
      // Handle FormData from sendBeacon
      const contentType = request.headers.get("content-type");
      
      if (contentType?.includes("application/json")) {
        rawData = await request.json();
      } else if (contentType?.includes("multipart/form-data")) {
        const formData = await request.formData();
        const dataField = formData.get("data");
        if (dataField) {
          rawData = JSON.parse(dataField as string);
        }
      }
    } else if (request.method === "GET") {
      // Handle image beacon fallback
      const url = new URL(request.url);
      const encodedData = url.searchParams.get("data");
      if (encodedData) {
        rawData = JSON.parse(atob(decodeURIComponent(encodedData)));
      }
    }
    
    if (!rawData) {
      return responses.badRequest("No data provided");
    }
    
    // Validate the analytics data
    const webVitalsResult = AnalyticsSchemas.webVitals.safeParse(rawData);
    const errorResult = AnalyticsSchemas.error.safeParse(rawData);
    
    if (!webVitalsResult.success && !errorResult.success) {
      // In production, still return success to prevent breaking the client
      if (process.env.NODE_ENV === "development") {
        return validationErrorResponse([
          { message: "Invalid analytics data format" }
        ]);
      }
      return responses.ok();
    }
    
    const validatedData = webVitalsResult.success ? webVitalsResult.data : errorResult.data;
    
    // Log analytics data in development only
    if (process.env.NODE_ENV === "development") {
      // Analytics data validated successfully
    }
    
    // In production, you could send to your analytics service
    // For now, just acknowledge receipt
    return responses.ok();
    
  } catch (error) {
    // Silent failure - analytics should never break
    return responses.ok();
  }
};

// Handle both GET and POST
export const loader = action;