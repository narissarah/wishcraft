/**
 * Simplified Registries API
 * Direct operations without excessive abstraction
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireAdmin } from "~/lib/auth.server";
import { createRegistry, listRegistries, updateRegistry, deleteRegistry } from "~/lib/registry.server";
import { sanitizeString } from "~/lib/validation.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await requireAdmin(request);
  
  const url = new URL(request.url);
  const search = url.searchParams.get("search") || undefined;
  const eventType = url.searchParams.get("eventType") || undefined;
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "20"), 100);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0"), 0);

  const registries = await listRegistries(session.shop, {
    search,
    eventType,
    limit,
    offset,
  });

  return json({ registries });
}

export async function action({ request }: ActionFunctionArgs) {
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
      const visibility = formData.get("visibility") as "public" | "private";
      const customerEmail = formData.get("customerEmail") as string;
      const customerFirstName = formData.get("customerFirstName") as string;
      const customerLastName = formData.get("customerLastName") as string;
      const customerPhone = formData.get("customerPhone") as string;
      const accessCode = formData.get("accessCode") as string;

      // Basic validation
      if (!title || !customerEmail || !customerFirstName || !customerLastName) {
        throw new Response("Required fields missing", { status: 400 });
      }

      const eventDate = eventDateStr ? new Date(eventDateStr) : undefined;

      const registry = await createRegistry(session.shop, {
        title,
        description: description || undefined,
        eventType: eventType || "general",
        eventDate,
        visibility: visibility || "public",
        customerEmail,
        customerFirstName,
        customerLastName,
        customerPhone: customerPhone || undefined,
        accessCode: accessCode || undefined,
      });

      return json({ registry });
    }
    
    case "PUT": {
      // Update registry
      const id = formData.get("id") as string;
      
      if (!id) {
        throw new Response("Registry ID required", { status: 400 });
      }

      const updateData: any = { id };
      
      const title = formData.get("title") as string;
      if (title) updateData.title = title;
      
      const description = formData.get("description") as string;
      if (description !== null) updateData.description = description;
      
      const eventType = formData.get("eventType") as string;
      if (eventType) updateData.eventType = eventType;
      
      const eventDateStr = formData.get("eventDate") as string;
      if (eventDateStr) updateData.eventDate = new Date(eventDateStr);
      
      const visibility = formData.get("visibility") as string;
      if (visibility) updateData.visibility = visibility;
      
      const accessCode = formData.get("accessCode") as string;
      if (accessCode !== null) updateData.accessCode = accessCode;

      const registry = await updateRegistry(updateData);
      
      return json({ registry });
    }
    
    case "DELETE": {
      // Delete registry
      const id = formData.get("id") as string;
      
      if (!id) {
        throw new Response("Registry ID required", { status: 400 });
      }

      const registry = await deleteRegistry(id, session.shop);
      
      return json({ registry });
    }
    
    default:
      throw new Response("Method not allowed", { status: 405 });
  }
}