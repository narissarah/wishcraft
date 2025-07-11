import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";

/**
 * Simple analytics endpoint for web vitals
 * Production-ready with error handling
 */
export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Accept both POST body and GET query params
    let data: any = null;
    
    if (request.method === "POST") {
      // Handle FormData from sendBeacon
      const contentType = request.headers.get("content-type");
      
      if (contentType?.includes("application/json")) {
        data = await request.json();
      } else if (contentType?.includes("multipart/form-data")) {
        const formData = await request.formData();
        const rawData = formData.get("data");
        if (rawData) {
          data = JSON.parse(rawData as string);
        }
      }
    } else if (request.method === "GET") {
      // Handle image beacon fallback
      const url = new URL(request.url);
      const encodedData = url.searchParams.get("data");
      if (encodedData) {
        data = JSON.parse(atob(decodeURIComponent(encodedData)));
      }
    }
    
    // Log analytics data in development only
    if (process.env.NODE_ENV === "development" && data) {
      console.log("[Analytics]", data);
    }
    
    // In production, you could send to your analytics service
    // For now, just acknowledge receipt
    return json({ success: true }, { status: 200 });
    
  } catch (error) {
    // Silent failure - analytics should never break
    return json({ success: false }, { status: 200 });
  }
};

// Handle both GET and POST
export const loader = action;