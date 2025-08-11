/**
 * Simplified Registries API
 * Direct operations without excessive abstraction
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireAdmin } from "~/lib/auth.server";
import { createRegistry, listRegistries, updateRegistry, deleteRegistry } from "~/lib/registry.server";
import { requireCSRFToken } from "~/lib/csrf.server";
import { API_LIMITS } from "~/lib/constants";
import { log } from "~/lib/logger.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    const { session } = await requireAdmin(request);
    
    const url = new URL(request.url);
    const search = url.searchParams.get("search") ?? undefined;
    const eventType = url.searchParams.get("eventType") ?? undefined;
    const limit = Math.min(parseInt(url.searchParams.get("limit") || API_LIMITS.DEFAULT_PAGE_SIZE.toString()), API_LIMITS.MAX_PAGE_SIZE);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);

    const options: Parameters<typeof listRegistries>[1] = {
      limit,
      offset,
    };
    
    if (search) options.search = search;
    if (eventType) options.eventType = eventType;
    
    const registries = await listRegistries(session.shop, options);

    return json({ 
      success: true,
      data: { registries }
    });
  } catch (error) {
    log.error("Registries loader error:", error);
    return json({ 
      success: false, 
      error: "An error occurred loading registry data" 
    }, { status: 500 });
  }
}

export async function action({ request }: ActionFunctionArgs) {
  try {
    // Validate CSRF token for all mutations
    await requireCSRFToken(request);
    
    const { session } = await requireAdmin(request);
    const method = request.method;
    
    const formData = await request.formData();
  
  switch (method) {
    case "POST": {
      // Create registry
      const title = formData.get("title") as string;
      const description = formData.get("description") as string;
      const eventType = formData.get("eventType") as string;
      const eventDateStr = formData.get("eventDate") as string;
      const visibility = formData.get("visibility") as "public" | "private" | "friends" | "password";
      const customerEmail = formData.get("customerEmail") as string;
      const customerFirstName = formData.get("customerFirstName") as string;
      const customerLastName = formData.get("customerLastName") as string;
      const customerPhone = formData.get("customerPhone") as string;
      const accessCode = formData.get("accessCode") as string;

      // Basic validation
      if (!title || !customerEmail || !customerFirstName || !customerLastName) {
        return json({ success: false, error: "Required fields missing" }, { status: 400 });
      }

      const eventDate = eventDateStr && !isNaN(Date.parse(eventDateStr)) ? new Date(eventDateStr) : undefined;

      const createInput: Parameters<typeof createRegistry>[1] = {
        title,
        eventType: eventType || "general",
        visibility: visibility || "public",
        customerEmail,
        customerFirstName,
        customerLastName,
      };
      
      if (description) createInput.description = description;
      if (eventDate) createInput.eventDate = eventDate;
      if (customerPhone) createInput.customerPhone = customerPhone;
      if (accessCode) createInput.accessCode = accessCode;
      
      const registry = await createRegistry(session.shop, createInput);

      return json({ 
        success: true,
        data: { registry }
      });
    }
    
    case "PUT": {
      // Update registry
      const id = formData.get("id") as string;
      
      if (!id) {
        return json({ success: false, error: "Registry ID required" }, { status: 400 });
      }

      const updateData: { id: string; title?: string; description?: string; eventType?: string; eventDate?: Date; visibility?: 'public' | 'private' | 'friends' | 'password'; accessCode?: string } = { id };
      
      const title = formData.get("title") as string;
      if (title) updateData.title = title;
      
      const description = formData.get("description") as string | null;
      if (description !== null) {
        if (description) {
          updateData.description = description;
        }
      }
      
      const eventType = formData.get("eventType") as string;
      if (eventType) updateData.eventType = eventType;
      
      const eventDateStr = formData.get("eventDate") as string;
      if (eventDateStr && !isNaN(Date.parse(eventDateStr))) updateData.eventDate = new Date(eventDateStr);
      
      const visibility = formData.get("visibility") as string;
      if (visibility && ['public', 'private', 'friends', 'password'].includes(visibility)) {
        updateData.visibility = visibility as 'public' | 'private' | 'friends' | 'password';
      }
      
      const accessCode = formData.get("accessCode") as string;
      if (accessCode !== null) updateData.accessCode = accessCode;

      const registry = await updateRegistry(updateData);
      
      return json({ 
        success: true,
        data: { registry }
      });
    }
    
    case "DELETE": {
      // Delete registry
      const id = formData.get("id") as string;
      
      if (!id) {
        return json({ success: false, error: "Registry ID required" }, { status: 400 });
      }

      const registry = await deleteRegistry(id, session.shop);
      
      return json({ 
        success: true,
        data: { registry }
      });
    }
    
    default:
      return json({ success: false, error: "Method not allowed" }, { status: 405 });
  }
  } catch (error) {
    // Log error for debugging
    log.error('Registry API error:', error);
    
    // Return safe error message
    return json({ 
      success: false, 
      error: 'An error occurred processing your request' 
    }, { status: 500 });
  }
}