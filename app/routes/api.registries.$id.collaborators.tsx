/**
 * Simplified Registry Collaborators API
 * Direct operations without excessive abstraction
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { requireAdmin } from "~/lib/auth.server";
import { addCollaborator, removeCollaborator, getCollaborators } from "~/lib/collaboration.server";
import { db } from "~/lib/db.server";
import { requireCSRFToken } from "~/lib/csrf.server";

// Validate registry access
async function validateRegistry(registryId: string, adminShop: string) {
  const registry = await db.registries.findUnique({
    where: { id: registryId },
    select: { shopId: true, id: true }
  });

  if (!registry) {
    return json({ success: false, error: "Registry not found" }, { status: 404 });
  }

  if (adminShop !== registry.shopId) {
    return json({ success: false, error: "Access denied" }, { status: 403 });
  }

  return registry;
}

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await requireAdmin(request);
  const registryId = params['id']!;
  
  // Validate access
  await validateRegistry(registryId, session.shop);
  
  // Get collaborators
  const collaborators = await getCollaborators(registryId);
  
  return json({ collaborators });
}

export async function action({ request, params }: ActionFunctionArgs) {
  // Validate CSRF token for all mutations
  await requireCSRFToken(request);
  
  const { session } = await requireAdmin(request);
  const registryId = params['id']!;
  const method = request.method;
  
  // Validate access
  await validateRegistry(registryId, session.shop);
  
  const formData = await request.formData();
  
  switch (method) {
    case "POST": {
      // Add collaborator
      const email = formData.get("email") as string;
      const role = formData.get("role") as "viewer" | "editor";
      
      if (!email || !role) {
        return json({ success: false, error: "Email and role required" }, { status: 400 });
      }
      
      const collaborator = await addCollaborator(registryId, email, session.shop);
      
      return json({ collaborator });
    }
    
    case "DELETE": {
      // Remove collaborator
      const collaboratorId = formData.get("collaboratorId") as string;
      
      if (!collaboratorId) {
        return json({ success: false, error: "Collaborator ID required" }, { status: 400 });
      }
      
      await removeCollaborator(collaboratorId);
      
      return json({ success: true });
    }
    
    default:
      return json({ success: false, error: "Method not allowed" }, { status: 405 });
  }
}